'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/utils/supabase/client'

export default function KitchenTotalsReport({ schoolId }: { schoolId: string }) {
  const [date, setDate] = useState<string>(new Date().toISOString().split('T')[0])
  const [totals, setTotals] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [applyFactor, setApplyFactor] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  const supabase = createClient()

  useEffect(() => {
    async function fetchTotals() {
      setLoading(true)
      setErrorMsg(null)
      
      // 1. Check of toddler factor actief is
      const { data: schoolData } = await supabase
        .from('schools')
        .select('apply_toddler_factor')
        .eq('id', schoolId)
        .single()
      
      const factorActive = schoolData?.apply_toddler_factor || false
      setApplyFactor(factorActive)

      // 2. Haal leerkracht bestellingen op
      const { data: teacherOrders, error: teacherErr } = await supabase
        .from('orders')
        .select(`
          quantity,
          meals ( id, name, category )
        `)
        .eq('order_date', date)
        .eq('school_id', schoolId)

      if (teacherErr) {
        console.error("Teacher orders error:", teacherErr)
        setErrorMsg(prev => (prev ? prev + ' | ' : '') + 'Teacher Orders Error: ' + teacherErr.message)
      }

      // 3. Haal klassen en studenten op voor deze school
      const { data: classes, error: classErr } = await supabase
        .from('classes')
        .select('id, level')
        .eq('school_id', schoolId)
      
      if (classErr) {
        console.error("Classes error:", classErr)
        setErrorMsg(prev => (prev ? prev + ' | ' : '') + 'Classes Error: ' + classErr.message)
      }
      
      const classIds = classes?.map(c => c.id) || []
      
      let studentOrdersData: any[] = []
      let studentsMap: Record<string, string> = {} // student_id -> level
      
      if (classIds.length > 0) {
        const classLevelMap: Record<string, string> = {}
        classes?.forEach(c => classLevelMap[c.id] = c.level)

        const { data: students, error: studErr } = await supabase
          .from('students')
          .select('id, class_id')
          .in('class_id', classIds)
        
        if (studErr) {
          console.error("Students error:", studErr)
          setErrorMsg(prev => (prev ? prev + ' | ' : '') + 'Students Error: ' + studErr.message)
        }
        
        const studentIds = students?.map(s => s.id) || []
        students?.forEach(s => studentsMap[s.id] = classLevelMap[s.class_id])
        
        if (studentIds.length > 0) {
          const { data, error: soErr } = await supabase
            .from('student_orders')
            .select(`
              student_id,
              quantity,
              student_meals ( id, name, category )
            `)
            .in('student_id', studentIds)
            .eq('order_date', date)
            
          if (soErr) {
            console.error("Student orders error:", soErr)
            setErrorMsg(prev => (prev ? prev + ' | ' : '') + 'Student Orders Error: ' + soErr.message)
          }
          studentOrdersData = data || []
        }
      }

      // 4. Groeperen per maaltijdnaam en categorie
      const grouped: Record<string, { mealName: string, category: string, totalTeachers: number, totalStudentsNormal: number, totalStudentsToddler: number }> = {}

      teacherOrders?.forEach((order: any) => {
        const name = order.meals?.name
        const category = order.meals?.category || 'Andere'
        if (!name) return
        const key = `${category}_${name}`
        if (!grouped[key]) {
          grouped[key] = { mealName: name, category, totalTeachers: 0, totalStudentsNormal: 0, totalStudentsToddler: 0 }
        }
        grouped[key].totalTeachers += order.quantity
      })

      studentOrdersData?.forEach((order: any) => {
        const name = order.student_meals?.name
        const category = order.student_meals?.category || 'Andere'
        if (!name) return
        const key = `${category}_${name}`
        if (!grouped[key]) {
          grouped[key] = { mealName: name, category, totalTeachers: 0, totalStudentsNormal: 0, totalStudentsToddler: 0 }
        }
        
        const level = studentsMap[order.student_id]
        if (level === 'kleuter') {
          grouped[key].totalStudentsToddler += order.quantity
        } else {
          grouped[key].totalStudentsNormal += order.quantity
        }
      })

      // 5. Totalen berekenen
      const sortedTotals = Object.values(grouped).map(item => {
        const exactTotal = item.totalTeachers + item.totalStudentsNormal + item.totalStudentsToddler
        let displayTotal = `${exactTotal}`
        
        if (factorActive && item.totalStudentsToddler > 0) {
          const toddlerConverted = (item.totalStudentsToddler * 2) / 3
          const calculatedTotal = item.totalTeachers + item.totalStudentsNormal + toddlerConverted
          displayTotal = `${exactTotal} (=> ${calculatedTotal.toFixed(2).replace(/\.?0+$/, '')} porties)`
        }

        return {
          ...item,
          exactTotal,
          displayTotal
        }
      }).sort((a, b) => {
        if (a.category !== b.category) {
          return a.category.localeCompare(b.category)
        }
        return a.mealName.localeCompare(b.mealName)
      })

      setTotals(sortedTotals)
      setLoading(false)
    }

    fetchTotals()
  }, [date, schoolId])

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
        <h2 style={{ fontSize: '1.5rem', fontWeight: 'bold' }}>Keukenoverzicht (Totalen)</h2>
        {applyFactor && (
          <span style={{ backgroundColor: 'var(--primary)', color: 'white', padding: '0.25rem 0.75rem', borderRadius: '1rem', fontSize: '0.875rem' }}>
            Kleuterfactor 2/3 Actief
          </span>
        )}
      </div>
      
      <div className="no-print" style={{ marginBottom: '2rem' }}>
        <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>Selecteer Datum</label>
        <input 
          type="date" 
          value={date} 
          onChange={(e) => setDate(e.target.value)}
          className="input"
          style={{ maxWidth: '300px' }}
        />
      </div>

      {errorMsg && (
        <div style={{ backgroundColor: 'rgba(255,0,0,0.1)', color: 'red', padding: '1rem', marginBottom: '1rem', borderRadius: '8px' }}>
          <strong>Error loading data:</strong> {errorMsg}
        </div>
      )}

      {loading ? (
        <p>Laden...</p>
      ) : totals.length === 0 ? (
        <p style={{ color: 'var(--text-muted)' }}>Geen bestellingen gevonden voor deze datum.</p>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
            <thead>
              <tr style={{ borderBottom: '2px solid var(--border)' }}>
                <th style={{ padding: '1rem', color: 'var(--text-muted)' }}>Maaltijd</th>
                <th style={{ padding: '1rem', color: 'var(--text-muted)' }}>Categorie</th>
                <th style={{ padding: '1rem', color: 'var(--text-muted)', textAlign: 'center' }}>Leerkrachten</th>
                <th style={{ padding: '1rem', color: 'var(--text-muted)', textAlign: 'center' }}>Lln (Lager)</th>
                <th style={{ padding: '1rem', color: 'var(--text-muted)', textAlign: 'center' }}>Lln (Kleuter)</th>
                <th style={{ padding: '1rem', color: 'var(--text-muted)', textAlign: 'right' }}>Totaal Keuken</th>
              </tr>
            </thead>
            <tbody>
              {totals.map((item, index) => (
                <tr key={index} style={{ borderBottom: '1px solid var(--border)' }}>
                  <td style={{ padding: '1rem', fontWeight: '500' }}>{item.mealName}</td>
                  <td style={{ padding: '1rem', color: 'var(--text-muted)' }}>{item.category}</td>
                  <td style={{ padding: '1rem', textAlign: 'center' }}>{item.totalTeachers || '-'}</td>
                  <td style={{ padding: '1rem', textAlign: 'center' }}>{item.totalStudentsNormal || '-'}</td>
                  <td style={{ padding: '1rem', textAlign: 'center' }}>{item.totalStudentsToddler || '-'}</td>
                  <td style={{ padding: '1rem', fontWeight: 'bold', textAlign: 'right' }}>{item.displayTotal}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

