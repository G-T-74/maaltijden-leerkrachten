'use server'

import { createClient } from '@/utils/supabase/server'
import { headers } from 'next/headers'

export async function sendResetLink(formData: FormData) {
  const supabase = await createClient()
  const email = formData.get('email') as string
  const headersList = await headers()
  const host = headersList.get('x-forwarded-host') || headersList.get('host') || 'localhost:3000'
  const protocol = headersList.get('x-forwarded-proto') || (host.includes('localhost') ? 'http' : 'https')
  const origin = `${protocol}://${host}`

  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${origin}/auth/callback?next=/wachtwoord-resetten`,
  })

  if (error) {
    return { error: 'Er is een fout opgetreden bij het verzenden van de link.' }
  }

  return { success: 'Als dit e-mailadres bij ons bekend is, ontvang je binnen enkele minuten een link om je wachtwoord opnieuw in te stellen.' }
}
