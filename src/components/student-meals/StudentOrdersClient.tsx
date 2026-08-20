'use client'

import { useState, useEffect } from 'react'
import { getTeacherClasses, getStudentOrderMatrix, saveStudentOrdersBulk, copyPreviousStudentOrders } from '@/app/actions/student_order'
import styles from './StudentOrdersClient.module.css'

export default function StudentOrdersClient({ activeSchoolId }: { activeSchoolId: string }) {
  const [classes, setClasses] = useState<any[]>([])
  const [activeClassId, setActiveClassId] = useState<string>('')
  const [date, setDate] = useState<string>(new Date().toISOString().split('T')[0])
  
  const [loading, setLoading] = useState(true)
  const [students, setStudents] = useState<any[]>([])
  const [meals, setMeals] = useState<any[]>([])
  const [initialOrders, setInitialOrders] = useState<any[]>([])
  const [currentOrders, setCurrentOrders] = useState<Record<string, string>>({}) // student_id -> meal_id
  const [isLocked, setIsLocked] = useState(false)
  
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<{type: 'error'|'success', text: string} | null>(null)

  // 1. Haal klassen op
  useEffect(() => {
    async function loadClasses() {
      const res = await getTeacherClasses()
      if (res.classes && res.classes.length > 0) {
        // Filter classes op de actieve school!
        const filteredClasses = res.classes.filter((c: any) => c.school_id === activeSchoolId)
        setClasses(filteredClasses)
        if (filteredClasses.length > 0) {
          setActiveClassId(filteredClasses[0].id)
        } else {
          setActiveClassId('')
        }
      } else {
        setClasses([])
        setActiveClassId('')
      }
      setLoading(false)
    }
    loadClasses()
  }, [activeSchoolId])

  // 2. Haal matrix op als class of date wijzigt
  useEffect(() => {
    if (!activeClassId || !date) return
    loadMatrix()
  }, [activeClassId, date])

  async function loadMatrix() {
    setLoading(true)
    setMessage(null)
    
    const selectedClass = classes.find(c => c.id === activeClassId)
    if (!selectedClass) return

    const res = await getStudentOrderMatrix(activeClassId, selectedClass.school_id, selectedClass.schools.caterer_id, date)
    
    if (res.error) {
      setMessage({ type: 'error', text: res.error })
    } else {
      setStudents(res.students || [])
      setMeals(res.meals || [])
      setIsLocked(res.isLocked || false)
      setInitialOrders(res.orders || [])
      
      // Bouw state object voor snelle rendering en aanpassingen
      const ordersState: Record<string, string> = {}
      res.orders?.forEach((o: any) => {
        ordersState[o.student_id] = o.student_meal_id
      })
      setCurrentOrders(ordersState)
    }
    setLoading(false)
  }

  const isWeekendOrWednesday = () => {
    const d = new Date(date)
    const day = d.getDay() // 0=Sun, 3=Wed, 6=Sat
    return day === 0 || day === 3 || day === 6
  }

  const handleCheckboxChange = (studentId: string, mealId: string) => {
    if (isLocked || isWeekendOrWednesday()) return

    setCurrentOrders(prev => {
      const newState = { ...prev }
      // Als deze maaltijd al was aangevinkt, vink hem dan uit
      if (newState[studentId] === mealId) {
        delete newState[studentId]
      } else {
        // Anders, vink deze aan (overschrijft eventuele vorige selectie)
        newState[studentId] = mealId
      }
      return newState
    })
  }

  const handleSave = async () => {
    setSaving(true)
    setMessage(null)
    
    const selectedClass = classes.find(c => c.id === activeClassId)
    
    // Bepaal welke orders nieuw/gewijzigd zijn, en welke weggewist moeten worden
    const toInsert = []
    const toDeleteIds = []

    // Check bestaande orders. Als ze niet meer in currentOrders staan, of een ander meal_id hebben -> delete id
    for (const initOrder of initialOrders) {
      if (currentOrders[initOrder.student_id] !== initOrder.student_meal_id) {
        toDeleteIds.push(initOrder.id)
      }
    }

    // Check current orders. Als ze nog niet in initialOrders stonden -> insert
    for (const [studentId, mealId] of Object.entries(currentOrders)) {
      const existing = initialOrders.find(o => o.student_id === studentId && o.student_meal_id === mealId)
      if (!existing) {
        const meal = meals.find(m => m.id === mealId)
        if (meal) {
          const price = selectedClass?.level === 'kleuter' ? meal.price_kleuter : meal.price_lager
          toInsert.push({
            student_id: studentId,
            student_meal_id: mealId,
            order_date: date,
            quantity: 1, // Standaard 1
            price_at_order: price
          })
        }
      }
    }

    const res = await saveStudentOrdersBulk(activeClassId, date, toInsert, toDeleteIds)
    
    if (res.error) {
      setMessage({ type: 'error', text: res.error })
    } else {
      setMessage({ type: 'success', text: 'Bestellingen succesvol opgeslagen!' })
      // Herlaad om verse ID's in initialOrders te hebben
      loadMatrix()
    }
    setSaving(false)
  }

  const handleCopyPrevious = async () => {
    if (!confirm('Let op: hiermee worden je huidige niet-opgeslagen wijzigingen voor deze datum gewist, en wordt de bestelling van de laatst ingevulde dag ingeladen. Doorgaan?')) return
    
    setLoading(true)
    const res = await copyPreviousStudentOrders(activeClassId, date)
    if (res.error) {
      setMessage({ type: 'error', text: res.error })
      setLoading(false)
    } else {
      setMessage({ type: 'success', text: `Succes: ${res.count} bestellingen overgenomen van de laatst ingevulde dag.` })
      loadMatrix()
    }
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

  const disabled = isLocked || isWeekendOrWednesday()

  return (
    <div className={styles.container}>
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
          <label>Kies Datum:</label>
          <input 
            type="date" 
            value={date} 
            onChange={e => setDate(e.target.value)}
            className={styles.dateInput}
          />
        </div>
      </div>

      {message && (
        <div className={message.type === 'error' ? styles.alertError : styles.alertSuccess}>
          {message.text}
        </div>
      )}

      {isWeekendOrWednesday() && (
        <div className={styles.alertWarning}>
          Op woensdag, zaterdag en zondag kunnen er geen maaltijden besteld worden.
        </div>
      )}

      {isLocked && (
        <div className={styles.alertWarning}>
          Deze dag is reeds afgesloten door de beheerder. Je kan geen wijzigingen meer doorvoeren.
        </div>
      )}

      <div className={styles.matrixCard}>
        <div className={styles.matrixHeader}>
          <h3>Bestelmatrix ({students.length} leerlingen)</h3>
          <div className={styles.headerActions}>
            <button 
              onClick={handleCopyPrevious} 
              disabled={disabled || saving}
              className={`${styles.btn} ${styles.btnSecondary}`}
            >
              ⟲ Laatst Ingevulde Dag Overnemen
            </button>
            <button 
              onClick={handleSave} 
              disabled={disabled || saving}
              className={`${styles.btn} ${styles.btnPrimary}`}
              style={initialOrders.length > 0 ? { backgroundColor: '#2e7d32', borderColor: '#1b5e20', color: 'white' } : {}}
            >
              {saving ? 'Opslaan...' : (initialOrders.length > 0 ? '💾 Bestelling Opgeslagen' : '💾 Bestelling Opslaan')}
            </button>
          </div>
        </div>

        <div className={styles.tableWrapper}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th className={styles.thFixed}>Nr</th>
                <th className={styles.thFixed}>Naam</th>
                {meals.map(m => (
                  <th key={m.id} className={styles.thMeal}>
                    <div className={styles.mealName}>{m.name}</div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {students.map(student => (
                <tr key={student.id} className={styles.tr}>
                  <td className={styles.tdNum}>{student.class_number}</td>
                  <td className={styles.tdName}>{student.first_name}</td>
                  {meals.map(m => {
                    const isChecked = currentOrders[student.id] === m.id
                    return (
                      <td 
                        key={m.id} 
                        className={styles.tdCheckbox}
                        onClick={() => handleCheckboxChange(student.id, m.id)}
                      >
                        <div className={`${styles.hitbox} ${isChecked ? styles.hitboxActive : ''} ${disabled ? styles.hitboxDisabled : ''}`}>
                          {isChecked && '✓'}
                        </div>
                      </td>
                    )
                  })}
                </tr>
              ))}
              {students.length === 0 && !loading && (
                <tr>
                  <td colSpan={meals.length + 2} style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>
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
