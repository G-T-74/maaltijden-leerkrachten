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
    .select('active_admin_school_id')
    .eq('id', user.id)
    .single()

  const { data: userSchools } = await supabase
    .from('user_schools')
    .select('school_id')
    .eq('user_id', user.id)

  const schoolIds = userSchools?.map(us => us.school_id) || []
  if (schoolIds.length === 0) return { schools: [], activeSchoolId: null }

  const { data, error } = await supabase
    .from('schools')
    .select('id, name, order_deadline, caterer_id')
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
