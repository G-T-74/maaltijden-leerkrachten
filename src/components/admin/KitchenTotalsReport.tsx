'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/utils/supabase/client'

type MealTotal = {
  mealName: string;
  category: string;
  totalTeachers: number;
  totalStudentsNormal: number;
  totalStudentsToddler: number;
  exactTotal: number;
  displayTotal: string;
}

type GroupTotal = {
  groupId: string;
  groupName: string;
  orderCode: string;
  meals: MealTotal[];
}

export default function KitchenTotalsReport({ schoolId }: { schoolId: string }) {
  const [date, setDate] = useState<string>(new Date().toISOString().split('T')[0])
  const [groupedTotals, setGroupedTotals] = useState<GroupTotal[]>([])
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

      // 2. Haal class_groups op
      const { data: classGroups, error: cgErr } = await supabase
        .from('class_groups')
        .select('*')
        .eq('school_id', schoolId)

      if (cgErr) {
        console.error("Class groups error:", cgErr)
        setErrorMsg(prev => (prev ? prev + ' | ' : '') + 'Class Groups Error: ' + cgErr.message)
      }

      // 3. Haal leerkracht bestellingen op
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

      // 4. Haal klassen en studenten op voor deze school
      const { data: classes, error: classErr } = await supabase
        .from('classes')
        .select('id, level, class_group_id')
        .eq('school_id', schoolId)
      
      if (classErr) {
        console.error("Classes error:", classErr)
        setErrorMsg(prev => (prev ? prev + ' | ' : '') + 'Classes Error: ' + classErr.message)
      }
      
      const classIds = classes?.map(c => c.id) || []
      
      let studentOrdersData: any[] = []
      let studentsMap: Record<string, { level: string, class_group_id: string | null }> = {} // student_id -> { level, class_group_id }
      
      if (classIds.length > 0) {
        const classInfoMap: Record<string, { level: string, class_group_id: string | null }> = {}
        classes?.forEach(c => classInfoMap[c.id] = { level: c.level, class_group_id: c.class_group_id })

        const { data: students, error: studErr } = await supabase
          .from('students')
          .select('id, class_id')
          .in('class_id', classIds)
        
        if (studErr) {
          console.error("Students error:", studErr)
          setErrorMsg(prev => (prev ? prev + ' | ' : '') + 'Students Error: ' + studErr.message)
        }
        
        const studentIds = students?.map(s => s.id) || []
        students?.forEach(s => {
          studentsMap[s.id] = classInfoMap[s.class_id]
        })
        
        if (studentIds.length > 0) {
          const { data, error: soErr } = await supabase
            .from('student_orders')
            .select(`
              student_id,
              quantity,
              student_meals ( id, name )
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

      // 5. Groeperen per Groep -> Maaltijdnaam en Categorie
      // Structuur: Record<groupId, Record<mealKey, MealTotal>>
      const groupedData: Record<string, Record<string, MealTotal>> = {}

      // Initialiseer groepen (zodat lege groepen ook kunnen bestaan als er geen bestellingen zijn? 
      // Beter om enkel groepen te tonen met bestellingen, of alle groepen)
      // Laten we alle bestaande groepen initiëren
      classGroups?.forEach(g => {
        groupedData[g.id] = {}
      })
      // Een groep voor 'Niet Gegroepeerd' en 'Leerkrachten'
      groupedData['ungrouped'] = {}
      groupedData['teachers'] = {}

      // Leerkrachten verwerken
      teacherOrders?.forEach((order: any) => {
        const name = order.meals?.name
        const category = order.meals?.category || 'Andere'
        if (!name) return
        const key = `${category}_${name}`
        const groupId = 'teachers'

        if (!groupedData[groupId][key]) {
          groupedData[groupId][key] = { mealName: name, category, totalTeachers: 0, totalStudentsNormal: 0, totalStudentsToddler: 0, exactTotal: 0, displayTotal: '' }
        }
        groupedData[groupId][key].totalTeachers += order.quantity
      })

      // Leerlingen verwerken
      studentOrdersData?.forEach((order: any) => {
        const name = order.student_meals?.name
        if (!name) return

        let category = 'Leerling Maaltijden'
        const studentInfo = studentsMap[order.student_id]
        const groupId = studentInfo?.class_group_id || 'ungrouped'

        const key = `${category}_${name}`
        
        // Ensure group object exists (fallback for deleted groups)
        if (!groupedData[groupId]) {
          groupedData[groupId] = {}
        }

        if (!groupedData[groupId][key]) {
          groupedData[groupId][key] = { mealName: name, category, totalTeachers: 0, totalStudentsNormal: 0, totalStudentsToddler: 0, exactTotal: 0, displayTotal: '' }
        }
        
        const level = studentInfo?.level
        if (level === 'kleuter') {
          groupedData[groupId][key].totalStudentsToddler += order.quantity
        } else {
          groupedData[groupId][key].totalStudentsNormal += order.quantity
        }
      })

      // 6. Totalen berekenen en omzetten naar array formaat
      const finalGroups: GroupTotal[] = []

      // Verwerk database groepen
      classGroups?.forEach(g => {
        const meals = processMealsForGroup(groupedData[g.id] || {}, factorActive)
        if (meals.length > 0) {
          finalGroups.push({
            groupId: g.id,
            groupName: g.name,
            orderCode: g.order_code,
            meals
          })
        }
      })

      // Verwerk Niet-gegroepeerde klassen
      const ungroupedMeals = processMealsForGroup(groupedData['ungrouped'] || {}, factorActive)
      if (ungroupedMeals.length > 0) {
        finalGroups.push({
          groupId: 'ungrouped',
          groupName: 'Overige Klassen (Niet toegewezen)',
          orderCode: 'GEEN',
          meals: ungroupedMeals
        })
      }

      // Verwerk Leerkrachten (onderaan)
      const teacherMeals = processMealsForGroup(groupedData['teachers'] || {}, false) // Leerkrachten hebben geen kleuterfactor
      if (teacherMeals.length > 0) {
        finalGroups.push({
          groupId: 'teachers',
          groupName: 'Leerkrachten',
          orderCode: 'LEER',
          meals: teacherMeals
        })
      }

      setGroupedTotals(finalGroups)
      setLoading(false)
    }

    fetchTotals()
  }, [date, schoolId])

  // Helper functie om maaltijden voor een groep te berekenen
  const processMealsForGroup = (mealRecord: Record<string, MealTotal>, factorActive: boolean) => {
    return Object.values(mealRecord).map(item => {
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
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
        <h2 style={{ fontSize: '1.5rem', fontWeight: 'bold' }}>Keukenoverzicht (Gegroepeerd)</h2>
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
      ) : groupedTotals.length === 0 ? (
        <p style={{ color: 'var(--text-muted)' }}>Geen bestellingen gevonden voor deze datum.</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
          {groupedTotals.map(group => (
            <div key={group.groupId} style={{ backgroundColor: 'var(--surface)', borderRadius: '8px', border: '1px solid var(--border)', overflow: 'hidden' }}>
              <div style={{ backgroundColor: 'var(--background)', padding: '1rem', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h3 style={{ fontSize: '1.25rem', fontWeight: 'bold', margin: 0 }}>
                  GROEP: {group.groupName}
                </h3>
                <span style={{ backgroundColor: 'var(--primary)', color: 'white', padding: '0.25rem 0.75rem', borderRadius: '4px', fontWeight: 'bold' }}>
                  Bestelcode: {group.orderCode}
                </span>
              </div>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                  <thead>
                    <tr style={{ borderBottom: '2px solid var(--border)' }}>
                      <th style={{ padding: '0.75rem 1rem', color: 'var(--text-muted)' }}>Maaltijd</th>
                      <th style={{ padding: '0.75rem 1rem', color: 'var(--text-muted)' }}>Categorie</th>
                      {group.groupId === 'teachers' ? (
                        <th style={{ padding: '0.75rem 1rem', color: 'var(--text-muted)', textAlign: 'center' }}>Aantal</th>
                      ) : (
                        <>
                          <th style={{ padding: '0.75rem 1rem', color: 'var(--text-muted)', textAlign: 'center' }}>Lln (Lager)</th>
                          <th style={{ padding: '0.75rem 1rem', color: 'var(--text-muted)', textAlign: 'center' }}>Lln (Kleuter)</th>
                        </>
                      )}
                      <th style={{ padding: '0.75rem 1rem', color: 'var(--text-muted)', textAlign: 'right' }}>Totaal Keuken</th>
                    </tr>
                  </thead>
                  <tbody>
                    {group.meals.map((item, index) => (
                      <tr key={index} style={{ borderBottom: '1px solid var(--border)' }}>
                        <td style={{ padding: '0.75rem 1rem', fontWeight: '500' }}>{item.mealName}</td>
                        <td style={{ padding: '0.75rem 1rem', color: 'var(--text-muted)' }}>{item.category}</td>
                        {group.groupId === 'teachers' ? (
                          <td style={{ padding: '0.75rem 1rem', textAlign: 'center' }}>{item.totalTeachers || '-'}</td>
                        ) : (
                          <>
                            <td style={{ padding: '0.75rem 1rem', textAlign: 'center' }}>{item.totalStudentsNormal || '-'}</td>
                            <td style={{ padding: '0.75rem 1rem', textAlign: 'center' }}>{item.totalStudentsToddler || '-'}</td>
                          </>
                        )}
                        <td style={{ padding: '0.75rem 1rem', fontWeight: 'bold', textAlign: 'right' }}>{item.displayTotal}</td>
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
  )
}
