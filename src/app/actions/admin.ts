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
  if (!(await checkAdmin(supabase))) return { error: 'Geen toegang' }

  const { data, error } = await supabase
    .from('schools')
    .select('id, name, order_deadline')
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
  if (!(await checkAdmin(supabase))) return { error: 'Geen toegang' }

  const { data, error } = await supabase
    .from('caterers')
    .select('id, name')
    .order('name')

  if (error) return { error: error.message }
  return { caterers: data }
}

export async function getAdminMeals() {
  const supabase = await createClient()
  if (!(await checkAdmin(supabase))) return { error: 'Geen toegang' }

  const { data, error } = await supabase
    .from('meals')
    .select('id, name, category, price, is_active, caterer_id, caterers(name)')
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
