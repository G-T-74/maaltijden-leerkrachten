'use server'

import { createClient } from '@/utils/supabase/server'
import { revalidatePath } from 'next/cache'

// Controleer of de gebruiker een admin is
async function checkAdmin(supabase: any) {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return false

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  return profile?.role === 'admin' || profile?.role === 'superadmin'
}

export async function getSchoolsWithDeadlines() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || !(await checkAdmin(supabase))) return { error: 'Geen toegang' }

  // Haal gekoppelde scholen en de actieve school op uit het profiel
  const { data: profile } = await supabase
    .from('profiles')
    .select('active_admin_school_id, role')
    .eq('id', user.id)
    .single()

  let schoolIds: string[] = []
  const isSuperAdmin = profile?.role === 'superadmin'

  if (isSuperAdmin) {
    const { data: allSchools } = await supabase.from('schools').select('id')
    schoolIds = allSchools?.map(s => s.id) || []
  } else {
    const { data: userSchools } = await supabase
      .from('user_schools')
      .select('school_id')
      .eq('user_id', user.id)
    schoolIds = userSchools?.map(us => us.school_id) || []
  }

  if (schoolIds.length === 0) return { schools: [], activeSchoolId: null }

  const { data, error } = await supabase
    .from('schools')
    .select('id, name, order_deadline, caterer_id, apply_toddler_factor')
    .in('id', schoolIds)
    .order('name')

  if (error) return { error: error.message }
  return { schools: data, activeSchoolId: profile?.active_admin_school_id }
}

export async function setActiveAdminSchool(schoolId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || !(await checkAdmin(supabase))) return { error: 'Geen toegang' }

  const { error } = await supabase
    .from('profiles')
    .update({ active_admin_school_id: schoolId })
    .eq('id', user.id)

  if (error) return { error: error.message }
  return { success: true }
}

export async function updateSchoolDeadline(schoolId: string, deadline: string) {
  const supabase = await createClient()
  if (!(await checkAdmin(supabase))) return { error: 'Geen toegang' }

  const { error } = await supabase
    .from('schools')
    .update({ order_deadline: deadline })
    .eq('id', schoolId)

  if (error) return { error: error.message }
  
  revalidatePath('/admin')
  revalidatePath('/')
  return { success: true }
}

export async function updateSchoolToddlerFactor(schoolId: string, apply: boolean) {
  const supabase = await createClient()
  if (!(await checkAdmin(supabase))) return { error: 'Geen toegang' }

  const { error } = await supabase
    .from('schools')
    .update({ apply_toddler_factor: apply })
    .eq('id', schoolId)

  if (error) return { error: error.message }
  
  revalidatePath('/admin')
  return { success: true }
}

export async function getCaterers() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || !(await checkAdmin(supabase))) return { error: 'Geen toegang' }

  const { data: userSchools } = await supabase
    .from('user_schools')
    .select('schools(caterer_id)')
    .eq('user_id', user.id)

  const catererIds = userSchools?.map(us => (us.schools as any)?.caterer_id).filter(Boolean) || []
  if (catererIds.length === 0) return { caterers: [] }

  const { data, error } = await supabase
    .from('caterers')
    .select('id, name')
    .in('id', catererIds)
    .order('name')

  if (error) return { error: error.message }
  return { caterers: data }
}

export async function getAdminMeals(catererId: string | null) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || !(await checkAdmin(supabase))) return { error: 'Geen toegang' }

  if (!catererId) return { meals: [] }

  // Check if admin has access to this caterer via their schools
  const { data: userSchools } = await supabase
    .from('user_schools')
    .select('schools(caterer_id)')
    .eq('user_id', user.id)

  const catererIds = userSchools?.map(us => (us.schools as any)?.caterer_id).filter(Boolean) || []
  if (!catererIds.includes(catererId)) return { error: 'Geen toegang tot deze traiteur.' }

  const { data, error } = await supabase
    .from('meals')
    .select('id, name, category, price, is_active, caterer_id, caterers(name)')
    .eq('caterer_id', catererId)
    .order('category')
    .order('name')

  if (error) return { error: error.message }
  return { meals: data }
}

