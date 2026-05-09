import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import { saveSchools } from './actions'
import styles from './profile.module.css'

export default async function ProfilePage() {
  const supabase = await createClient()

  // Zorg ervoor dat de gebruiker is ingelogd
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

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
      <h1 className={styles.title}>Welkom! Kies je school</h1>
      <p className={styles.description}>
        Voordat je maaltijden kunt bestellen, moeten we weten aan welke school of scholen je verbonden bent.
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
          Opslaan en Verdergaan
        </button>
      </form>
    </main>
  )
}
