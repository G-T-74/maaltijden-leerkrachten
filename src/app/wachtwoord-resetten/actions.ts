'use server'

import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'

export async function resetPassword(formData: FormData) {
  const supabase = await createClient()
  const password = formData.get('password') as string

  const { error } = await supabase.auth.updateUser({
    password: password
  })

  if (error) {
    return { error: 'Er is een fout opgetreden bij het bijwerken van je wachtwoord.' }
  }

  // Update successful, log user in basically by redirecting them to the app
  revalidatePath('/', 'layout')
  redirect('/mijn-maaltijden')
}
