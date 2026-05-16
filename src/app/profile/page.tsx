import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import { saveSchools } from './actions'
import styles from './profile.module.css'
import { ThemeToggle } from '@/components/ThemeToggle'

export default async function ProfilePage() {
  const supabase = await createClient()

  // Zorg ervoor dat de gebruiker is ingelogd
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const email = user.email || ''
  const emailPart = email.split('@')[0]
  const firstName = emailPart.split('.')[0]
  const capitalizedFirstName = firstName ? firstName.charAt(0).toUpperCase() + firstName.slice(1).toLowerCase() : ''

  // Haal profiel info op (voor de rol)
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  const isAdmin = profile?.role === 'admin'

  // Haal alle beschikbare scholen op
  const { data: schools } = await supabase
    .from('schools')
    .select('id, name')
    .order('name')

  // Haal eventueel al geselecteerde scholen op voor deze gebruiker
  const { data: userSchools } = await supabase
    .from('user_schools')
    .select('school_id')
    .eq('user_id', user.id)

  const selectedSchoolIds = userSchools?.map(us => us.school_id) || []

  return (
    <main className={styles.container}>
      <h1 className={styles.title}>Profiel</h1>
      
      <div style={{ marginBottom: '2rem', padding: '1.5rem', backgroundColor: 'var(--surface)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)' }}>
        <p style={{ marginBottom: '0.5rem' }}><strong>Voornaam:</strong> {capitalizedFirstName || 'Onbekend'}</p>
        <p><strong>E-mailadres:</strong> {email}</p>
      </div>

      <h2 style={{ fontSize: '1.25rem', fontWeight: 'bold', marginBottom: '1rem' }}>Weergave</h2>
      <ThemeToggle />

      <h2 style={{ fontSize: '1.25rem', fontWeight: 'bold', marginBottom: '1rem' }}>Gekoppelde scholen</h2>
      {isAdmin ? (
        <div style={{ padding: '1.5rem', backgroundColor: 'var(--surface)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)' }}>
          <p style={{ color: 'var(--text-muted)' }}>
            Als beheerder (admin) heb je automatisch toegang tot de overzichten van alle scholen en traiteurs. Het is niet nodig om jezelf aan specifieke scholen te koppelen.
          </p>
        </div>
      ) : (
        <>
          <p className={styles.description}>
            Vink de school of scholen aan waar je maaltijden wilt kunnen bestellen.
          </p>
          <form action={saveSchools} className={styles.form}>
            <div className={styles.schoolList}>
              {schools?.map((school) => (
                <label key={school.id} className={styles.schoolOption}>
                  <input
                    type="checkbox"
                    name="schools"
                    value={school.id}
                    defaultChecked={selectedSchoolIds.includes(school.id)}
                  />
                  <span className={styles.schoolName}>{school.name}</span>
                </label>
              ))}
              {(!schools || schools.length === 0) && (
                <p>Geen scholen gevonden. Voeg deze eerst toe in Supabase.</p>
              )}
            </div>
            
            <button type="submit" className={styles.submitBtn}>
              Opslaan
            </button>
          </form>
        </>
      )}
      
      <div style={{ marginTop: '2rem' }}>
        <a href="/" className="btn" style={{ backgroundColor: 'var(--surface)', color: 'var(--text-main)', border: '1px solid var(--border)' }}>
          Terug naar Dashboard
        </a>
      </div>
    </main>
  )
}
