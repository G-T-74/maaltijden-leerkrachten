'use client'

import { useState, useEffect } from 'react'
import { getSchoolsWithDeadlines, updateSchoolDeadline } from '@/app/actions/admin'
import styles from './SchoolSettings.module.css'

type School = {
  id: string
  name: string
  order_deadline: string | null
}

export default function SchoolSettings() {
  const [schools, setSchools] = useState<School[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [successMsg, setSuccessMsg] = useState<string | null>(null)

  // Local state for editing deadlines
  const [deadlines, setDeadlines] = useState<Record<string, string>>({})
  const [savingId, setSavingId] = useState<string | null>(null)

  useEffect(() => {
    async function loadData() {
      const res = await getSchoolsWithDeadlines()
      if (res.error) {
        setError(res.error)
      } else if (res.schools) {
        setSchools(res.schools)
        const initialDeadlines: Record<string, string> = {}
        res.schools.forEach((s: School) => {
          // Format time to HH:MM if it has seconds
          let dl = s.order_deadline || '08:15:00'
          if (dl.split(':').length === 3) {
            dl = dl.substring(0, 5)
          }
          initialDeadlines[s.id] = dl
        })
        setDeadlines(initialDeadlines)
      }
      setLoading(false)
    }
    loadData()
  }, [])

  const handleDeadlineChange = (schoolId: string, val: string) => {
    setDeadlines(prev => ({ ...prev, [schoolId]: val }))
  }

  const handleSave = async (schoolId: string) => {
    setSavingId(schoolId)
    setError(null)
    setSuccessMsg(null)
    
    // Add seconds if not present because time type in PostgreSQL expects it
    let timeToSave = deadlines[schoolId]
    if (timeToSave.length === 5) {
      timeToSave += ':00'
    }

    const res = await updateSchoolDeadline(schoolId, timeToSave)
    if (res.error) {
      setError(res.error)
    } else {
      setSuccessMsg('Deadline succesvol opgeslagen.')
      setTimeout(() => setSuccessMsg(null), 3000)
    }
    setSavingId(null)
  }

  if (loading) return <div>Laden...</div>

  return (
    <div>
      <h2 style={{ fontSize: '1.5rem', fontWeight: 'bold', marginBottom: '1rem', color: 'var(--text-main)' }}>
        School Instellingen
      </h2>
      <p style={{ color: 'var(--text-muted)', marginBottom: '2rem' }}>
        Beheer hier de dagelijkse besteldeadline per school. Na dit uur kunnen leerkrachten geen maaltijden meer bestellen voor dezelfde dag.
      </p>

      {error && <div style={{ color: 'var(--primary)', marginBottom: '1rem' }}>{error}</div>}
      {successMsg && <div style={{ color: '#4ade80', marginBottom: '1rem' }}>{successMsg}</div>}

      <div className={styles.tableContainer}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>School</th>
              <th>Bestel Deadline</th>
              <th>Actie</th>
            </tr>
          </thead>
          <tbody>
            {schools.map(school => (
              <tr key={school.id}>
                <td>{school.name}</td>
                <td>
                  <input 
                    type="time" 
                    className={styles.input}
                    value={deadlines[school.id] || ''}
                    onChange={e => handleDeadlineChange(school.id, e.target.value)}
                  />
                </td>
                <td>
                  <button 
                    className={styles.btn}
                    onClick={() => handleSave(school.id)}
                    disabled={savingId === school.id}
                  >
                    {savingId === school.id ? 'Opslaan...' : 'Opslaan'}
                  </button>
                </td>
              </tr>
            ))}
            {schools.length === 0 && (
              <tr>
                <td colSpan={3} style={{ textAlign: 'center', color: 'var(--text-muted)' }}>
                  Geen scholen gevonden.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
