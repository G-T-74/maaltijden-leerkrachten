'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/utils/supabase/client'

export default function DailyOrdersReport() {
  const [date, setDate] = useState<string>(new Date().toISOString().split('T')[0])
  const [orders, setOrders] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  const supabase = createClient()

  useEffect(() => {
    async function fetchOrders() {
      setLoading(true)
      const { data, error } = await supabase
        .from('orders')
        .select(`
          id,
          quantity,
          price_at_order,
          profiles ( first_name, last_name ),
          meals ( name, category )
        `)
        .eq('order_date', date)

      if (data) {
        // Sorteren op naam van de leerkracht
        const sortedData = data.sort((a: any, b: any) => {
          const nameA = `${a.profiles?.first_name || ''} ${a.profiles?.last_name || ''}`.trim()
          const nameB = `${b.profiles?.first_name || ''} ${b.profiles?.last_name || ''}`.trim()
          return nameA.localeCompare(nameB)
        })
        setOrders(sortedData)
      }
      setLoading(false)
    }

    fetchOrders()
  }, [date])

  return (
    <div>
      <h2 style={{ fontSize: '1.5rem', fontWeight: 'bold', marginBottom: '1rem' }}>Dagoverzicht (Gedetailleerd)</h2>
      
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
      ) : orders.length === 0 ? (
        <p style={{ color: 'var(--text-muted)' }}>Geen bestellingen gevonden voor deze datum.</p>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
            <thead>
              <tr style={{ borderBottom: '2px solid var(--border-color)' }}>
                <th style={{ padding: '1rem', color: 'var(--text-muted)' }}>Leerkracht</th>
                <th style={{ padding: '1rem', color: 'var(--text-muted)' }}>Maaltijd</th>
                <th style={{ padding: '1rem', color: 'var(--text-muted)' }}>Aantal</th>
                <th style={{ padding: '1rem', color: 'var(--text-muted)' }}>Prijs p.s.</th>
                <th style={{ padding: '1rem', color: 'var(--text-muted)' }}>Totaal</th>
              </tr>
            </thead>
            <tbody>
              {orders.map(order => {
                const name = `${order.profiles?.first_name || ''} ${order.profiles?.last_name || ''}`.trim() || 'Onbekend'
                const total = (order.quantity * order.price_at_order).toFixed(2)
                return (
                  <tr key={order.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                    <td style={{ padding: '1rem' }}>{name}</td>
                    <td style={{ padding: '1rem' }}>{order.meals?.name} <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>({order.meals?.category})</span></td>
                    <td style={{ padding: '1rem' }}>{order.quantity}</td>
                    <td style={{ padding: '1rem' }}>€{Number(order.price_at_order).toFixed(2)}</td>
                    <td style={{ padding: '1rem', fontWeight: 'bold' }}>€{total}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
