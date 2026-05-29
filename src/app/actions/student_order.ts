'use server'

import { createClient } from '@/utils/supabase/server'
import { revalidatePath } from 'next/cache'

// 1. Haal de klassen op die gekoppeld zijn aan deze leerkracht
export async function getTeacherClasses() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Niet ingelogd' }

  const { data, error } = await supabase
    .from('user_classes')
    .select(`
      class_id,
      classes (
        id,
        name,
        level,
        school_id,
        schools (
          id, name, caterer_id
        )
      )
    `)
    .eq('user_id', user.id)

  if (error) return { error: error.message }
  return { 
    classes: data.map((d: any) => {
      const cls = Array.isArray(d.classes) ? d.classes[0] : d.classes;
      if (cls && Array.isArray(cls.schools)) cls.schools = cls.schools[0];
      return cls;
    }).filter(Boolean) 
  }
}

// 2. Haal leerlingen, maaltijden en geplaatste bestellingen op voor een specifieke datum
export async function getStudentOrderMatrix(classId: string, schoolId: string, catererId: string, date: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Niet ingelogd' }

  // Check of de dag gelocked is
  const { data: lockData } = await supabase
    .from('day_locks')
    .select('lock_date')
    .eq('school_id', schoolId)
    .eq('lock_date', date)
    .single()

  const isLocked = !!lockData

  // Haal leerlingen op (niet verborgen)
  const { data: students, error: studErr } = await supabase
    .from('students')
    .select('id, class_number, first_name')
    .eq('class_id', classId)
    .eq('is_hidden', false)
    .order('class_number')
    
  if (studErr) return { error: studErr.message }

  // Haal beschikbare maaltijden op voor deze caterer
  const { data: meals, error: mealsErr } = await supabase
    .from('student_meals')
    .select('id, name, price_kleuter, price_lager')
    .eq('caterer_id', catererId)
    .eq('is_active', true)
    .order('name')

  if (mealsErr) return { error: mealsErr.message }

  // Haal reeds geplaatste bestellingen op
  const studentIds = students?.map(s => s.id) || []
  let orders: any[] = []
  if (studentIds.length > 0) {
    const { data: existingOrders } = await supabase
      .from('student_orders')
      .select('id, student_id, student_meal_id, quantity')
      .in('student_id', studentIds)
      .eq('order_date', date)
      
    if (existingOrders) orders = existingOrders
  }

  return { 
    students: students || [], 
    meals: meals || [], 
    orders,
    isLocked
  }
}

// 3. Opslaan van bestellingen
export async function saveStudentOrdersBulk(classId: string, date: string, toInsert: any[], toDeleteIds: string[]) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Niet ingelogd' }

  // Supabase checks RLS for 'is_student_order_allowed' during insert/delete automatically, 
  // but we should still handle the response gracefully.

  let hasError = false;
  let errorMessage = '';

  // Delete unchecked boxes
  if (toDeleteIds.length > 0) {
    const { error } = await supabase
      .from('student_orders')
      .delete()
      .in('id', toDeleteIds)
    if (error) {
      hasError = true;
      errorMessage = error.message;
    }
  }

  // Insert newly checked boxes
  if (toInsert.length > 0 && !hasError) {
    const { error } = await supabase
      .from('student_orders')
      .insert(toInsert)
    if (error) {
      hasError = true;
      errorMessage = error.message;
    }
  }

  if (hasError) {
    if (errorMessage.includes('is_student_order_allowed')) {
       return { error: 'Bestellen is niet mogelijk voor deze datum (Woensdag, Zaterdag, Zondag of dag is reeds afgesloten).' }
    }
    return { error: errorMessage }
  }

  revalidatePath('/leerlingen')
  return { success: true }
}

// 4. Vorige week kopiëren
export async function copyPreviousStudentOrders(classId: string, targetDate: string) {
  const supabase = await createClient()
  
  const target = new Date(targetDate)
  const previous = new Date(target)
  previous.setDate(previous.getDate() - 7)
  const previousDateStr = previous.toISOString().split('T')[0]

  // Haal studenten op van deze klas
  const { data: students } = await supabase
    .from('students')
    .select('id')
    .eq('class_id', classId)
    .eq('is_hidden', false)

  if (!students || students.length === 0) return { error: 'Geen leerlingen gevonden in deze klas' }
  const studentIds = students.map(s => s.id)

  // Haal bestellingen op van vorige week
  const { data: oldOrders } = await supabase
    .from('student_orders')
    .select('student_id, student_meal_id, quantity, price_at_order')
    .in('student_id', studentIds)
    .eq('order_date', previousDateStr)

  if (!oldOrders || oldOrders.length === 0) {
    return { error: `Geen bestellingen gevonden op ${previousDateStr} om over te nemen.` }
  }

  // Check welke maaltijden nog actief zijn (voorkom insert van inactieve maaltijden)
  const mealIds = [...new Set(oldOrders.map(o => o.student_meal_id))]
  const { data: activeMeals } = await supabase
    .from('student_meals')
    .select('id')
    .in('id', mealIds)
    .eq('is_active', true)
    
  const activeMealIds = new Set(activeMeals?.map(m => m.id) || [])

  // Bouw nieuwe inserts
  const newOrders = oldOrders
    .filter(o => activeMealIds.has(o.student_meal_id))
    .map(o => ({
      student_id: o.student_id,
      student_meal_id: o.student_meal_id,
      order_date: targetDate,
      quantity: o.quantity,
      price_at_order: o.price_at_order
    }))

  if (newOrders.length === 0) {
    return { error: 'De bestelde maaltijden van vorige week zijn niet meer beschikbaar.' }
  }

  // We moeten wel opletten: dit voegt enkel toe. Als er al bestellingen stonden op targetDate, kan dit conflicteren (UNIQUE).
  // We kunnen de bestaande orders eerst wissen of upserten.
  // Voor veiligheid: wis alle bestellingen van deze studenten op targetDate
  await supabase
    .from('student_orders')
    .delete()
    .in('student_id', studentIds)
    .eq('order_date', targetDate)

  // Insert de gekopieerde bestellingen
  const { error } = await supabase
    .from('student_orders')
    .insert(newOrders)

  if (error) {
    if (error.message.includes('is_student_order_allowed')) {
      return { error: 'Bestellen is niet mogelijk voor deze datum (Woensdag, Zaterdag, Zondag of afgesloten).' }
    }
    return { error: error.message }
  }

  revalidatePath('/leerlingen')
  return { success: true, count: newOrders.length }
}
