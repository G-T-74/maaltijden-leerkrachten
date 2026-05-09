'use server'

import { createClient } from '@/utils/supabase/server'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

export async function saveSchools(formData: FormData) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  // Get selected school IDs
  const selectedSchools = formData.getAll('schools') as string[]

  if (selectedSchools.length === 0) {
    return { error: 'Selecteer minimaal één school.' }
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
    return { error: 'Fout bij het updaten van scholen.' }
  }

  // Insert new selections
  const { error: insertError } = await supabase
    .from('user_schools')
    .insert(userSchoolsData)

  if (insertError) {
    return { error: 'Fout bij het opslaan van scholen.' }
  }

  revalidatePath('/')
  redirect('/')
}
