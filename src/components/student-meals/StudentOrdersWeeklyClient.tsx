'use client'

import { useState, useEffect } from 'react'
import { getTeacherClasses, getStudentOrderMatrixWeekly, saveStudentOrdersBulkWeekly, getLastFilledStudentOrdersForClass } from '@/app/actions/student_order'
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

  const handleFillFromLastFilledDay = async () => {
    if (weekDates.length === 0 || !activeClassId || students.length === 0) return

    // 1. Zoek eerst of er in de huidige week al dagen zijn ingevuld in currentOrders
    let sourceDate: string | null = null
    const reversedDates = [...weekDates].reverse()
    for (const d of reversedDates) {
      if (students.some(s => currentOrders[s.id]?.[d])) {
        sourceDate = d
        break
      }
    }

    let sourceOrders: Record<string, string> = {}

    if (sourceDate) {
      // Gebruik de laatst ingevulde dag binnen de huidige weergave
      students.forEach(s => {
        sourceOrders[s.id] = currentOrders[s.id]?.[sourceDate!] || ''
      })
    } else {
      // 2. Als er in de huidige week nog niets is ingevuld, haal de laatste dag op uit de database
      setSaving(true)
      const selectedClass = classes.find(c => c.id === activeClassId)
      const catererId = selectedClass?.schools?.caterer_id
      const res = await getLastFilledStudentOrdersForClass(activeClassId, catererId, weekDates[0])
      setSaving(false)

      if (res.error) {
        setMessage({ type: 'error', text: res.error })
        return
      }

      sourceDate = res.date
      sourceOrders = res.orders || {}
    }

    if (!sourceDate) {
      setMessage({ type: 'error', text: 'Geen eerdere bestellingen gevonden om over te nemen.' })
      return
    }

    // Vul alle openstaande/ontgrendelde dagen van de week in met deze keuzes
    setCurrentOrders(prev => {
      const next = { ...prev }
      students.forEach(student => {
        const choice = sourceOrders[student.id] || ''
        weekDates.forEach(date => {
          if (!lockedDates.includes(date)) {
            if (!next[student.id]) next[student.id] = {}
            next[student.id] = {
              ...next[student.id],
              [date]: choice
            }
          }
        })
      })
      return next
    })

    setMessage({ 
      type: 'success', 
      text: `Week ingevuld a.d.h.v. ${formatDateDisplay(sourceDate)}. Bevestig door op "Wijzigingen opslaan" te klikken.` 
    })
  }

  const handleFillAllWarm = () => {
    if (weekDates.length === 0 || students.length === 0) return

    // Zoek warme maaltijd (bijv. maaltijd met "warm" in de naam)
    const warmMeal = meals.find(m => m.name.toLowerCase().includes('warm')) || meals[0]
    if (!warmMeal) {
      setMessage({ type: 'error', text: 'Geen maaltijden gevonden om in te vullen.' })
      return
    }

    setCurrentOrders(prev => {
      const next = { ...prev }
      students.forEach(student => {
        weekDates.forEach(date => {
          if (!lockedDates.includes(date)) {
            if (!next[student.id]) next[student.id] = {}
            next[student.id] = {
              ...next[student.id],
              [date]: warmMeal.id
            }
          }
        })
      })
      return next
    })

    setMessage({ 
      type: 'success', 
      text: `Hele week warm ("${warmMeal.name}") ingevuld voor alle leerlingen. Bevestig door op "Wijzigingen opslaan" te klikken.` 
    })
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

  // Check of er niet-opgeslagen wijzigingen zijn in de week
  const hasUnsavedChanges = (() => {
    for (const student of students) {
      for (const date of weekDates) {
        if (lockedDates.includes(date)) continue
        const cur = currentOrders[student.id]?.[date] || ''
        const init = initialOrders[student.id]?.[date]?.meal_id || ''
        if (cur !== init) return true
      }
    }
    return false
  })()

  const hasAnySavedOrders = Object.values(initialOrders).some(dayOrders => 
    Object.values(dayOrders).some((o: any) => o && o.meal_id)
  )

  const isAllSaved = hasAnySavedOrders && !hasUnsavedChanges

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
          <div className={styles.headerActions} style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', justifyContent: 'flex-end', alignItems: 'center' }}>
            <button 
              type="button"
              onClick={handleFillFromLastFilledDay} 
              disabled={saving}
              className={`${styles.btn} ${styles.btnSecondary}`}
              title="Vul alle openstaande dagen van deze week in a.d.h.v. de laatst ingevulde dag"
            >
              ⟲ Week invullen a.d.h.v. laatst ingevulde dag
            </button>
            <button 
              type="button"
              onClick={handleFillAllWarm} 
              disabled={saving}
              className={`${styles.btn} ${styles.btnSecondary}`}
              title="Vul alle openstaande dagen voor alle leerlingen in met warme maaltijd"
            >
              🍲 Hele week warm invullen
            </button>
            <button 
              type="button"
              onClick={handleSave} 
              disabled={saving}
              className={`${styles.btn} ${styles.btnPrimary}`}
              style={isAllSaved ? { backgroundColor: '#2e7d32', borderColor: '#1b5e20', color: 'white' } : {}}
            >
              {saving ? 'Opslaan...' : (isAllSaved ? '💾 Bestellingen Opgeslagen' : '💾 Wijzigingen Opslaan')}
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
                    const initialMealId = initialOrders[student.id]?.[date]?.meal_id || ''
                    const isSelected = !!val
                    const isSaved = isSelected && val === initialMealId

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
                            border: isSelected 
                              ? (isSaved ? '2px solid #2e7d32' : '2px solid var(--primary)') 
                              : '1px solid var(--border)',
                            backgroundColor: isLocked 
                              ? 'var(--surface-hover)' 
                              : (isSelected 
                                  ? (isSaved ? 'rgba(46, 125, 50, 0.12)' : 'var(--primary-glow)') 
                                  : 'var(--background)'),
                            color: isLocked 
                              ? 'var(--text-muted)' 
                              : (isSelected 
                                  ? (isSaved ? '#166534' : 'var(--primary)') 
                                  : 'var(--text-main)'),
                            fontWeight: isSelected ? 600 : 400,
                            opacity: isLocked ? 0.7 : 1,
                            transition: 'all 0.2s'
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
