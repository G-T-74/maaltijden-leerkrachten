'use client'

import { useState, useEffect } from 'react'
import { 
  getSchoolsWithDeadlines, 
  updateSchoolDeadline, 
  updateSchoolStudentDeadline, 
  exportYearlyData, 
  resetSchoolYear,
  unlockDayForSchool,
  getActiveDayUnlocks,
  removeDayUnlock
} from '@/app/actions/admin'
import styles from './SchoolSettings.module.css'

type School = {
  id: string
  name: string
  order_deadline: string | null
  student_order_deadline?: string | null
  apply_toddler_factor: boolean
}

function getTodayBrussels() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Brussels' }).format(new Date())
}

function formatUnlockDate(dateStr: string) {
  try {
    const d = new Date(dateStr + 'T12:00:00')
    return new Intl.DateTimeFormat('nl-BE', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).format(d)
  } catch {
    return dateStr
  }
}

function formatOpenUntil(isoStr: string) {
  try {
    const target = new Date(isoStr)
    const now = new Date()
    const diffMs = target.getTime() - now.getTime()
    const diffMins = Math.round(diffMs / 60000)

    const timeStr = target.toLocaleTimeString('nl-BE', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Brussels' })
    const dateStr = target.toLocaleDateString('nl-BE', { day: 'numeric', month: 'numeric', timeZone: 'Europe/Brussels' })
    
    if (diffMins <= 0) {
      return `Verlopen om ${timeStr}`
    } else if (diffMins < 60) {
      return `Tot ${timeStr} (nog ${diffMins} min)`
    } else {
      const hours = Math.floor(diffMins / 60)
      const mins = diffMins % 60
      return `Tot ${dateStr} ${timeStr} (nog ${hours}u ${mins > 0 ? mins + 'm' : ''})`
    }
  } catch {
    return isoStr
  }
}

export default function SchoolSettings() {
  const [schools, setSchools] = useState<School[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [successMsg, setSuccessMsg] = useState<string | null>(null)

  // Local state for editing deadlines
  const [deadlines, setDeadlines] = useState<Record<string, string>>({})
  const [studentDeadlines, setStudentDeadlines] = useState<Record<string, string>>({})
  const [toddlerFactors, setToddlerFactors] = useState<Record<string, boolean>>({})
  const [savingId, setSavingId] = useState<string | null>(null)
  const [resettingId, setResettingId] = useState<string | null>(null)

  // Day unlocks state
  const [activeUnlocks, setActiveUnlocks] = useState<any[]>([])
  const [unlockSchoolId, setUnlockSchoolId] = useState<string>('')
  const [unlockDate, setUnlockDate] = useState<string>(getTodayBrussels())
  const [unlockDuration, setUnlockDuration] = useState<number>(30)
  const [showConfirmModal, setShowConfirmModal] = useState<boolean>(false)
  const [isSubmittingUnlock, setIsSubmittingUnlock] = useState<boolean>(false)
  const [removingUnlockId, setRemovingUnlockId] = useState<string | null>(null)
  const [unlockError, setUnlockError] = useState<string | null>(null)
  const [unlockSuccess, setUnlockSuccess] = useState<string | null>(null)
  
  // Controleer of we in de toegestane periode zitten (25 juni t.e.m. 15 juli)
  const now = new Date();
  const currentMonth = now.getMonth(); // 0=Jan, 5=Jun, 6=Jul
  const currentDay = now.getDate();
  const isResetAllowed = (currentMonth === 5 && currentDay >= 25) || (currentMonth === 6 && currentDay <= 15);

  const loadUnlocks = async () => {
    const res = await getActiveDayUnlocks()
    if (res.unlocks) {
      setActiveUnlocks(res.unlocks)
    }
  }

  useEffect(() => {
    async function loadData() {
      const res = await getSchoolsWithDeadlines()
      if (res.error) {
        setError(res.error)
      } else if (res.schools) {
        setSchools(res.schools)
        const initialDeadlines: Record<string, string> = {}
        const initialStudentDeadlines: Record<string, string> = {}
        const initialFactors: Record<string, boolean> = {}
        res.schools.forEach((s: School) => {
          // Format time to HH:MM if it has seconds
          let dl = s.order_deadline || '08:15:00'
          if (dl.split(':').length === 3) {
            dl = dl.substring(0, 5)
          }
          initialDeadlines[s.id] = dl

          let studentDl = s.student_order_deadline || '08:15:00'
          if (studentDl.split(':').length === 3) {
            studentDl = studentDl.substring(0, 5)
          }
          initialStudentDeadlines[s.id] = studentDl

          initialFactors[s.id] = s.apply_toddler_factor || false
        })
        setDeadlines(initialDeadlines)
        setStudentDeadlines(initialStudentDeadlines)
        setToddlerFactors(initialFactors)

        if (res.schools.length > 0) {
          setUnlockSchoolId(prev => prev || res.schools[0].id)
        }
      }
      setLoading(false)
    }
    loadData()
    loadUnlocks()
  }, [])

  useEffect(() => {
    const interval = setInterval(() => {
      loadUnlocks()
    }, 60000)
    return () => clearInterval(interval)
  }, [])


  const handleDeadlineChange = (schoolId: string, val: string) => {
    setDeadlines(prev => ({ ...prev, [schoolId]: val }))
  }

  const handleStudentDeadlineChange = (schoolId: string, val: string) => {
    setStudentDeadlines(prev => ({ ...prev, [schoolId]: val }))
  }

  const handleFactorChange = (schoolId: string, checked: boolean) => {
    setToddlerFactors(prev => ({ ...prev, [schoolId]: checked }))
  }

  const handleSave = async (schoolId: string) => {
    setSavingId(schoolId)
    setError(null)
    setSuccessMsg(null)
    
    // Add seconds if not present because time type in PostgreSQL expects it
    let timeToSave = deadlines[schoolId] || '08:15'
    if (timeToSave.length === 5) {
      timeToSave += ':00'
    }

    let studentTimeToSave = studentDeadlines[schoolId] || '08:15'
    if (studentTimeToSave.length === 5) {
      studentTimeToSave += ':00'
    }

    const resTeacher = await updateSchoolDeadline(schoolId, timeToSave)
    const resStudent = await updateSchoolStudentDeadline(schoolId, studentTimeToSave)
    
    // Also save the toddler factor
    const { updateSchoolToddlerFactor } = await import('@/app/actions/admin')
    const resFactor = await updateSchoolToddlerFactor(schoolId, toddlerFactors[schoolId])

    if (resTeacher.error || resStudent.error || resFactor.error) {
      setError(resTeacher.error || resStudent.error || resFactor.error || 'Er is een fout opgetreden.')
    } else {
      setSuccessMsg('Instellingen succesvol opgeslagen.')
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

  const isFutureDate = unlockDate > getTodayBrussels()

  const handleOpenConfirm = () => {
    if (!unlockSchoolId) {
      setUnlockError('Selecteer een school.')
      return
    }
    if (!unlockDate) {
      setUnlockError('Selecteer een datum.')
      return
    }
    setUnlockError(null)
    setShowConfirmModal(true)
  }

  const handleExecuteUnlock = async () => {
    setIsSubmittingUnlock(true)
    setUnlockError(null)
    setUnlockSuccess(null)

    const res = await unlockDayForSchool(unlockSchoolId, unlockDate, unlockDuration)
    if (res.error) {
      setUnlockError(res.error)
      setShowConfirmModal(false)
    } else {
      const schoolName = schools.find(s => s.id === unlockSchoolId)?.name || 'de geselecteerde school'
      setUnlockSuccess(`Dag succesvol opengesteld voor ${schoolName}!`)
      setShowConfirmModal(false)
      loadUnlocks()
      setTimeout(() => setUnlockSuccess(null), 5000)
    }
    setIsSubmittingUnlock(false)
  }

  const handleRemoveUnlock = async (id: string, schoolName: string, dateStr: string) => {
    if (!confirm(`Weet je zeker dat je de openstelling voor ${schoolName} op ${formatUnlockDate(dateStr)} nu wilt sluiten?`)) {
      return
    }
    setRemovingUnlockId(id)
    const res = await removeDayUnlock(id)
    if (res.error) {
      setUnlockError(res.error)
    } else {
      setUnlockSuccess('Openstelling succesvol beëindigd.')
      loadUnlocks()
      setTimeout(() => setUnlockSuccess(null), 3000)
    }
    setRemovingUnlockId(null)
  }

  if (loading) return <div>Laden...</div>


  return (
    <div>
      <h2 style={{ fontSize: '1.5rem', fontWeight: 'bold', marginBottom: '1rem', color: 'var(--text-main)' }}>
        School Instellingen
      </h2>
      <p style={{ color: 'var(--text-muted)', marginBottom: '2rem' }}>
        Beheer hier de dagelijkse besteldeadlines per school voor leerkrachten en leerlingen. Na dit uur kunnen geen maaltijden meer besteld of gewijzigd worden voor dezelfde dag.
      </p>

      {error && <div style={{ color: 'var(--primary)', marginBottom: '1rem' }}>{error}</div>}
      {successMsg && <div style={{ color: '#4ade80', marginBottom: '1rem' }}>{successMsg}</div>}

      <div className={styles.tableContainer}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>School</th>
              <th>deadline lkn</th>
              <th>deadline lln</th>
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
                  <input 
                    type="time" 
                    className={styles.input}
                    value={studentDeadlines[school.id] || ''}
                    onChange={e => handleStudentDeadlineChange(school.id, e.target.value)}
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
                <td colSpan={5} style={{ textAlign: 'center', color: 'var(--text-muted)' }}>
                  Geen scholen gevonden.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* 🔓 DAG OPNIEUW OPENSTELLEN */}
      <div className={styles.card}>
        <div className={styles.cardTitle}>
          <span>🔓</span>
          <h3>Dag (Opnieuw) Openstellen voor Bestellingen</h3>
        </div>
        <p className={styles.cardDescription}>
          Geef leerkrachten uitzonderlijk de mogelijkheid om maaltijden in te voeren of aan te passen na het verstrijken van de deadline.
          Dit kan voor vandaag zijn (wanneer leerkrachten te laat zijn), voor een datum in het verleden (ook woensdag), of voor een toekomstige dag.
        </p>

        {unlockError && (
          <div style={{ color: 'var(--primary)', marginBottom: '1rem', padding: '0.75rem', background: 'rgba(243, 53, 75, 0.1)', borderRadius: '6px' }}>
            {unlockError}
          </div>
        )}
        {unlockSuccess && (
          <div style={{ color: '#16a34a', marginBottom: '1rem', padding: '0.75rem', background: 'rgba(34, 197, 94, 0.1)', borderRadius: '6px' }}>
            {unlockSuccess}
          </div>
        )}

        <div className={styles.formGrid}>
          <div className={styles.formGroup}>
            <label>School:</label>
            <select 
              className={styles.select}
              value={unlockSchoolId}
              onChange={e => setUnlockSchoolId(e.target.value)}
            >
              {schools.map(s => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </div>

          <div className={styles.formGroup}>
            <label>Datum:</label>
            <input 
              type="date"
              className={styles.dateInput}
              value={unlockDate}
              onChange={e => setUnlockDate(e.target.value)}
            />
          </div>

          <div className={styles.formGroup}>
            <label>Duur van de openstelling:</label>
            {isFutureDate ? (
              <input 
                type="text" 
                className={styles.select} 
                disabled 
                value="Tot standaardsluitingsuur van die ochtend" 
              />
            ) : (
              <select 
                className={styles.select}
                value={unlockDuration}
                onChange={e => setUnlockDuration(Number(e.target.value))}
              >
                <option value={15}>15 minuten</option>
                <option value={30}>30 minuten (standaard)</option>
                <option value={60}>1 uur</option>
                <option value={120}>2 uur</option>
                <option value={-1}>Tot einde van de dag (23:59)</option>
              </select>
            )}
          </div>

          <div>
            <button 
              className={styles.btn}
              onClick={handleOpenConfirm}
              style={{ height: '42px', whiteSpace: 'nowrap' }}
            >
              Dag Openstellen
            </button>
          </div>
        </div>

        {isFutureDate && (
          <div className={styles.infoNote}>
            ℹ️ Aangezien de gekozen datum in de toekomst ligt, wordt automatisch het standaard sluitingsuur (bv. 08:15) op die ochtend gehanteerd.
          </div>
        )}

        {/* ACTIEVE OPENSTELLINGEN LIJST */}
        <div className={styles.activeTableContainer}>
          <div className={styles.activeTableTitle}>
            <span>🕒</span>
            <span>Momenteel actieve openstellingen ({activeUnlocks.length})</span>
          </div>

          {activeUnlocks.length === 0 ? (
            <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', fontStyle: 'italic' }}>
              Er zijn momenteel geen uitzonderlijke openstellingen actief.
            </p>
          ) : (
            <div className={styles.tableContainer}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>School</th>
                    <th>Betreft Datum</th>
                    <th>Status / Open Tot</th>
                    <th>Actie</th>
                  </tr>
                </thead>
                <tbody>
                  {activeUnlocks.map(u => (
                    <tr key={u.id}>
                      <td style={{ fontWeight: 600 }}>{u.schools?.name || 'Onbekend'}</td>
                      <td>{formatUnlockDate(u.unlock_date)}</td>
                      <td>
                        <span className={styles.badge}>
                          ● {formatOpenUntil(u.open_until)}
                        </span>
                      </td>
                      <td>
                        <button 
                          className={styles.btnDanger}
                          onClick={() => handleRemoveUnlock(u.id, u.schools?.name || 'School', u.unlock_date)}
                          disabled={removingUnlockId === u.id}
                        >
                          {removingUnlockId === u.id ? 'Bezig...' : 'Nu sluiten'}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* BEVESTIGINGSMODAL */}
      {showConfirmModal && (
        <div className={styles.modalOverlay}>
          <div className={styles.modal}>
            <h3 className={styles.modalTitle}>Bevestig Openstelling</h3>
            <div className={styles.modalBody}>
              <p>Weet je zeker dat je bestellingen wilt toelaten voor de volgende selectie?</p>
              <div className={styles.modalDetails}>
                <div>
                  <span>School:</span>
                  <span>{schools.find(s => s.id === unlockSchoolId)?.name}</span>
                </div>
                <div>
                  <span>Datum van de maaltijden:</span>
                  <span>{formatUnlockDate(unlockDate)}</span>
                </div>
                <div>
                  <span>Geldigheid:</span>
                  <span>
                    {isFutureDate 
                      ? 'Tot standaard sluitingsuur op die ochtend' 
                      : unlockDuration === -1 
                        ? 'Tot het einde van vandaag (23:59)' 
                        : `${unlockDuration} minuten`}
                  </span>
                </div>
              </div>
              <p style={{ fontSize: '0.85rem' }}>
                Leerkrachten van deze school kunnen gedurende deze periode maaltijden doorgeven of wijzigen voor de geselecteerde dag.
              </p>
            </div>
            <div className={styles.modalActions}>
              <button 
                className={styles.btnSecondary}
                onClick={() => setShowConfirmModal(false)}
                disabled={isSubmittingUnlock}
              >
                Annuleren
              </button>
              <button 
                className={styles.btn}
                onClick={handleExecuteUnlock}
                disabled={isSubmittingUnlock}
              >
                {isSubmittingUnlock ? 'Bezig met openstellen...' : 'Ja, Dag Openstellen'}
              </button>
            </div>
          </div>
        </div>
      )}

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
                    style={{ backgroundColor: 'var(--text-main)', color: 'var(--background)' }}
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
