'use client'

import { useState, useEffect } from 'react'
import { getSchoolsWithDeadlines, updateSchoolDeadline, exportYearlyData, resetSchoolYear } from '@/app/actions/admin'
import styles from './SchoolSettings.module.css'

type School = {
  id: string
  name: string
  order_deadline: string | null
  apply_toddler_factor: boolean
}

export default function SchoolSettings() {
  const [schools, setSchools] = useState<School[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [successMsg, setSuccessMsg] = useState<string | null>(null)

  // Local state for editing deadlines
  const [deadlines, setDeadlines] = useState<Record<string, string>>({})
  const [toddlerFactors, setToddlerFactors] = useState<Record<string, boolean>>({})
  const [savingId, setSavingId] = useState<string | null>(null)
  const [resettingId, setResettingId] = useState<string | null>(null)
  
  // Controleer of we in de toegestane periode zitten (25 juni t.e.m. 15 juli)
  const now = new Date();
  const currentMonth = now.getMonth(); // 0=Jan, 5=Jun, 6=Jul
  const currentDay = now.getDate();
  const isResetAllowed = (currentMonth === 5 && currentDay >= 25) || (currentMonth === 6 && currentDay <= 15);

  useEffect(() => {
    async function loadData() {
      const res = await getSchoolsWithDeadlines()
      if (res.error) {
        setError(res.error)
      } else if (res.schools) {
        setSchools(res.schools)
        const initialDeadlines: Record<string, string> = {}
        const initialFactors: Record<string, boolean> = {}
        res.schools.forEach((s: School) => {
          // Format time to HH:MM if it has seconds
          let dl = s.order_deadline || '08:15:00'
          if (dl.split(':').length === 3) {
            dl = dl.substring(0, 5)
          }
          initialDeadlines[s.id] = dl
          initialFactors[s.id] = s.apply_toddler_factor || false
        })
        setDeadlines(initialDeadlines)
        setToddlerFactors(initialFactors)
      }
      setLoading(false)
    }
    loadData()
  }, [])

  const handleDeadlineChange = (schoolId: string, val: string) => {
    setDeadlines(prev => ({ ...prev, [schoolId]: val }))
  }

  const handleFactorChange = (schoolId: string, checked: boolean) => {
    setToddlerFactors(prev => ({ ...prev, [schoolId]: checked }))
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
    
    // Also save the toddler factor
    const { updateSchoolToddlerFactor } = await import('@/app/actions/admin')
    const resFactor = await updateSchoolToddlerFactor(schoolId, toddlerFactors[schoolId])

    if (res.error || resFactor.error) {
      setError(res.error || resFactor.error || 'Er is een fout opgetreden.')
    } else {
      setSuccessMsg('Deadline succesvol opgeslagen.')
      setTimeout(() => setSuccessMsg(null), 3000)
    }
    setSavingId(null)
  }

  const handleExport = async (schoolId: string, schoolName: string) => {
    try {
      setSuccessMsg('Export wordt gegenereerd...')
      const res = await exportYearlyData(schoolId)
      if (res.error) {
        setError(res.error)
        return
      }
      if (res.csv) {
        const blob = new Blob([res.csv], { type: 'text/csv;charset=utf-8;' })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.setAttribute('download', `Jaaroverzicht_${schoolName.replace(/\s+/g, '_')}_${new Date().getFullYear()}.csv`)
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
        setSuccessMsg('Export succesvol gedownload.')
        setTimeout(() => setSuccessMsg(null), 3000)
      }
    } catch (err: any) {
      setError(err.message || 'Fout bij export.')
    }
  }

  const handleReset = async (schoolId: string, schoolName: string) => {
    const userInput = prompt(`Gevaar! Je staat op het punt het schooljaar af te sluiten voor ${schoolName}. Dit verwijdert alle bestellingen en leerlingen (maar behoudt leerkrachten, maaltijden en klassen). Typ de naam van de school ("${schoolName}") om te bevestigen:`)
    if (userInput !== schoolName) {
      alert('Actie geannuleerd. Schoolnaam kwam niet overeen.')
      return
    }

    setResettingId(schoolId)
    setError(null)
    setSuccessMsg(null)

    const res = await resetSchoolYear(schoolId)
    if (res.error) {
      setError(res.error)
    } else {
      alert('Schooljaar succesvol afgesloten! Alle leerlingen en bestellingen zijn gewist.')
    }
    setResettingId(null)
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
              <th>Kleuterfactor (2/3) toepassen</th>
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
                  <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer', gap: '0.5rem' }}>
                    <input 
                      type="checkbox" 
                      checked={toddlerFactors[school.id] || false}
                      onChange={e => handleFactorChange(school.id, e.target.checked)}
                      style={{ width: '1.2rem', height: '1.2rem' }}
                    />
                    <span style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>Toepassen</span>
                  </label>
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
                <td colSpan={4} style={{ textAlign: 'center', color: 'var(--text-muted)' }}>
                  Geen scholen gevonden.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {isResetAllowed && (
        <div style={{ marginTop: '4rem', padding: '2rem', border: '1px solid var(--primary)', borderRadius: '8px', backgroundColor: 'rgba(255,59,48,0.05)' }}>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 'bold', marginBottom: '1rem', color: 'var(--primary)' }}>
            Gevaarlijke Acties (Schooljaar Afsluiten)
          </h2>
          <p style={{ color: 'var(--text-muted)', marginBottom: '1.5rem' }}>
            Deze acties zijn enkel zichtbaar tussen 25 juni en 15 juli. Download EERST het volledige jaaroverzicht voor de boekhouding. Sluit pas daarna het schooljaar af. Bij het afsluiten worden alle leerlingen en bestellingen permanent gewist. Klassen en leerkrachten blijven behouden.
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            {schools.map(school => (
              <div key={school.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1rem', backgroundColor: 'var(--surface)', borderRadius: '6px', border: '1px solid var(--border)' }}>
                <div style={{ fontWeight: 'bold', fontSize: '1.1rem' }}>{school.name}</div>
                <div style={{ display: 'flex', gap: '1rem' }}>
                  <button 
                    className={styles.btn} 
                    style={{ backgroundColor: 'var(--text-main)', color: 'var(--bg-main)' }}
                    onClick={() => handleExport(school.id, school.name)}
                  >
                    1. Download Jaaroverzicht (CSV)
                  </button>
                  <button 
                    className={styles.btn} 
                    style={{ backgroundColor: 'var(--primary)' }}
                    onClick={() => handleReset(school.id, school.name)}
                    disabled={resettingId === school.id}
                  >
                    {resettingId === school.id ? 'Bezig...' : '2. Schooljaar Resetten'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
