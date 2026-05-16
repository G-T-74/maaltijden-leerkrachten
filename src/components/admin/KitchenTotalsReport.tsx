'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/utils/supabase/client'

export default function KitchenTotalsReport({ schoolId }: { schoolId: string }) {
  const [date, setDate] = useState<string>(new Date().toISOString().split('T')[0])
  const [totals, setTotals] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  const supabase = createClient()

  useEffect(() => {
    async function fetchTotals() {
      setLoading(true)
      const { data, error } = await supabase
        .from('orders')
        .select(`
          quantity,
          meals ( id, name, category )
        `)
        .eq('order_date', date)
        .eq('school_id', schoolId)

      if (data) {
        // Groeperen per maaltijd
        const grouped: Record<string, { meal: any, total: number }> = {}
        data.forEach((order: any) => {
          const mealId = order.meals?.id
          if (!mealId) return
          if (!grouped[mealId]) {
            grouped[mealId] = { meal: order.meals, total: 0 }
          }
          grouped[mealId].total += order.quantity
        })

        const sortedTotals = Object.values(grouped).sort((a, b) => {
          if (a.meal.category !== b.meal.category) {
            return a.meal.category.localeCompare(b.meal.category)
          }
          return a.meal.name.localeCompare(b.meal.name)
        })

        setTotals(sortedTotals)
      }
      setLoading(false)
    }

    fetchTotals()
  }, [date, schoolId])

  return (
    <div>
      <h2 style={{ fontSize: '1.5rem', fontWeight: 'bold', marginBottom: '1rem' }}>Keukenoverzicht (Totalen)</h2>
      
      <div style={{ marginBottom: '2rem' }}>
        <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>Selecteer Datum</label>
        <input 
          type="date" 
          value={date} 
          onChange={(e) => setDate(e.target.value)}
          className="input"
          style={{ maxWidth: '300px' }}
        />
      </div>

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
                <th style={{ padding: '1rem', color: 'var(--text-muted)' }}>Aantal</th>
              </tr>
            </thead>
            <tbody>
              {totals.map((item, index) => (
                <tr key={index} style={{ borderBottom: '1px solid var(--border)' }}>
                  <td style={{ padding: '1rem', fontWeight: '500' }}>{item.meal.name}</td>
                  <td style={{ padding: '1rem', color: 'var(--text-muted)' }}>{item.meal.category}</td>
                  <td style={{ padding: '1rem', fontWeight: 'bold' }}>{item.total}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
