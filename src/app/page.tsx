import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import OrderForm from '@/components/OrderForm'
import OrderOverview from '@/components/OrderOverview'

export default async function Home() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  // Haal profiel info op (voor de rol)
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  const isAdmin = profile?.role === 'admin'

  const emailPart = user.email ? user.email.split('@')[0] : ''
  const firstName = emailPart ? emailPart.split('.')[0] : ''
  const capitalizedFirstName = firstName ? firstName.charAt(0).toUpperCase() + firstName.slice(1).toLowerCase() : ''

  // Check of de gebruiker al scholen heeft geselecteerd en haal details op
  const { data: userSchools } = await supabase
    .from('user_schools')
    .select(`
      school_id,
      schools (
        id,
        name,
        caterer_id,
        logo_url,
        order_deadline
      )
    `)
    .eq('user_id', user.id)

  if (!userSchools || userSchools.length === 0) {
    redirect('/profile')
  }
  
  // Format data for the OrderForm component
  const formattedSchools = userSchools.map((us: any) => ({
    school: us.schools
  }))

  // Haal de geplaatste bestellingen op (vandaag en in de toekomst, en de afgelopen 30 dagen)
  const thirtyDaysAgo = new Date()
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
  
  const { data: orders } = await supabase
    .from('orders')
    .select(`
      id,
      order_date,
      quantity,
      price_at_order,
      schools ( name ),
      meals ( id, name, category, caterer_id )
    `)
    .eq('user_id', user.id)
    .gte('order_date', thirtyDaysAgo.toISOString().split('T')[0])
    .order('order_date', { ascending: false })

  // Haal actieve maaltijden op voor inline-editing (voor de caterers van de geselecteerde scholen)
  const catererIds = [...new Set(formattedSchools.map(s => s.school.caterer_id).filter(Boolean))]
  let availableMeals: Record<string, any[]> = {}
  
  if (catererIds.length > 0) {
    const { data: meals } = await supabase
      .from('meals')
      .select('id, name, category, price, caterer_id')
      .in('caterer_id', catererIds)
      .eq('is_active', true)
      .order('category')
      .order('name')
      
    if (meals) {
      meals.forEach(meal => {
        if (!availableMeals[meal.caterer_id]) {
          availableMeals[meal.caterer_id] = []
        }
        availableMeals[meal.caterer_id].push(meal)
      })
    }
  }

  return (
    <main style={{ padding: '2rem', maxWidth: '800px', margin: '0 auto', position: 'relative' }}>
      <div style={{ position: 'absolute', top: '2rem', right: '2rem', display: 'flex', gap: '1.5rem', alignItems: 'center' }}>
        {isAdmin && (
          <a href="/admin" title="Naar Beheerdersdashboard" style={{ color: 'var(--text-main)' }}>
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/>
              <circle cx="12" cy="12" r="3"/>
            </svg>
          </a>
        )}
        <a href="/profile" title="Instellingen & Profiel" style={{ color: 'var(--text-main)' }}>
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
            <circle cx="12" cy="7" r="4"></circle>
          </svg>
        </a>
        <form action="/auth/signout" method="post" style={{ margin: 0, padding: 0, display: 'flex' }}>
          <button type="submit" title="Uitloggen" style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-main)', padding: 0 }}>
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
              <polyline points="16 17 21 12 16 7"></polyline>
              <line x1="21" y1="12" x2="9" y2="12"></line>
            </svg>
          </button>
        </form>
      </div>

      <h1 style={{ fontSize: '2rem', fontWeight: 'bold', marginBottom: '1rem' }}>
        Dashboard
      </h1>
      <p style={{ color: 'var(--text-muted)' }}>
        Welkom {capitalizedFirstName ? `${capitalizedFirstName}, je` : 'je'} bent succesvol ingelogd!
      </p>
      
      <OrderForm userSchools={formattedSchools} />
      
      <OrderOverview orders={(orders as any) || []} availableMeals={availableMeals} />

    </main>
  )
}
