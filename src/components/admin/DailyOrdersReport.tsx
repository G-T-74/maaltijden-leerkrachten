'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/utils/supabase/client'
import { updateOrder, deleteOrder } from '@/app/actions/order'
import { getAdminMeals } from '@/app/actions/admin'

export default function DailyOrdersReport({ schoolId, catererId }: { schoolId: string, catererId: string }) {
  const [date, setDate] = useState<string>(new Date().toISOString().split('T')[0])
  const [orders, setOrders] = useState<any[]>([])
  const [allMeals, setAllMeals] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  const [editingId, setEditingId] = useState<string | null>(null)
  const [editMealId, setEditMealId] = useState('')
  const [editQuantity, setEditQuantity] = useState(1)
  const [savingId, setSavingId] = useState<string | null>(null)

  const supabase = createClient()

  const fetchOrders = async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('orders')
      .select(`
        id,
        quantity,
        price_at_order,
        meal_id,
        profiles ( first_name, last_name ),
        meals ( name, category )
      `)
      .eq('order_date', date)
      .eq('school_id', schoolId)

    if (data) {
      const sortedData = data.sort((a: any, b: any) => {
        const nameA = `${a.profiles?.first_name || ''} ${a.profiles?.last_name || ''}`.trim()
        const nameB = `${b.profiles?.first_name || ''} ${b.profiles?.last_name || ''}`.trim()
        return nameA.localeCompare(nameB)
      })
      setOrders(sortedData)
    }
    setLoading(false)
  }

  useEffect(() => {
    async function init() {
      const { meals } = await getAdminMeals(catererId)
      if (meals) {
        setAllMeals(meals)
      }
      fetchOrders()
    }
    init()
  }, [date, schoolId, catererId])

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
      fetchOrders()
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
      fetchOrders()
    }
    setSavingId(null)
  }

  return (
    <div>
      <h2 style={{ fontSize: '1.5rem', fontWeight: 'bold', marginBottom: '1rem', color: 'var(--text-main)' }}>Dagoverzicht (Gedetailleerd)</h2>
      
      <div style={{ marginBottom: '2rem' }}>
        <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500, color: 'var(--text-muted)' }}>Selecteer Datum</label>
        <input 
          type="date" 
          value={date} 
          onChange={(e) => setDate(e.target.value)}
          style={{ 
            padding: '0.5rem', 
            borderRadius: '4px', 
            border: '1px solid var(--border)', 
            backgroundColor: 'var(--background)', 
            color: 'var(--text-main)' 
          }}
        />
      </div>

      {loading ? (
        <p style={{ color: 'var(--text-muted)' }}>Laden...</p>
      ) : orders.length === 0 ? (
        <p style={{ color: 'var(--text-muted)' }}>Geen bestellingen gevonden voor deze datum.</p>
      ) : (
        <div style={{ overflowX: 'auto', backgroundColor: 'var(--surface)', borderRadius: '8px', border: '1px solid var(--border)' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)', backgroundColor: 'rgba(255,255,255,0.02)' }}>
                <th style={{ padding: '1rem', color: 'var(--text-muted)', fontWeight: 500 }}>Leerkracht</th>
                <th style={{ padding: '1rem', color: 'var(--text-muted)', fontWeight: 500 }}>Maaltijd</th>
                <th style={{ padding: '1rem', color: 'var(--text-muted)', fontWeight: 500 }}>Aantal</th>
                <th style={{ padding: '1rem', color: 'var(--text-muted)', fontWeight: 500 }}>Prijs p.s.</th>
                <th style={{ padding: '1rem', color: 'var(--text-muted)', fontWeight: 500 }}>Totaal</th>
                <th style={{ padding: '1rem', color: 'var(--text-muted)', fontWeight: 500 }}>Acties</th>
              </tr>
            </thead>
            <tbody>
              {orders.map(order => {
                const name = `${order.profiles?.first_name || ''} ${order.profiles?.last_name || ''}`.trim() || 'Onbekend'
                const total = (order.quantity * order.price_at_order).toFixed(2)
                const isEditing = editingId === order.id

                return (
                  <tr key={order.id} style={{ borderBottom: '1px solid var(--border)' }}>
                    <td style={{ padding: '1rem' }}>{name}</td>
                    
                    {isEditing ? (
                      <>
                        <td style={{ padding: '1rem' }}>
                          <select 
                            value={editMealId} 
                            onChange={(e) => setEditMealId(e.target.value)}
                            style={{ width: '100%', padding: '0.25rem', borderRadius: '4px', border: '1px solid var(--border)', backgroundColor: 'var(--background)', color: 'var(--text-main)' }}
                          >
                            {allMeals.map(m => (
                              <option key={m.id} value={m.id}>{m.name} (€{m.price.toFixed(2)})</option>
                            ))}
                          </select>
                        </td>
                        <td style={{ padding: '1rem' }}>
                          <input 
                            type="number" 
                            min="1" 
                            value={editQuantity} 
                            onChange={(e) => setEditQuantity(parseInt(e.target.value) || 1)}
                            style={{ width: '60px', padding: '0.25rem', borderRadius: '4px', border: '1px solid var(--border)', backgroundColor: 'var(--background)', color: 'var(--text-main)' }}
                          />
                        </td>
                        <td style={{ padding: '1rem', color: 'var(--text-muted)' }}>-</td>
                        <td style={{ padding: '1rem', color: 'var(--text-muted)' }}>-</td>
                        <td style={{ padding: '1rem' }}>
                          <div style={{ display: 'flex', gap: '0.5rem' }}>
                            <button 
                              onClick={() => handleSave(order.id)} 
                              disabled={savingId === order.id}
                              style={{ padding: '0.25rem 0.5rem', backgroundColor: 'var(--primary)', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
                            >
                              Opslaan
                            </button>
                            <button 
                              onClick={handleCancelEdit} 
                              disabled={savingId === order.id}
                              style={{ padding: '0.25rem 0.5rem', backgroundColor: 'var(--surface-hover)', color: 'var(--text-main)', border: '1px solid var(--border)', borderRadius: '4px', cursor: 'pointer' }}
                            >
                              Annuleer
                            </button>
                          </div>
                        </td>
                      </>
                    ) : (
                      <>
                        <td style={{ padding: '1rem' }}>
                          {order.meals?.name} <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>({order.meals?.category})</span>
                        </td>
                        <td style={{ padding: '1rem' }}>{order.quantity}</td>
                        <td style={{ padding: '1rem' }}>€{Number(order.price_at_order).toFixed(2)}</td>
                        <td style={{ padding: '1rem', fontWeight: 'bold' }}>€{total}</td>
                        <td style={{ padding: '1rem' }}>
                          <div style={{ display: 'flex', gap: '0.5rem' }}>
                            <button 
                              onClick={() => handleEdit(order)} 
                              disabled={savingId === order.id}
                              style={{ padding: '0.25rem 0.5rem', backgroundColor: 'transparent', color: 'var(--text-main)', border: '1px solid var(--border)', borderRadius: '4px', cursor: 'pointer' }}
                            >
                              Wijzig
                            </button>
                            <button 
                              onClick={() => handleDelete(order.id)} 
                              disabled={savingId === order.id}
                              style={{ padding: '0.25rem 0.5rem', backgroundColor: 'transparent', color: 'var(--primary)', border: '1px solid rgba(243, 53, 75, 0.3)', borderRadius: '4px', cursor: 'pointer' }}
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
          </table>
        </div>
      )}
    </div>
  )
}
