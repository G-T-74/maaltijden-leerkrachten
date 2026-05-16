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

  return profile?.role === 'admin'
}

export async function getSchoolsWithDeadlines() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || !(await checkAdmin(supabase))) return { error: 'Geen toegang' }

  const { data: userSchools } = await supabase
    .from('user_schools')
    .select('school_id')
    .eq('user_id', user.id)

  const schoolIds = userSchools?.map(us => us.school_id) || []
  if (schoolIds.length === 0) return { schools: [] }

  const { data, error } = await supabase
    .from('schools')
    .select('id, name, order_deadline')
    .in('id', schoolIds)
    .order('name')

  if (error) return { error: error.message }
  return { schools: data }
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

export async function getAdminMeals() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || !(await checkAdmin(supabase))) return { error: 'Geen toegang' }

  const { data: userSchools } = await supabase
    .from('user_schools')
    .select('schools(caterer_id)')
    .eq('user_id', user.id)

  const catererIds = userSchools?.map(us => (us.schools as any)?.caterer_id).filter(Boolean) || []
  if (catererIds.length === 0) return { meals: [] }

  const { data, error } = await supabase
    .from('meals')
    .select('id, name, category, price, is_active, caterer_id, caterers(name)')
    .in('caterer_id', catererIds)
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