export async function saveMeal(formData: FormData) {
  const supabase = await createClient()
  if (!(await checkAdmin(supabase))) return { error: 'Geen toegang' }

  const id = formData.get('id') as string
  const name = formData.get('name') as string
  const category = formData.get('category') as string
  const price = parseFloat(formData.get('price') as string)
  const caterer_id = formData.get('caterer_id') as string
  const is_active = formData.get('is_active') === 'true'

  if (!name || !category || isNaN(price) || !caterer_id) {
    return { error: 'Vul alle velden correct in.' }
  }

  if (id) {
    // Update existing
    const { error } = await supabase
      .from('meals')
      .update({ name, category, price, caterer_id, is_active })
      .eq('id', id)
      
    if (error) return { error: error.message }
  } else {
    // Create new
    const { error } = await supabase
      .from('meals')
      .insert({ name, category, price, caterer_id, is_active })
      
    if (error) return { error: error.message }
  }

  revalidatePath('/admin')
  revalidatePath('/')
  return { success: true }
}

export async function deleteMeal(id: string) {
  const supabase = await createClient()
  if (!(await checkAdmin(supabase))) return { error: 'Geen toegang' }

  const { error } = await supabase
    .from('meals')
    .delete()
    .eq('id', id)

  if (error) return { error: error.message }
  
  revalidatePath('/admin')
  revalidatePath('/')
  return { success: true }
}

export async function getAdminStudentMeals(catererId: string | null) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || !(await checkAdmin(supabase))) return { error: 'Geen toegang' }

  if (!catererId) return { meals: [] }

  const { data, error } = await supabase
    .from('student_meals')
    .select('id, name, price_kleuter, price_lager, is_active, caterer_id, caterers(name)')
    .eq('caterer_id', catererId)
    .order('name')

  if (error) return { error: error.message }
  return { meals: data }
}

export async function saveStudentMeal(formData: FormData) {
  const supabase = await createClient()
  if (!(await checkAdmin(supabase))) return { error: 'Geen toegang' }

  const id = formData.get('id') as string
  const name = formData.get('name') as string
  const price_kleuter = parseFloat(formData.get('price_kleuter') as string)
  const price_lager = parseFloat(formData.get('price_lager') as string)
  const caterer_id = formData.get('caterer_id') as string
  const is_active = formData.get('is_active') === 'true'

  if (!name || isNaN(price_kleuter) || isNaN(price_lager) || !caterer_id) {
    return { error: 'Vul alle velden correct in.' }
  }

  if (id) {
    const { error } = await supabase
      .from('student_meals')
      .update({ name, price_kleuter, price_lager, caterer_id, is_active })
      .eq('id', id)
      
    if (error) return { error: error.message }
  } else {
    const { error } = await supabase
      .from('student_meals')
      .insert({ name, price_kleuter, price_lager, caterer_id, is_active })
      
    if (error) return { error: error.message }
  }

  revalidatePath('/admin')
  return { success: true }
}

export async function deleteStudentMeal(id: string) {
  const supabase = await createClient()
  if (!(await checkAdmin(supabase))) return { error: 'Geen toegang' }

  const { error } = await supabase
    .from('student_meals')
    .delete()
    .eq('id', id)

  if (error) return { error: error.message }
  
  revalidatePath('/admin')
  return { success: true }
}

export async function exportYearlyData(schoolId: string) {
  const supabase = await createClient()
  if (!(await checkAdmin(supabase))) return { error: 'Geen toegang' }

  // Haal teacher orders op
  const { data: teacherOrders } = await supabase
    .from('orders')
    .select(`
      order_date,
      quantity,
      price_at_order,
      profiles ( first_name, last_name ),
      meals ( name )
    `)
    .eq('school_id', schoolId)
    .order('order_date', { ascending: true })

  // Haal student orders op
  const { data: classes } = await supabase
    .from('classes')
    .select('id, name')
    .eq('school_id', schoolId)

  const classIds = classes?.map(c => c.id) || []
  let studentOrders: any[] = []

  if (classIds.length > 0) {
    const { data: students } = await supabase
      .from('students')
      .select('id, class_id, first_name')
      .in('class_id', classIds)

    const studentIds = students?.map(s => s.id) || []
    
    if (studentIds.length > 0) {
      const { data } = await supabase
        .from('student_orders')
        .select(`
          order_date,
          quantity,
          price_at_order,
          student_id,
          student_meals ( name )
        `)
        .in('student_id', studentIds)
        .order('order_date', { ascending: true })
        
      if (data) {
        studentOrders = data.map(o => {
          const student = students?.find(s => s.id === o.student_id)
          const cls = classes?.find(c => c.id === student?.class_id)
          return {
            ...o,
            student_name: student?.first_name || 'Onbekend',
            class_name: cls?.name || 'Onbekend'
          }
        })
      }
    }
  }

  // Bouw CSV
  let csv = 'Datum;Besteller;Klas;Maaltijd;Type;Aantal;Totaalprijs\n'

  teacherOrders?.forEach(o => {
    const prof = o.profiles as any
    const meal = o.meals as any
    const naam = `${prof?.first_name || ''} ${prof?.last_name || ''}`.trim() || 'Onbekend'
    const maaltijd = meal?.name || 'Onbekend'
    const prijs = (o.quantity * o.price_at_order).toFixed(2)
    csv += `${o.order_date};${naam};-;${maaltijd};Leerkracht;${o.quantity};${prijs}\n`
  })

  studentOrders.forEach(o => {
    const smeal = o.student_meals as any
    const maaltijd = smeal?.name || 'Onbekend'
    const prijs = (o.quantity * o.price_at_order).toFixed(2)
    csv += `${o.order_date};${o.student_name};${o.class_name};${maaltijd};Leerling;${o.quantity};${prijs}\n`
  })

  return { csv }
}

