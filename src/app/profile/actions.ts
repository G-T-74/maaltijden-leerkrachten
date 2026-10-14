'use server'

import { createClient } from '@/utils/supabase/server'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { cookies } from 'next/headers'

export async function savePreferredCategory(category: string) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return { error: 'Niet ingelogd' }
  }

  const catToSave = category && category.trim().length > 0 ? category.trim() : null

  // Sla op in Supabase profile (als kolom bestaat)
  await supabase
    .from('profiles')
    .update({ default_meal_category: catToSave })
    .eq('id', user.id)

  // Sla ook op in cookie zodat het direct en altijd werkt
  const cookieStore = await cookies()
  if (catToSave) {
    cookieStore.set('defaultMealCategory', catToSave, { path: '/', maxAge: 60 * 60 * 24 * 365, sameSite: 'lax' })
  } else {
    cookieStore.delete('defaultMealCategory')
  }

  revalidatePath('/profile')
  revalidatePath('/mijn-maaltijden')
  return { success: true }
}

export async function saveSchools(formData: FormData) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  // Get selected school IDs
  const selectedSchools = formData.getAll('schools') as string[]

  if (selectedSchools.length === 0) {
    throw new Error('Selecteer minimaal één school.')
  }

  // Prepare insert data
  const userSchoolsData = selectedSchools.map(schoolId => ({
    user_id: user.id,
    school_id: schoolId
  }))

  // Delete existing selections (in case they are updating)
  const { error: deleteError } = await supabase
    .from('user_schools')
    .delete()
    .eq('user_id', user.id)

  if (deleteError) {
    throw new Error('Fout bij het updaten van scholen.')
  }

  // Insert new selections
  const { error: insertError } = await supabase
    .from('user_schools')
    .insert(userSchoolsData)

  if (insertError) {
    throw new Error('Fout bij het opslaan van scholen.')
  }

  revalidatePath('/')
  redirect('/')
}
