'use client'

import { useState, useEffect, useMemo } from 'react'
import { createClient } from '@/utils/supabase/client'

export default function MonthlyOverviewReport({ schoolId }: { schoolId: string }) {
  const [month, setMonth] = useState<string>(() => {
    const d = new Date()
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
  })
  const [compactView, setCompactView] = useState(false)
  const [orders, setOrders] = useState<any[]>([])
  const [studentOrders, setStudentOrders] = useState<any[]>([])
  const [studentsMap, setStudentsMap] = useState<Record<string, { name: string, className: string, level: string }>>({})
  const [loading, setLoading] = useState(true)

  const supabase = createClient()

  useEffect(() => {
    async function fetchMonthlyOrders() {
      if (!month) return
      setLoading(true)
      
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
          profiles ( first_name, last_name ),
          meals ( name )
        `)
        .gte('order_date', startDate)
        .lte('order_date', endDate)
        .eq('school_id', schoolId)
        .order('order_date', { ascending: true })

      if (data) {
        setOrders(data)
      }

      // Haal studenten bestellingen op
      const { data: classes } = await supabase
        .from('classes')
        .select('id, name, level')
        .eq('school_id', schoolId)
        
      const classIds = classes?.map(c => c.id) || []
      let sOrders: any[] = []
      let sMap: Record<string, { name: string, className: string, level: string }> = {}

      if (classIds.length > 0) {
        const { data: students } = await supabase
          .from('students')
          .select('id, class_id, first_name, last_name')
          .in('class_id', classIds)
        
        students?.forEach(s => {
          const cls = classes?.find(c => c.id === s.class_id)
          sMap[s.id] = {
            name: `${s.first_name || ''} ${s.last_name || ''}`.trim() || 'Onbekend',
            className: cls?.name || 'Onbekend',
            level: cls?.level || 'lager'
          }
        })
        
        const studentIds = students?.map(s => s.id) || []
        if (studentIds.length > 0) {
          const { data } = await supabase
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
    const grouped: Record<string, { name: string, orders: any[], total: number }> = {}
    
    orders.forEach(order => {
      const name = `${order.profiles?.first_name || ''} ${order.profiles?.last_name || ''}`.trim() || 'Onbekend'
      if (!grouped[name]) {
        grouped[name] = { name, orders: [], total: 0 }
      }
      grouped[name].orders.push(order)
      grouped[name].total += order.quantity * order.price_at_order
    })

    // Sorteer op naam
    return Object.values(grouped).sort((a, b) => a.name.localeCompare(b.name))
  }, [orders])

  // Groepeer op leerling
  const groupedByStudent = useMemo(() => {
    const grouped: Record<string, { className: string, studentName: string, orders: any[], total: number }> = {}
    
    studentOrders.forEach(order => {
      const studentInfo = studentsMap[order.student_id]
      if (!studentInfo) return
      
      const key = `${studentInfo.className}_${order.student_id}`
      if (!grouped[key]) {
        grouped[key] = { className: studentInfo.className, studentName: studentInfo.name, orders: [], total: 0 }
      }
      grouped[key].orders.push(order)
      grouped[key].total += order.quantity * order.price_at_order
    })
    
    // Sort by class name, then student name
    return Object.values(grouped).sort((a, b) => {
      if (a.className !== b.className) return a.className.localeCompare(b.className)
      return a.studentName.localeCompare(b.studentName)
    })
  }, [studentOrders, studentsMap])

  return (
    <div>
      <h2 style={{ fontSize: '1.5rem', fontWeight: 'bold', marginBottom: '1rem' }}>Maandoverzicht (Facturatie)</h2>
      
      <div className="no-print" style={{ marginBottom: '2rem', display: 'flex', flexWrap: 'wrap', gap: '1.5rem', alignItems: 'flex-end' }}>
        <div>
          <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>Selecteer Maand</label>
          <input 
            type="month" 
            value={month} 
            onChange={(e) => setMonth(e.target.value)}
            className="input"
            style={{ maxWidth: '300px' }}
          />
        </div>
        <div style={{ paddingBottom: '0.5rem' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
            <input 
              type="checkbox" 
              checked={compactView}
              onChange={(e) => setCompactView(e.target.checked)}
              style={{ width: 'auto', margin: 0 }}
            />
            <span style={{ fontWeight: 500 }}>Toon beknopt overzicht (enkel totalen)</span>
          </label>
        </div>
      </div>

      {loading ? (
        <p>Laden...</p>
      ) : groupedByTeacher.length === 0 && groupedByStudent.length === 0 ? (
        <p style={{ color: 'var(--text-muted)' }}>Geen bestellingen gevonden voor deze maand.</p>
      ) : compactView ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
          <div>
            <h3 style={{ fontSize: '1.2rem', fontWeight: 'bold', marginBottom: '1rem', color: 'var(--text-main)' }}>Facturatie Leerkrachten</h3>
            <div style={{ overflowX: 'auto', backgroundColor: 'var(--surface)', padding: '1.5rem', borderRadius: '8px', border: '1px solid var(--border)' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
            <thead>
              <tr style={{ borderBottom: '2px solid var(--border)' }}>
                <th style={{ padding: '1rem', color: 'var(--text-muted)' }}>Naam Leerkracht</th>
                <th style={{ padding: '1rem', color: 'var(--text-muted)', textAlign: 'right' }}>Te factureren bedrag</th>
              </tr>
            </thead>
            <tbody>
              {groupedByTeacher.map(teacher => (
                <tr key={teacher.name} style={{ borderBottom: '1px solid var(--border)' }}>
                  <td style={{ padding: '1rem', fontWeight: '500' }}>{teacher.name}</td>
                  <td style={{ padding: '1rem', fontWeight: 'bold', textAlign: 'right' }}>€{teacher.total.toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
          
          {groupedByStudent.length > 0 && (
            <div>
              <h3 style={{ fontSize: '1.2rem', fontWeight: 'bold', marginBottom: '1rem', color: 'var(--text-main)' }}>Facturatie Leerlingen</h3>
              <div style={{ overflowX: 'auto', backgroundColor: 'var(--surface)', padding: '1.5rem', borderRadius: '8px', border: '1px solid var(--border)' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                  <thead>
                    <tr style={{ borderBottom: '2px solid var(--border)' }}>
                      <th style={{ padding: '1rem', color: 'var(--text-muted)' }}>Klas</th>
                      <th style={{ padding: '1rem', color: 'var(--text-muted)' }}>Naam Leerling</th>
                      <th style={{ padding: '1rem', color: 'var(--text-muted)', textAlign: 'right' }}>Te factureren bedrag</th>
                    </tr>
                  </thead>
                  <tbody>
                    {groupedByStudent.map((student, idx) => (
                      <tr key={idx} style={{ borderBottom: '1px solid var(--border)' }}>
                        <td style={{ padding: '1rem', fontWeight: '500' }}>{student.className}</td>
                        <td style={{ padding: '1rem' }}>{student.studentName}</td>
                        <td style={{ padding: '1rem', fontWeight: 'bold', textAlign: 'right' }}>€{student.total.toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '3rem' }}>
          
          <div>
            <h3 style={{ fontSize: '1.2rem', fontWeight: 'bold', marginBottom: '1rem', color: 'var(--text-main)', borderBottom: '2px solid var(--border)', paddingBottom: '0.5rem' }}>Details Leerkrachten</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
          {groupedByTeacher.map(teacher => (
            <div key={teacher.name} style={{ backgroundColor: 'var(--surface)', padding: '1.5rem', borderRadius: '8px', border: '1px solid var(--border)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', borderBottom: '1px solid var(--border)', paddingBottom: '0.5rem' }}>
                <h3 style={{ fontSize: '1.2rem', fontWeight: 'bold' }}>{teacher.name}</h3>
                <div style={{ fontSize: '1.2rem', fontWeight: 'bold', color: 'var(--primary)' }}>
                  Totaal: €{teacher.total.toFixed(2)}
                </div>
              </div>
              
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.9rem' }}>
                <thead>
                  <tr>
                    <th style={{ padding: '0.5rem', color: 'var(--text-muted)' }}>Datum</th>
                    <th style={{ padding: '0.5rem', color: 'var(--text-muted)' }}>Maaltijd</th>
                    <th style={{ padding: '0.5rem', color: 'var(--text-muted)' }}>Aantal</th>
                    <th style={{ padding: '0.5rem', color: 'var(--text-muted)' }}>Prijs</th>
                  </tr>
                </thead>
                <tbody>
                  {teacher.orders.map(order => (
                    <tr key={order.id}>
                      <td style={{ padding: '0.5rem', borderBottom: '1px solid var(--border)' }}>
                        {new Date(order.order_date).toLocaleDateString('nl-BE')}
                      </td>
                      <td style={{ padding: '0.5rem', borderBottom: '1px solid var(--border)' }}>
                        {order.meals?.name}
                      </td>
                      <td style={{ padding: '0.5rem', borderBottom: '1px solid var(--border)' }}>
                        {order.quantity}
                      </td>
                      <td style={{ padding: '0.5rem', borderBottom: '1px solid var(--border)' }}>
                        €{(order.quantity * order.price_at_order).toFixed(2)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}
          </div>
          </div>

          {groupedByStudent.length > 0 && (
            <div>
              <h3 style={{ fontSize: '1.2rem', fontWeight: 'bold', marginBottom: '1rem', color: 'var(--text-main)', borderBottom: '2px solid var(--border)', paddingBottom: '0.5rem' }}>Details Leerlingen</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
                {groupedByStudent.map((student, idx) => (
                  <div key={idx} style={{ backgroundColor: 'var(--surface)', padding: '1.5rem', borderRadius: '8px', border: '1px solid var(--border)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', borderBottom: '1px solid var(--border)', paddingBottom: '0.5rem' }}>
                      <h3 style={{ fontSize: '1.2rem', fontWeight: 'bold' }}>{student.studentName} <span style={{fontSize: '0.9rem', color: 'var(--text-muted)'}}>({student.className})</span></h3>
                      <div style={{ fontSize: '1.2rem', fontWeight: 'bold', color: 'var(--primary)' }}>
                        Totaal: €{student.total.toFixed(2)}
                      </div>
                    </div>
                    
                    <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.9rem' }}>
                      <thead>
                        <tr>
                          <th style={{ padding: '0.5rem', color: 'var(--text-muted)' }}>Datum</th>
                          <th style={{ padding: '0.5rem', color: 'var(--text-muted)' }}>Maaltijd</th>
                          <th style={{ padding: '0.5rem', color: 'var(--text-muted)' }}>Aantal</th>
                          <th style={{ padding: '0.5rem', color: 'var(--text-muted)' }}>Prijs</th>
                        </tr>
                      </thead>
                      <tbody>
                        {student.orders.map(order => (
                          <tr key={order.id}>
                            <td style={{ padding: '0.5rem', borderBottom: '1px solid var(--border)' }}>
                              {new Date(order.order_date).toLocaleDateString('nl-BE')}
                            </td>
                            <td style={{ padding: '0.5rem', borderBottom: '1px solid var(--border)' }}>
                              {order.student_meals?.name}
                            </td>
                            <td style={{ padding: '0.5rem', borderBottom: '1px solid var(--border)' }}>
                              {order.quantity}
                            </td>
                            <td style={{ padding: '0.5rem', borderBottom: '1px solid var(--border)' }}>
                              €{(order.quantity * order.price_at_order).toFixed(2)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ))}
              </div>
            </div>
          )}

        </div>
      )}
    </div>
  )
}