export async function resetSchoolYear(schoolId: string) {
  const supabase = await createClient()
  if (!(await checkAdmin(supabase))) return { error: 'Geen toegang' }

  // 1. Verwijder orders (leerkrachten)
  const { error: err1 } = await supabase
    .from('orders')
    .delete()
    .eq('school_id', schoolId)
  if (err1) return { error: 'Fout bij verwijderen orders: ' + err1.message }

  // 2. Verwijder day_locks
  const { error: err2 } = await supabase
    .from('day_locks')
    .delete()
    .eq('school_id', schoolId)
  if (err2) return { error: 'Fout bij verwijderen day_locks: ' + err2.message }

  // 3. Verwijder students (die CASCADE naar student_orders)
  // Eerst classes ophalen
  const { data: classes } = await supabase
    .from('classes')
    .select('id')
    .eq('school_id', schoolId)
    
  if (classes && classes.length > 0) {
    const classIds = classes.map(c => c.id)
    const { error: err3 } = await supabase
      .from('students')
      .delete()
      .in('class_id', classIds)
    if (err3) return { error: 'Fout bij verwijderen leerlingen: ' + err3.message }
  }

  // Let op: we verwijderen classes NIET zodat de koppelingen met leerkrachten blijven bestaan.
  // We verwijderen Enkel de leerlingen en de bestellingen.
  
  revalidatePath('/admin')
  return { success: true }
}

// --- CLASS GROUPS MANAGEMENT ---

export async function getClassGroups(schoolId: string) {
  const supabase = await createClient()
  if (!(await checkAdmin(supabase))) return { error: 'Geen toegang' }

  const { data, error } = await supabase
    .from('class_groups')
    .select('*')
    .eq('school_id', schoolId)
    .order('name')

  if (error) return { error: error.message }
  return { groups: data }
}

export async function createClassGroup(schoolId: string, name: string, orderCode: string) {
  const supabase = await createClient()
  if (!(await checkAdmin(supabase))) return { error: 'Geen toegang' }

  const { error } = await supabase
    .from('class_groups')
    .insert([{ school_id: schoolId, name, order_code: orderCode }])

  if (error) return { error: error.message }
  return { success: true }
}

export async function updateClassGroup(groupId: string, name: string, orderCode: string) {
  const supabase = await createClient()
  if (!(await checkAdmin(supabase))) return { error: 'Geen toegang' }

  const { error } = await supabase
    .from('class_groups')
    .update({ name, order_code: orderCode })
    .eq('id', groupId)

  if (error) return { error: error.message }
  return { success: true }
}

export async function deleteClassGroup(groupId: string) {
  const supabase = await createClient()
  if (!(await checkAdmin(supabase))) return { error: 'Geen toegang' }

  const { error } = await supabase
    .from('class_groups')
    .delete()
    .eq('id', groupId)

  if (error) return { error: error.message }
  return { success: true }
}

export async function assignClassToGroup(classId: string, groupId: string | null) {
  const supabase = await createClient()
  if (!(await checkAdmin(supabase))) return { error: 'Geen toegang' }

  const { error } = await supabase
    .from('classes')
    .update({ class_group_id: groupId })
    .eq('id', classId)

  if (error) return { error: error.message }
  return { success: true }
}
