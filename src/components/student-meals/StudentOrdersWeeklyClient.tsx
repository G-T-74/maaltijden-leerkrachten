'use client'

import { useState, useEffect } from 'react'
import { getTeacherClasses, getStudentOrderMatrixWeekly, saveStudentOrdersBulkWeekly } from '@/app/actions/student_order'
import styles from './StudentOrdersClient.module.css'

function getMonday(d: Date) {
  const date = new Date(d)
  const day = date.getDay()
  const diff = date.getDate() - day + (day === 0 ? -6 : 1) // adjust when day is sunday
  date.setDate(diff)
  return date
}

function getWeekDays(monday: Date) {
  const dates = []
  for (let i = 0; i < 5; i++) {
    const d = new Date(monday)
    d.setDate(monday.getDate() + i)
    // Skip Wednesday (2) - wait, getDay() returns 0 for Sunday, 1 for Monday, 2 for Tue, 3 for Wed
    if (d.getDay() !== 3) {
      dates.push(d.toISOString().split('T')[0])
    }
  }
  return dates
}

function formatDateDisplay(dateString: string) {
  return new Intl.DateTimeFormat('nl-BE', { weekday: 'short', day: 'numeric', month: 'numeric' }).format(new Date(dateString))
}

export default function StudentOrdersWeeklyClient({ activeSchoolId }: { activeSchoolId: string }) {
  const [classes, setClasses] = useState<any[]>([])
  const [activeClassId, setActiveClassId] = useState<string>('')
  
  // Base date mapped to Monday
  const [weekStart, setWeekStart] = useState<string>(getMonday(new Date()).toISOString().split('T')[0])
  const weekDates = getWeekDays(new Date(weekStart))

  const [loading, setLoading] = useState(true)
  const [students, setStudents] = useState<any[]>([])
  const [meals, setMeals] = useState<any[]>([])
  
  // Format: Record<student_id, Record<date, meal_id>>
  const [initialOrders, setInitialOrders] = useState<Record<string, Record<string, { id: string, meal_id: string }>>>({})
  const [currentOrders, setCurrentOrders] = useState<Record<string, Record<string, string>>>({}) 
  const [lockedDates, setLockedDates] = useState<string[]>([])
  
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<{type: 'error'|'success', text: string} | null>(null)

  // 1. Haal klassen op
  useEffect(() => {
    async function loadClasses() {
      const res = await getTeacherClasses()
      if (res.classes && res.classes.length > 0) {
        const filteredClasses = res.classes.filter((c: any) => c.school_id === activeSchoolId)
        setClasses(filteredClasses)
        if (filteredClasses.length > 0) {
          setActiveClassId(filteredClasses[0].id)
        }
      } else {
        setClasses([])
      }
      setLoading(false)
    }
    loadClasses()
  }, [activeSchoolId])

  // 2. Haal matrix op als class of week wijzigt
  useEffect(() => {
    if (!activeClassId || !weekStart) return
    loadMatrix()
  }, [activeClassId, weekStart])

  async function loadMatrix() {
    setLoading(true)
    setMessage(null)
    
    const selectedClass = classes.find(c => c.id === activeClassId)
    if (!selectedClass) return

    const res = await getStudentOrderMatrixWeekly(activeClassId, selectedClass.school_id, selectedClass.schools.caterer_id, weekDates)
    
    if (res.error) {
      setMessage({ type: 'error', text: res.error })
      setLoading(false)
      return
    }

    setStudents(res.students || [])
    setMeals(res.meals || [])
    setLockedDates(res.lockedDates || [])
    
    const initialObj: any = {}
    const currentObj: any = {}
    
    // Initialize empty structures
    res.students?.forEach((s: any) => {
      initialObj[s.id] = {}
      currentObj[s.id] = {}
      weekDates.forEach(d => {
        currentObj[s.id][d] = ''
      })
    })

    // Fill with actual orders
    if (res.orders) {
      res.orders.forEach((o: any) => {
        if (initialObj[o.student_id]) {
          initialObj[o.student_id][o.order_date] = { id: o.id, meal_id: o.student_meal_id }
          currentObj[o.student_id][o.order_date] = o.student_meal_id
        }
      })
    }

    setInitialOrders(initialObj)
    setCurrentOrders(currentObj)
    setLoading(false)
  }

  const handleDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedDate = new Date(e.target.value)
    if (!isNaN(selectedDate.getTime())) {
      setWeekStart(getMonday(selectedDate).toISOString().split('T')[0])
    }
  }

  const handleSelectChange = (studentId: string, date: string, mealId: string) => {
    if (lockedDates.includes(date)) return
    setCurrentOrders(prev => ({
      ...prev,
      [studentId]: {
        ...prev[studentId],
        [date]: mealId
      }
    }))
  }

  const handleCopyMonday = () => {
    if (weekDates.length === 0) return
    const monday = weekDates[0]
    
    setCurrentOrders(prev => {
      const next = { ...prev }
      students.forEach(student => {
        const mondayChoice = next[student.id][monday]
        weekDates.forEach(date => {
          if (!lockedDates.includes(date)) {
            next[student.id] = {
              ...next[student.id],
              [date]: mondayChoice
            }
          }
        })
      })
      return next
    })
    
    setMessage({ type: 'success', text: 'Maandag succesvol gekopieerd naar de rest van de week!' })
  }

  const handleSave = async () => {
    setSaving(true)
    setMessage(null)
    
    const selectedClass = classes.find(c => c.id === activeClassId)
    
    const toInsert: any[] = []
    const toDeleteIds: string[] = []

    students.forEach(student => {
      weekDates.forEach(date => {
        if (lockedDates.includes(date)) return // skip locked dates

        const initial = initialOrders[student.id]?.[date]
        const currentMealId = currentOrders[student.id]?.[date]

        if (initial && initial.meal_id !== currentMealId) {
          toDeleteIds.push(initial.id)
        }

        if (currentMealId && (!initial || initial.meal_id !== currentMealId)) {
          const meal = meals.find(m => m.id === currentMealId)
          if (meal) {
            const price = selectedClass?.level === 'kleuter' ? meal.price_kleuter : meal.price_lager
            toInsert.push({
              student_id: student.id,
              student_meal_id: currentMealId,
              order_date: date,
              quantity: 1,
              price_at_order: price
            })
          }
        }
      })
    })

    const res = await saveStudentOrdersBulkWeekly(toInsert, toDeleteIds)
    
    if (res.error) {
      setMessage({ type: 'error', text: res.error })
    } else {
      setMessage({ type: 'success', text: 'Weekbestellingen succesvol opgeslagen!' })
      loadMatrix()
    }
    setSaving(false)
  }

  if (loading && classes.length === 0) return <div>Laden...</div>

  if (classes.length === 0) {
    return (
      <div className={styles.emptyState}>
        <h2>Geen klassen gevonden</h2>
        <p>Je bent nog aan geen enkele klas gekoppeld. Contacteer de beheerder om klassen aan jouw profiel toe te wijzen.</p>
      </div>
    )
  }

  return (
    <div className={styles.container}>
      <div className={styles.matrixCard}>
        <div className={styles.matrixHeader}>
          <div className={styles.controlsBar}>
            <div className={styles.controlGroup}>
              <label>Kies Klas:</label>
              <div className={styles.classTiles}>
                {classes.map(c => (
                  <button 
                    key={c.id} 
                    className={`${styles.classTile} ${activeClassId === c.id ? styles.classTileActive : ''}`}
                    onClick={() => setActiveClassId(c.id)}
                  >
                    {c.name}
                  </button>
                ))}
              </div>
            </div>

            <div className={styles.controlGroup}>
              <label>
                Kies Week:
                <span style={{ fontWeight: 'normal', marginLeft: '0.5rem', color: 'var(--text-muted)' }}>
                  (Vanaf {formatDateDisplay(weekStart)})
                </span>
              </label>
              <input 
                type="date" 
                value={weekStart} 
                onChange={handleDateChange}
                className={styles.dateInput}
              />
            </div>
          </div>
          <div className={styles.headerActions} style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
            <button 
              onClick={handleCopyMonday} 
              disabled={saving}
              className={`${styles.btn} ${styles.btnSecondary}`}
            >
              ⟲ Vul rest vd week a.d.h.v. maandag
            </button>
            <button 
              onClick={handleSave} 
              disabled={saving}
              className={`${styles.btn} ${styles.btnPrimary}`}
            >
              {saving ? 'Opslaan...' : '💾 Bestellingen Opslaan'}
            </button>
          </div>
        </div>

        {message && (
          <div style={{ margin: '1.5rem 1.5rem 0' }} className={message.type === 'error' ? styles.alertError : styles.alertSuccess}>
            {message.text}
          </div>
        )}

        <div className={styles.tableWrapper}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th className={styles.thFixed}>Nr</th>
                <th className={styles.thFixed}>Naam</th>
                {weekDates.map(d => (
                  <th key={d} className={styles.thMeal}>
                    <div className={styles.mealName}>
                      {formatDateDisplay(d)}
                      {lockedDates.includes(d) && <span style={{display: 'block', fontSize: '0.75rem', color: '#ef4444'}}>Gesloten</span>}
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {students.map(student => (
                <tr key={student.id} className={styles.tr}>
                  <td className={styles.tdNum}>{student.class_number}</td>
                  <td className={styles.tdName}>{student.first_name}</td>
                  {weekDates.map(date => {
                    const isLocked = lockedDates.includes(date)
                    const val = currentOrders[student.id]?.[date] || ''
                    return (
                      <td key={date} className={styles.tdCheckbox} style={{ padding: '0.5rem' }}>
                        <select 
                          value={val}
                          onChange={(e) => handleSelectChange(student.id, date, e.target.value)}
                          disabled={isLocked}
                          style={{
                            width: '100%',
                            padding: '0.5rem',
                            borderRadius: '4px',
                            border: '1px solid var(--border)',
                            backgroundColor: isLocked ? 'var(--surface-hover)' : 'var(--background)',
                            color: 'var(--text-main)',
                            opacity: isLocked ? 0.7 : 1
                          }}
                        >
                          <option value="">- Geen -</option>
                          {meals.map(m => (
                            <option key={m.id} value={m.id}>{m.name}</option>
                          ))}
                        </select>
                      </td>
                    )
                  })}
                </tr>
              ))}
              {students.length === 0 && !loading && (
                <tr>
                  <td colSpan={weekDates.length + 2} style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                    Geen leerlingen gevonden in deze klas.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
