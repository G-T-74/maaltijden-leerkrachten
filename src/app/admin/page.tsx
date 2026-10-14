import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import AdminTabs from '@/components/admin/AdminTabs'

export default async function AdminPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'admin' && profile?.role !== 'superadmin') {
    redirect('/')
  }

  return (
    <main style={{ padding: '2rem 1.5rem', maxWidth: '1200px', margin: '0 auto' }}>
      <AdminTabs />
    </main>
  )
}
