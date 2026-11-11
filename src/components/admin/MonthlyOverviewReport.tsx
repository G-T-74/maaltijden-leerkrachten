'use client'

import { useState, useEffect, useMemo } from 'react'
import { createClient } from '@/utils/supabase/client'
import styles from './MonthlyOverviewReport.module.css'

interface StudentOrderItem {
  id: string
  order_date: string
  quantity: number
  price_at_order: number
  student_meals?: { name: string }
}

interface StudentBillingItem {
  studentId: string
  studentName: string
  classNumber: number | null
  className: string
  orders: StudentOrderItem[]
  total: number
  totalMeals: number
}

interface ClassBillingGroup {
  classId: string
  className: string
  level: string
  students: StudentBillingItem[]
  total: number
  totalMeals: number
}

export default function MonthlyOverviewReport({ schoolId }: { schoolId: string }) {
  const [month, setMonth] = useState<string>(() => {
    const d = new Date()
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
  })
  const [compactView, setCompactView] = useState(false)
  const [orders, setOrders] = useState<any[]>([])
  const [studentOrders, setStudentOrders] = useState<any[]>([])
  const [studentsMap, setStudentsMap] = useState<Record<string, { name: string, classNumber: number | null, classId: string, className: string, level: string }>>({})
  const [loading, setLoading] = useState(true)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [expandedClasses, setExpandedClasses] = useState<Record<string, boolean>>({})

  const supabase = createClient()

  // Reset uitgeklapte klassen bij verandering van maand of school (standaard samengevouwen)
  useEffect(() => {
    setExpandedClasses({})
  }, [month, schoolId])

  useEffect(() => {
    async function fetchMonthlyOrders() {
      if (!month) return
      setLoading(true)
      setErrorMsg(null)
      
      const [year, monthNum] = month.split('-')
      const startDate = `${year}-${monthNum}-01`
      const endDate = new Date(Number(year), Number(monthNum), 0).toISOString().split('T')[0]

      const { data, error } = await supabase
        .from('orders')
        .select(`
          id,
          order_date,
          quantity,
          price_at_order,
          note,
          profiles ( first_name, last_name ),
          meals ( name )
        `)
        .gte('order_date', startDate)
        .lte('order_date', endDate)
        .eq('school_id', schoolId)
        .order('order_date', { ascending: true })

      if (error) {
        console.error("Teacher orders error:", error)
        setErrorMsg(prev => (prev ? prev + ' | ' : '') + 'Teacher Orders Error: ' + error.message)
      }

      if (data) {
        setOrders(data)
      }

      // Haal studenten bestellingen en klassen op
      const { data: classes, error: classErr } = await supabase
        .from('classes')
        .select('id, name, level')
        .eq('school_id', schoolId)
        .order('name')
        
      if (classErr) {
        console.error("Classes error:", classErr)
        setErrorMsg(prev => (prev ? prev + ' | ' : '') + 'Classes Error: ' + classErr.message)
      }
        
      const classIds = classes?.map(c => c.id) || []
      let sOrders: any[] = []
      const sMap: Record<string, { name: string, classNumber: number | null, classId: string, className: string, level: string }> = {}

      if (classIds.length > 0) {
        const { data: students, error: studErr } = await supabase
          .from('students')
          .select('id, class_id, first_name, class_number')
          .in('class_id', classIds)
        
        if (studErr) {
          console.error("Students error:", studErr)
          setErrorMsg(prev => (prev ? prev + ' | ' : '') + 'Students Error: ' + studErr.message)
        }
        
        students?.forEach(s => {
          const cls = classes?.find(c => c.id === s.class_id)
          const parsedNum = s.class_number != null && !isNaN(Number(s.class_number)) ? Number(s.class_number) : null
          sMap[s.id] = {
            name: `${s.first_name || ''}`.trim() || 'Onbekend',
            classNumber: parsedNum,
            classId: s.class_id,
            className: cls?.name || 'Onbekend',
            level: cls?.level || 'lager'
          }
        })
        
        const studentIds = students?.map(s => s.id) || []
        if (studentIds.length > 0) {
          const { data, error: soErr } = await supabase
            .from('student_orders')
            .select(`
              id,
              order_date,
              quantity,
              price_at_order,
              student_id,
              student_meals ( name )
            `)
            .in('student_id', studentIds)
            .gte('order_date', startDate)
            .lte('order_date', endDate)
            .order('order_date', { ascending: true })
            
          if (soErr) {
            console.error("Student orders error:", soErr)
            setErrorMsg(prev => (prev ? prev + ' | ' : '') + 'Student Orders Error: ' + soErr.message)
          }
          sOrders = data || []
        }
      }

      setStudentOrders(sOrders)
      setStudentsMap(sMap)
      setLoading(false)
    }

    fetchMonthlyOrders()
  }, [month, schoolId])

  // Groepeer op leerkracht
  const groupedByTeacher = useMemo(() => {
    const grouped: Record<string, { name: string, orders: any[], total: number, totalMeals: number }> = {}
    
    orders.forEach(order => {
      const name = `${order.profiles?.first_name || ''} ${order.profiles?.last_name || ''}`.trim() || 'Onbekend'
      if (!grouped[name]) {
        grouped[name] = { name, orders: [], total: 0, totalMeals: 0 }
      }
      grouped[name].orders.push(order)
      const qty = order.quantity || 1
      grouped[name].total += qty * (order.price_at_order || 0)
      grouped[name].totalMeals += qty
    })

    // Sorteer op naam
    return Object.values(grouped).sort((a, b) => a.name.localeCompare(b.name))
  }, [orders])

  // Groepeer op klas en sorteer leerlingen oplopend op klasnummer
  const groupedByClass = useMemo(() => {
    const classMap: Record<string, ClassBillingGroup> = {}

    studentOrders.forEach(order => {
      const studentInfo = studentsMap[order.student_id]
      if (!studentInfo) return

      const classKey = studentInfo.classId || studentInfo.className
      if (!classMap[classKey]) {
        classMap[classKey] = {
          classId: studentInfo.classId,
          className: studentInfo.className,
          level: studentInfo.level,
          students: [],
          total: 0,
          totalMeals: 0
        }
      }

      let student = classMap[classKey].students.find(s => s.studentId === order.student_id)
      if (!student) {
        student = {
          studentId: order.student_id,
          studentName: studentInfo.name,
          classNumber: studentInfo.classNumber,
          className: studentInfo.className,
          orders: [],
          total: 0,
          totalMeals: 0
        }
        classMap[classKey].students.push(student)
      }

      student.orders.push(order)
      const lineQty = order.quantity || 1
      const lineTotal = lineQty * (order.price_at_order || 0)
      student.total += lineTotal
      student.totalMeals += lineQty

      classMap[classKey].total += lineTotal
      classMap[classKey].totalMeals += lineQty
    })

    // Sorteer leerlingen per klas: oplopend op klasnummer, daarna alfabetisch op naam
    const result = Object.values(classMap).map(group => {
      group.students.sort((a, b) => {
        if (a.classNumber !== null && b.classNumber !== null) {
          if (a.classNumber !== b.classNumber) return a.classNumber - b.classNumber
        } else if (a.classNumber !== null) {
          return -1
        } else if (b.classNumber !== null) {
          return 1
        }
        return a.studentName.localeCompare(b.studentName)
      })
      return group
    })

    // Sorteer klassen alfabetisch/numeriek op naam
    result.sort((a, b) => a.className.localeCompare(b.className, undefined, { numeric: true }))

    return result
  }, [studentOrders, studentsMap])

  // Totalen berekeningen
  const totalTeachersBilling = useMemo(() => {
    return groupedByTeacher.reduce((sum, t) => sum + t.total, 0)
  }, [groupedByTeacher])

  const totalTeacherMeals = useMemo(() => {
    return groupedByTeacher.reduce((sum, t) => sum + t.totalMeals, 0)
  }, [groupedByTeacher])

  const totalStudentsBilling = useMemo(() => {
    return groupedByClass.reduce((sum, g) => sum + g.total, 0)
  }, [groupedByClass])

  const totalStudentMeals = useMemo(() => {
    return groupedByClass.reduce((sum, g) => sum + g.totalMeals, 0)
  }, [groupedByClass])

  const grandTotalBilling = totalTeachersBilling + totalStudentsBilling
  const grandTotalMeals = totalTeacherMeals + totalStudentMeals

  const formattedMonth = useMemo(() => {
    try {
      const [y, m] = month.split('-')
      const d = new Date(Number(y), Number(m) - 1, 1)
      const str = d.toLocaleDateString('nl-BE', { month: 'long', year: 'numeric' })
      return str.charAt(0).toUpperCase() + str.slice(1)
    } catch {
      return month
    }
  }, [month])

  const toggleClass = (classKey: string) => {
    setExpandedClasses(prev => ({
      ...prev,
      [classKey]: !prev[classKey]
    }))
  }

  const expandAllClasses = () => {
    const all: Record<string, boolean> = {}
    groupedByClass.forEach(c => {
      all[c.classId || c.className] = true
    })
    setExpandedClasses(all)
  }

  const collapseAllClasses = () => {
    setExpandedClasses({})
  }

  return (
    <div className={styles.container}>
      {/* Koptekst & bediening */}
      <div className={styles.headerRow}>
        <div>
          <h2 className={styles.title}>Maandoverzicht (Facturatie)</h2>
          <div className={styles.monthSubtitle}>
            📅 {formattedMonth}
          </div>
        </div>
        
        <div className={styles.controls}>
          <div className={styles.monthGroup}>
            <label className={styles.monthLabel}>Selecteer Maand</label>
            <input 
              type="month" 
              value={month} 
              onChange={(e) => setMonth(e.target.value)}
              className={styles.monthInput}
            />
          </div>

          <label className={styles.checkboxLabel} style={{ alignSelf: 'flex-end', paddingBottom: '0.5rem' }}>
            <input 
              type="checkbox" 
              checked={compactView}
              onChange={(e) => setCompactView(e.target.checked)}
              style={{ width: 'auto', margin: 0 }}
            />
            <span>Beknopt overzicht (enkel totalen)</span>
          </label>

          <button 
            type="button" 
            onClick={() => window.print()} 
            className={styles.printBtn}
            style={{ alignSelf: 'flex-end' }}
            title="Overzicht afdrukken"
          >
            🖨️ Afdrukken
          </button>
        </div>
      </div>

      {errorMsg && (
        <div style={{ backgroundColor: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', padding: '1rem', borderRadius: '8px', border: '1px solid rgba(239, 68, 68, 0.2)' }}>
          <strong>Fout bij laden van gegevens:</strong> {errorMsg}
        </div>
      )}

      {/* KPI Overzichtskaarten */}
      <div className={styles.statsGrid}>
        <div className={styles.statCard}>
          <div className={`${styles.statIcon} ${styles.statIconStudents}`}>🧒</div>
          <div className={styles.statContent}>
            <span className={styles.statNumber}>€{totalStudentsBilling.toFixed(2)}</span>
            <span className={styles.statLabel}>Leerlingen ({totalStudentMeals} maaltijden)</span>
          </div>
        </div>

        <div className={styles.statCard}>
          <div className={styles.statIcon}>👩‍🏫</div>
          <div className={styles.statContent}>
            <span className={styles.statNumber}>€{totalTeachersBilling.toFixed(2)}</span>
            <span className={styles.statLabel}>Leerkrachten ({totalTeacherMeals} maaltijden)</span>
          </div>
        </div>

        <div className={styles.statCard}>
          <div className={`${styles.statIcon} ${styles.statIconTotal}`}>💰</div>
          <div className={styles.statContent}>
            <span className={styles.statNumber}>€{grandTotalBilling.toFixed(2)}</span>
            <span className={styles.statLabel}>Totaal Facturatie ({grandTotalMeals} maaltijden)</span>
          </div>
        </div>
      </div>

      {loading ? (
        <p style={{ color: 'var(--text-muted)', padding: '2rem 0' }}>Overzicht laden...</p>
      ) : groupedByTeacher.length === 0 && groupedByClass.length === 0 ? (
        <div className={styles.emptyState}>Geen bestellingen gevonden voor {formattedMonth}.</div>
      ) : compactView ? (
        /* ================= BEKNOPT OVERZICHT ================= */
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2.5rem' }}>
          
          {/* Facturatie Leerkrachten (Beknopt) */}
          <div className={styles.section}>
            <div className={styles.sectionHeader}>
              <h3 className={styles.sectionTitle}>
                <span>👩‍🏫</span> Facturatie Leerkrachten
              </h3>
              <span style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>
                Totaal: <strong>€{totalTeachersBilling.toFixed(2)}</strong> ({totalTeacherMeals} maaltijden)
              </span>
            </div>

            {groupedByTeacher.length === 0 ? (
              <div className={styles.emptyState}>Geen leerkrachtenbestellingen voor deze maand.</div>
            ) : (
              <div className={styles.tableWrapper}>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th>Naam Leerkracht</th>
                      <th className={styles.thCenter} style={{ width: '120px' }}>Aantal</th>
                      <th className={styles.thRight} style={{ width: '180px' }}>Te factureren bedrag</th>
                    </tr>
                  </thead>
                  <tbody>
                    {groupedByTeacher.map(teacher => (
                      <tr key={teacher.name} className={styles.trHover}>
                        <td style={{ fontWeight: 500 }}>{teacher.name}</td>
                        <td className={styles.tdCenter}>{teacher.totalMeals}</td>
                        <td className={styles.tdRight} style={{ fontWeight: 700 }}>€{teacher.total.toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className={styles.trFooter}>
                      <td>Totaal Leerkrachten</td>
                      <td className={styles.tdCenter}>{totalTeacherMeals}</td>
                      <td className={styles.tdRight}>€{totalTeachersBilling.toFixed(2)}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </div>
          
          {/* Facturatie Leerlingen (Beknopt: Gebundeld per klas) */}
          {groupedByClass.length > 0 && (
            <div className={styles.section}>
              <div className={styles.sectionHeader}>
                <h3 className={styles.sectionTitle}>
                  <span>🧒</span> Facturatie Leerlingen (per klas)
                </h3>
                <div className={styles.sectionActions}>
                  <button 
                    type="button" 
                    onClick={expandAllClasses} 
                    className={styles.actionBtn}
                  >
                    ▼ Alles uitklappen
                  </button>
                  <button 
                    type="button" 
                    onClick={collapseAllClasses} 
                    className={styles.actionBtn}
                  >
                    ▲ Alles inklappen
                  </button>
                </div>
              </div>

              <div className={styles.classList}>
                {groupedByClass.map(group => {
                  const classKey = group.classId || group.className
                  const isExpanded = !!expandedClasses[classKey]

                  return (
                    <div key={classKey} className={styles.classCard}>
                      <div 
                        className={`${styles.classHeader} ${isExpanded ? styles.classHeaderExpanded : ''}`}
                        onClick={() => toggleClass(classKey)}
                        title="Klik om klas in/uit te klappen"
                      >
                        <div className={styles.classHeaderLeft}>
                          <span className={`${styles.chevron} ${isExpanded ? styles.chevronRotated : ''}`}>▶</span>
                          <span className={styles.classTitle}>Klas {group.className}</span>
                          <span className={styles.classMeta}>
                            ({group.students.length} leerlingen • {group.totalMeals} maaltijden)
                          </span>
                        </div>
                        <div className={styles.classHeaderRight}>
                          <span className={styles.classTotalBadge}>€{group.total.toFixed(2)}</span>
                        </div>
                      </div>

                      {/* Uitgeklapte lijst met leerlingen van deze klas */}
                      {isExpanded && (
                        <div className={styles.classBody}>
                          <div className={styles.tableWrapper}>
                            <table className={styles.table}>
                              <thead>
                                <tr>
                                  <th style={{ width: '80px' }} className={styles.thCenter}>Nr.</th>
                                  <th>Naam Leerling</th>
                                  <th className={styles.thCenter} style={{ width: '120px' }}>Aantal</th>
                                  <th className={styles.thRight} style={{ width: '160px' }}>Te factureren bedrag</th>
                                </tr>
                              </thead>
                              <tbody>
                                {group.students.map((student) => (
                                  <tr key={student.studentId} className={styles.trHover}>
                                    <td className={styles.tdCenter}>
                                      <span className={styles.classNumberBadge}>
                                        {student.classNumber != null ? `#${student.classNumber}` : '-'}
                                      </span>
                                    </td>
                                    <td style={{ fontWeight: 500 }}>{student.studentName}</td>
                                    <td className={styles.tdCenter}>{student.totalMeals}</td>
                                    <td className={styles.tdRight} style={{ fontWeight: 700 }}>
                                      €{student.total.toFixed(2)}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                              <tfoot>
                                <tr className={styles.trFooter}>
                                  <td colSpan={2}>Subtotaal Klas {group.className}</td>
                                  <td className={styles.tdCenter}>{group.totalMeals}</td>
                                  <td className={styles.tdRight}>€{group.total.toFixed(2)}</td>
                                </tr>
                              </tfoot>
                            </table>
                          </div>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>

              {/* Totaalrij alle klassen */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', padding: '1rem', backgroundColor: 'var(--surface)', borderRadius: '8px', border: '1px solid var(--border)' }}>
                <span style={{ fontSize: '1.05rem', fontWeight: 600 }}>
                  Totaal alle klassen: <span style={{ color: 'var(--primary)', fontWeight: 700, fontSize: '1.15rem' }}>€{totalStudentsBilling.toFixed(2)}</span> ({totalStudentMeals} maaltijden)
                </span>
              </div>
            </div>
          )}
        </div>
      ) : (
        /* ================= STANDAARDWEERGAVE (GEDETAILLEERD) ================= */
        <div style={{ display: 'flex', flexDirection: 'column', gap: '3rem' }}>
          
          {/* Details Leerkrachten */}
          <div className={styles.section}>
            <div className={styles.sectionHeader}>
              <h3 className={styles.sectionTitle}>
                <span>👩‍🏫</span> Details Leerkrachten
              </h3>
              <span style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>
                Totaal: <strong>€{totalTeachersBilling.toFixed(2)}</strong> ({totalTeacherMeals} maaltijden)
              </span>
            </div>

            {groupedByTeacher.length === 0 ? (
              <div className={styles.emptyState}>Geen leerkrachtenbestellingen voor deze maand.</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                {groupedByTeacher.map(teacher => (
                  <div key={teacher.name} style={{ backgroundColor: 'var(--surface)', padding: '1.25rem', borderRadius: '8px', border: '1px solid var(--border)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem', borderBottom: '1px solid var(--border)', paddingBottom: '0.5rem' }}>
                      <h4 style={{ fontSize: '1.1rem', fontWeight: 'bold', margin: 0 }}>{teacher.name}</h4>
                      <div style={{ fontSize: '1.1rem', fontWeight: 'bold', color: 'var(--primary)' }}>
                        Totaal: €{teacher.total.toFixed(2)} ({teacher.totalMeals} maaltijd{teacher.totalMeals === 1 ? '' : 'en'})
                      </div>
                    </div>
                    
                    <div className={styles.tableWrapper}>
                      <table className={styles.table} style={{ fontSize: '0.9rem' }}>
                        <thead>
                          <tr>
                            <th style={{ width: '130px' }}>Datum</th>
                            <th>Maaltijd</th>
                            <th className={styles.thCenter} style={{ width: '80px' }}>Aantal</th>
                            <th>Opmerking</th>
                            <th className={styles.thRight} style={{ width: '100px' }}>Prijs</th>
                          </tr>
                        </thead>
                        <tbody>
                          {teacher.orders.map(order => (
                            <tr key={order.id} className={styles.trHover}>
                              <td>
                                {new Date(order.order_date + 'T00:00:00').toLocaleDateString('nl-BE')}
                              </td>
                              <td>{order.meals?.name || 'Onbekend'}</td>
                              <td className={styles.tdCenter}>{order.quantity}</td>
                              <td style={{ fontStyle: 'italic', color: 'var(--text-muted)' }}>
                                {order.note || '-'}
                              </td>
                              <td className={styles.tdRight}>
                                €{((order.quantity || 1) * (order.price_at_order || 0)).toFixed(2)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Details Leerlingen (Gebundeld per klas, standaard samengevouwen) */}
          {groupedByClass.length > 0 && (
            <div className={styles.section}>
              <div className={styles.sectionHeader}>
                <h3 className={styles.sectionTitle}>
                  <span>🧒</span> Details Leerlingen (per klas)
                </h3>
                <div className={styles.sectionActions}>
                  <button 
                    type="button" 
                    onClick={expandAllClasses} 
                    className={styles.actionBtn}
                  >
                    ▼ Alles uitklappen
                  </button>
                  <button 
                    type="button" 
                    onClick={collapseAllClasses} 
                    className={styles.actionBtn}
                  >
                    ▲ Alles inklappen
                  </button>
                </div>
              </div>

              <div className={styles.classList}>
                {groupedByClass.map(group => {
                  const classKey = group.classId || group.className
                  const isExpanded = !!expandedClasses[classKey]

                  return (
                    <div key={classKey} className={styles.classCard}>
                      <div 
                        className={`${styles.classHeader} ${isExpanded ? styles.classHeaderExpanded : ''}`}
                        onClick={() => toggleClass(classKey)}
                        title="Klik om klas in/uit te klappen"
                      >
                        <div className={styles.classHeaderLeft}>
                          <span className={`${styles.chevron} ${isExpanded ? styles.chevronRotated : ''}`}>▶</span>
                          <span className={styles.classTitle}>Klas {group.className}</span>
                          <span className={styles.classMeta}>
                            ({group.students.length} leerlingen • {group.totalMeals} maaltijden)
                          </span>
                        </div>
                        <div className={styles.classHeaderRight}>
                          <span className={styles.classTotalBadge}>€{group.total.toFixed(2)}</span>
                        </div>
                      </div>

                      {/* Uitgeklapte details per leerling in deze klas */}
                      {isExpanded && (
                        <div className={styles.classBody}>
                          <div className={styles.studentCardsList}>
                            {group.students.map(student => (
                              <div key={student.studentId} className={styles.studentDetailCard}>
                                <div className={styles.studentDetailHeader}>
                                  <div className={styles.studentNameTag}>
                                    <span className={styles.classNumberBadge}>
                                      {student.classNumber != null ? `#${student.classNumber}` : '-'}
                                    </span>
                                    <span>{student.studentName}</span>
                                    <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: 'normal' }}>
                                      ({student.className})
                                    </span>
                                  </div>
                                  <div className={styles.studentTotalAmount}>
                                    Totaal: €{student.total.toFixed(2)} ({student.totalMeals} maaltijd{student.totalMeals === 1 ? '' : 'en'})
                                  </div>
                                </div>
                                
                                <div className={styles.tableWrapper}>
                                  <table className={styles.table} style={{ fontSize: '0.9rem' }}>
                                    <thead>
                                      <tr>
                                        <th style={{ width: '130px' }}>Datum</th>
                                        <th>Maaltijd</th>
                                        <th className={styles.thCenter} style={{ width: '80px' }}>Aantal</th>
                                        <th className={styles.thRight} style={{ width: '100px' }}>Prijs</th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {student.orders.map(order => (
                                        <tr key={order.id} className={styles.trHover}>
                                          <td>
                                            {new Date(order.order_date + 'T00:00:00').toLocaleDateString('nl-BE')}
                                          </td>
                                          <td>{order.student_meals?.name || 'Onbekend'}</td>
                                          <td className={styles.tdCenter}>{order.quantity}</td>
                                          <td className={styles.tdRight}>
                                            €{((order.quantity || 1) * (order.price_at_order || 0)).toFixed(2)}
                                          </td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>

              {/* Totaalrij alle klassen */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', padding: '1rem', backgroundColor: 'var(--surface)', borderRadius: '8px', border: '1px solid var(--border)' }}>
                <span style={{ fontSize: '1.05rem', fontWeight: 600 }}>
                  Totaal alle klassen: <span style={{ color: 'var(--primary)', fontWeight: 700, fontSize: '1.15rem' }}>€{totalStudentsBilling.toFixed(2)}</span> ({totalStudentMeals} maaltijden)
                </span>
              </div>
            </div>
          )}

        </div>
      )}
    </div>
  )
}
