import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'

export default async function Home() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  // Als de gebruiker is ingelogd, sturen we ze direct naar de nieuwe startpagina: leerlingenmaaltijden
  redirect('/leerlingen')
}
