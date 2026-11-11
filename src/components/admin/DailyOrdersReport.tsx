'use client'

import { useState, useEffect, Fragment } from 'react'
import { createClient } from '@/utils/supabase/client'
import { updateOrder, deleteOrder } from '@/app/actions/order'
import { getAdminMeals, getDailyStudentOrdersSummary } from '@/app/actions/admin'
import styles from './DailyOrdersReport.module.css'

interface StudentMeal {
  id: string
  name: string
}

interface SchoolClass {
  id: string
  name: string
}

interface StudentOrderDetail {
  studentName: string
  classNumber: number
  mealName: string
  quantity: number
}

interface StudentSummaryData {
  classes: SchoolClass[]
  meals: StudentMeal[]
  matrix: Record<string, Record<string, number>>
  classTotals: Record<string, number>
  mealTotals: Record<string, number>
  grandTotal: number
  studentDetailsByClass: Record<string, StudentOrderDetail[]>
}

export default function DailyOrdersReport({ schoolId, catererId }: { schoolId: string, catererId: string }) {
  const [date, setDate] = useState<string>(new Date().toISOString().split('T')[0])
  const [orders, setOrders] = useState<any[]>([])
  const [allMeals, setAllMeals] = useState<any[]>([])
  const [studentSummary, setStudentSummary] = useState<StudentSummaryData | null>(null)
  const [expandedClasses, setExpandedClasses] = useState<Record<string, boolean>>({})
  const [loading, setLoading] = useState(true)

  const [editingId, setEditingId] = useState<string | null>(null)
  const [editMealId, setEditMealId] = useState('')
  const [editQuantity, setEditQuantity] = useState(1)
  const [savingId, setSavingId] = useState<string | null>(null)

  const supabase = createClient()

  const fetchAllData = async () => {
    setLoading(true)
    try {
      // 1. Haal leerkracht maaltijd-opties op voor de bewerkings-dropdown
      const { meals } = await getAdminMeals(catererId)
      if (meals) {
        setAllMeals(meals)
      }

      // 2. Haal leerkracht-bestellingen op
      const { data: orderData } = await supabase
        .from('orders')
        .select(`
          id,
          quantity,
          price_at_order,
          meal_id,
          note,
          profiles ( first_name, last_name ),
          meals ( name, category )
        `)
        .eq('order_date', date)
        .eq('school_id', schoolId)

      if (orderData) {
        const sortedData = orderData.sort((a: any, b: any) => {
          const nameA = `${a.profiles?.first_name || ''} ${a.profiles?.last_name || ''}`.trim()
          const nameB = `${b.profiles?.first_name || ''} ${b.profiles?.last_name || ''}`.trim()
          return nameA.localeCompare(nameB)
        })
        setOrders(sortedData)
      } else {
        setOrders([])
      }

      // 3. Haal leerling-bestellingen samenvatting per klas op
      const studentRes = await getDailyStudentOrdersSummary(schoolId, catererId, date)
      if (studentRes && !('error' in studentRes)) {
        setStudentSummary(studentRes as StudentSummaryData)
      } else {
        setStudentSummary(null)
      }
    } catch (err) {
      console.error('Fout bij ophalen dagoverzicht data:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchAllData()
  }, [date, schoolId, catererId])

  const toggleClassDetails = (classId: string) => {
    setExpandedClasses(prev => ({
      ...prev,
      [classId]: !prev[classId]
    }))
  }

  const handleEdit = (order: any) => {
    setEditingId(order.id)
    setEditMealId(order.meal_id)
    setEditQuantity(order.quantity)
  }

  const handleCancelEdit = () => {
    setEditingId(null)
  }

  const handleSave = async (orderId: string) => {
    setSavingId(orderId)
    const formData = new FormData()
    formData.append('order_id', orderId)
    formData.append('meal_id', editMealId)
    formData.append('quantity', editQuantity.toString())

    const res = await updateOrder(formData)
    if (res.error) {
      alert(res.error)
    } else {
      setEditingId(null)
      fetchAllData()
    }
    setSavingId(null)
  }

  const handleDelete = async (orderId: string) => {
    if (!confirm('Weet je zeker dat je deze bestelling wilt verwijderen?')) return
    setSavingId(orderId)
    const res = await deleteOrder(orderId)
    if (res.error) {
      alert(res.error)
    } else {
      fetchAllData()
    }
    setSavingId(null)
  }

  const teacherTotalMeals = orders.reduce((sum, o) => sum + (o.quantity || 0), 0)
  const teacherTotalPrice = orders.reduce((sum, o) => sum + ((o.quantity || 0) * (o.price_at_order || 0)), 0)
  const studentTotalMeals = studentSummary?.grandTotal || 0
  const overallTotalMeals = teacherTotalMeals + studentTotalMeals

  const formattedDate = (() => {
    try {
      const d = new Date(date + 'T00:00:00')
      const str = d.toLocaleDateString('nl-BE', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
      return str.charAt(0).toUpperCase() + str.slice(1)
    } catch {
      return date
    }
  })()

  return (
    <div className={styles.container}>
      {/* Koptekst en datum-bediening */}
      <div className={styles.headerRow}>
        <div>
          <h2 className={styles.title}>Dagoverzicht</h2>
          <div style={{ color: 'var(--text-muted)', fontSize: '0.95rem', marginTop: '0.25rem' }}>
            📅 {formattedDate}
          </div>
        </div>

        <div className={styles.controls}>
          <div className={styles.dateGroup}>
            <label className={styles.dateLabel}>Datum selecteren</label>
            <input 
              type="date" 
              value={date} 
              onChange={(e) => setDate(e.target.value)}
              className={styles.dateInput}
            />
          </div>

          <button 
            type="button" 
            onClick={() => window.print()} 
            className={styles.printBtn}
            title="Overzicht afdrukken"
          >
            🖨️ Afdrukken
          </button>
        </div>
      </div>

      {/* KPI Overzichtskaarten */}
      <div className={styles.statsGrid}>
        <div className={styles.statCard}>
          <div className={`${styles.statIcon} ${styles.statIconStudents}`}>🧒</div>
          <div className={styles.statContent}>
            <span className={styles.statNumber}>{studentTotalMeals}</span>
            <span className={styles.statLabel}>Leerlingenmaaltijden</span>
          </div>
        </div>

        <div className={styles.statCard}>
          <div className={styles.statIcon}>👩‍🏫</div>
          <div className={styles.statContent}>
            <span className={styles.statNumber}>{teacherTotalMeals}</span>
            <span className={styles.statLabel}>Leerkrachtenmaaltijden</span>
          </div>
        </div>

        <div className={styles.statCard}>
          <div className={`${styles.statIcon} ${styles.statIconTotal}`}>🍽️</div>
          <div className={styles.statContent}>
            <span className={styles.statNumber}>{overallTotalMeals}</span>
            <span className={styles.statLabel}>Totaal Aantal Maaltijden</span>
          </div>
        </div>
      </div>

      {loading ? (
        <p style={{ color: 'var(--text-muted)', padding: '2rem 0' }}>Overzicht laden...</p>
      ) : (
        <>
          {/* SECTIE 1: BESTELLINGEN LEERLINGEN PER KLAS */}
          <section className={styles.section}>
            <div className={styles.sectionHeader}>
              <h3 className={styles.sectionTitle}>
                <span>🧒</span> Bestellingen Leerlingen (per klas)
              </h3>
              <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                Totaal: <strong>{studentTotalMeals}</strong> maaltijd{studentTotalMeals === 1 ? '' : 'en'}
              </span>
            </div>

            {!studentSummary || studentSummary.classes.length === 0 ? (
              <div className={styles.emptyState}>
                Geen klassen of leerlingen gevonden voor deze school.
              </div>
            ) : studentSummary.meals.length === 0 ? (
              <div className={styles.emptyState}>
                Geen actieve leerlingenmaaltijden geconfigureerd voor deze cateraar.
              </div>
            ) : (
              <div className={styles.tableWrapper}>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th style={{ minWidth: '140px' }}>Klas</th>
                      {studentSummary.meals.map(m => (
                        <th key={m.id} className={styles.thCenter}>{m.name}</th>
                      ))}
                      <th className={styles.thCenter} style={{ minWidth: '90px' }}>Totaal</th>
                      <th className={`${styles.thRight} no-print`} style={{ minWidth: '120px' }}>Details</th>
                    </tr>
                  </thead>
                  <tbody>
                    {studentSummary.classes.map(c => {
                      const classTotal = studentSummary.classTotals[c.id] || 0
                      const details = studentSummary.studentDetailsByClass[c.id] || []
                      const isExpanded = !!expandedClasses[c.id]

                      return (
                        <Fragment key={c.id}>
                          <tr className={styles.trHover}>
                            <td style={{ fontWeight: 600 }}>{c.name}</td>
                            {studentSummary.meals.map(m => {
                              const count = studentSummary.matrix[c.id]?.[m.id] || 0
                              return (
                                <td 
                                  key={m.id} 
                                  className={`${styles.tdCenter} ${count > 0 ? styles.cellActive : styles.cellZero}`}
                                >
                                  {count > 0 ? count : '-'}
                                </td>
                              )
                            })}
                            <td className={styles.tdCenter}>
                              <span className={`${styles.totalBadge} ${classTotal > 0 ? styles.totalBadgeActive : styles.totalBadgeZero}`}>
                                {classTotal}
                              </span>
                            </td>
                            <td className={`${styles.tdRight} no-print`}>
                              {details.length > 0 ? (
                                <button
                                  type="button"
                                  onClick={() => toggleClassDetails(c.id)}
                                  className={styles.expandBtn}
                                  title="Toon/verberg leerlingenlijst"
                                >
                                  {isExpanded ? '▲ Verberg' : `▼ Toon (${details.length})`}
                                </button>
                              ) : (
                                <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>-</span>
                              )}
                            </td>
                          </tr>

                          {/* Detailuitklaplijst voor leerlingen in deze klas */}
                          {isExpanded && details.length > 0 && (
                            <tr>
                              <td colSpan={studentSummary.meals.length + 3} className={styles.detailsBox}>
                                <div style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '0.5rem' }}>
                                  Leerlingen in {c.name}:
                                </div>
                                <div className={styles.detailsList}>
                                  {details.map((st, idx) => (
                                    <span key={idx} className={styles.studentPill}>
                                      <span className={styles.studentNumber}>#{st.classNumber}</span>
                                      <span>{st.studentName}</span>
                                      <span className={styles.studentMeal}>
                                        ({st.mealName}{st.quantity > 1 ? ` × ${st.quantity}` : ''})
                                      </span>
                                    </span>
                                  ))}
                                </div>
                              </td>
                            </tr>
                          )}
                        </Fragment>
                      )
                    })}
                  </tbody>
                  <tfoot>
                    <tr className={styles.trFooter}>
                      <td>Totaal alle klassen</td>
                      {studentSummary.meals.map(m => (
                        <td key={m.id} className={styles.tdCenter}>
                          {studentSummary.mealTotals[m.id] || 0}
                        </td>
                      ))}
                      <td className={styles.tdCenter}>
                        <span className={`${styles.totalBadge} ${studentTotalMeals > 0 ? styles.totalBadgeActive : styles.totalBadgeZero}`}>
                          {studentTotalMeals}
                        </span>
                      </td>
                      <td className="no-print"></td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </section>

          {/* SECTIE 2: BESTELLINGEN LEERKRACHTEN */}
          <section className={styles.section}>
            <div className={styles.sectionHeader}>
              <h3 className={styles.sectionTitle}>
                <span>👩‍🏫</span> Bestellingen Leerkrachten (individueel)
              </h3>
              <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                Totaal: <strong>{teacherTotalMeals}</strong> maaltijd{teacherTotalMeals === 1 ? '' : 'en'} (€{teacherTotalPrice.toFixed(2)})
              </span>
            </div>

            {orders.length === 0 ? (
              <div className={styles.emptyState}>
                Geen bestellingen gevonden voor leerkrachten op deze datum.
              </div>
            ) : (
              <div className={styles.tableWrapper}>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th style={{ minWidth: '150px' }}>Leerkracht</th>
                      <th style={{ minWidth: '160px' }}>Maaltijd</th>
                      <th className={styles.thCenter} style={{ width: '80px' }}>Aantal</th>
                      <th>Opmerking</th>
                      <th className={styles.thRight} style={{ width: '90px' }}>Prijs p.s.</th>
                      <th className={styles.thRight} style={{ width: '90px' }}>Totaal</th>
                      <th className={`${styles.thRight} no-print`} style={{ width: '130px' }}>Acties</th>
                    </tr>
                  </thead>
                  <tbody>
                    {orders.map(order => {
                      const name = `${order.profiles?.first_name || ''} ${order.profiles?.last_name || ''}`.trim() || 'Onbekend'
                      const total = ((order.quantity || 0) * (order.price_at_order || 0)).toFixed(2)
                      const isEditing = editingId === order.id

                      return (
                        <tr key={order.id} className={styles.trHover}>
                          <td style={{ fontWeight: 600 }}>{name}</td>
                          
                          {isEditing ? (
                            <>
                              <td>
                                <select 
                                  value={editMealId} 
                                  onChange={(e) => setEditMealId(e.target.value)}
                                  style={{ width: '100%', padding: '0.35rem', borderRadius: '4px', border: '1px solid var(--border)', backgroundColor: 'var(--background)', color: 'var(--text-main)' }}
                                >
                                  {allMeals.map(m => (
                                    <option key={m.id} value={m.id}>{m.name} (€{m.price.toFixed(2)})</option>
                                  ))}
                                </select>
                              </td>
                              <td className={styles.tdCenter}>
                                <input 
                                  type="number" 
                                  min="1" 
                                  value={editQuantity} 
                                  onChange={(e) => setEditQuantity(parseInt(e.target.value) || 1)}
                                  style={{ width: '60px', padding: '0.35rem', borderRadius: '4px', border: '1px solid var(--border)', backgroundColor: 'var(--background)', color: 'var(--text-main)', textAlign: 'center' }}
                                />
                              </td>
                              <td style={{ color: 'var(--text-muted)' }}>-</td>
                              <td style={{ color: 'var(--text-muted)' }} className={styles.tdRight}>-</td>
                              <td style={{ color: 'var(--text-muted)' }} className={styles.tdRight}>-</td>
                              <td className={`${styles.tdRight} no-print`}>
                                <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
                                  <button 
                                    onClick={() => handleSave(order.id)} 
                                    disabled={savingId === order.id}
                                    style={{ padding: '0.3rem 0.6rem', backgroundColor: 'var(--primary)', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '0.85rem' }}
                                  >
                                    Opslaan
                                  </button>
                                  <button 
                                    onClick={handleCancelEdit} 
                                    disabled={savingId === order.id}
                                    style={{ padding: '0.3rem 0.6rem', backgroundColor: 'var(--surface-hover)', color: 'var(--text-main)', border: '1px solid var(--border)', borderRadius: '4px', cursor: 'pointer', fontSize: '0.85rem' }}
                                  >
                                    Annuleer
                                  </button>
                                </div>
                              </td>
                            </>
                          ) : (
                            <>
                              <td>
                                {order.meals?.name} <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>({order.meals?.category})</span>
                              </td>
                              <td className={styles.tdCenter}>{order.quantity}</td>
                              <td style={{ fontStyle: 'italic', color: 'var(--text-muted)' }}>{order.note || '-'}</td>
                              <td className={styles.tdRight}>€{Number(order.price_at_order).toFixed(2)}</td>
                              <td className={styles.tdRight} style={{ fontWeight: 'bold' }}>€{total}</td>
                              <td className={`${styles.tdRight} no-print`}>
                                <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
                                  <button 
                                    onClick={() => handleEdit(order)} 
                                    disabled={savingId === order.id}
                                    style={{ padding: '0.25rem 0.5rem', backgroundColor: 'transparent', color: 'var(--text-main)', border: '1px solid var(--border)', borderRadius: '4px', cursor: 'pointer', fontSize: '0.8rem' }}
                                  >
                                    Wijzig
                                  </button>
                                  <button 
                                    onClick={() => handleDelete(order.id)} 
                                    disabled={savingId === order.id}
                                    style={{ padding: '0.25rem 0.5rem', backgroundColor: 'transparent', color: 'var(--primary)', border: '1px solid rgba(243, 53, 75, 0.3)', borderRadius: '4px', cursor: 'pointer', fontSize: '0.8rem' }}
                                  >
                                    Wis
                                  </button>
                                </div>
                              </td>
                            </>
                          )}
                        </tr>
                      )
                    })}
                  </tbody>
                  <tfoot>
                    <tr className={styles.trFooter}>
                      <td>Totaal Leerkrachten</td>
                      <td></td>
                      <td className={styles.tdCenter}>{teacherTotalMeals}</td>
                      <td></td>
                      <td></td>
                      <td className={styles.tdRight}>€{teacherTotalPrice.toFixed(2)}</td>
                      <td className="no-print"></td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </section>
        </>
      )}
    </div>
  )
}
