'use client'

import { useState } from 'react'
import { deleteOrder, updateOrder } from '@/app/actions/order'
import styles from './OrderOverview.module.css'

type Order = {
  id: string
  order_date: string
  quantity: number
  price_at_order: number
  schools: { name: string }
  meals: { id: string, name: string, category: string, caterer_id: string }
}

type Meal = {
  id: string
  name: string
  category: string
  price: number
}

type OrderOverviewProps = {
  orders: Order[]
  availableMeals: Record<string, Meal[]> // A dictionary to quickly look up meals per caterer_id
}

export default function OrderOverview({ orders, availableMeals }: OrderOverviewProps) {
  const [editingOrderId, setEditingOrderId] = useState<string | null>(null)
  const [loadingId, setLoadingId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [showAllOrders, setShowAllOrders] = useState(false)

  // Local state for the edit form
  const [editMealId, setEditMealId] = useState<string>('')
  const [editQuantity, setEditQuantity] = useState<number>(1)

  const isEditable = (orderDate: string) => {
    const now = new Date()
    const brusselsTime = new Date(now.toLocaleString("en-US", { timeZone: "Europe/Brussels" }))
    const orderD = new Date(orderDate)
    
    // Normalize to date only
    brusselsTime.setHours(0, 0, 0, 0)
    orderD.setHours(0, 0, 0, 0)
    
    if (orderD > brusselsTime) return true // Future dates are editable
    if (orderD < brusselsTime) return false // Past dates are not editable
    
    // Today: check 08:15 deadline
    const currentHour = now.getHours()
    const currentMinute = now.getMinutes()
    
    if (currentHour < 8 || (currentHour === 8 && currentMinute < 15)) {
      return true
    }
    
    return false
  }

  const handleDelete = async (orderId: string) => {
    if (!confirm('Weet je zeker dat je deze bestelling wilt annuleren?')) return

    setLoadingId(orderId)
    setError(null)

    const result = await deleteOrder(orderId)
    if (result.error) {
      setError(result.error)
    }
    setLoadingId(null)
  }

  const handleEditClick = (order: Order) => {
    setEditingOrderId(order.id)
    setEditMealId(order.meals.id)
    setEditQuantity(order.quantity)
    setError(null)
  }

  const handleUpdate = async (e: React.FormEvent<HTMLFormElement>, orderId: string) => {
    e.preventDefault()
    setLoadingId(orderId)
    setError(null)

    const formData = new FormData(e.currentTarget)
    formData.append('order_id', orderId)
    
    const result = await updateOrder(formData)
    
    if (result.error) {
      setError(result.error)
    } else {
      setEditingOrderId(null)
    }
    setLoadingId(null)
  }

  if (orders.length === 0) {
    return (
      <div className={styles.container}>
        <h2 className={styles.title}>Mijn Bestellingen</h2>
        <p>Je hebt nog geen bestellingen geplaatst.</p>
      </div>
    )
  }

  // Bereken start van deze week (maandag)
  const startOfWeek = new Date()
  const day = startOfWeek.getDay()
  const diff = startOfWeek.getDate() - day + (day === 0 ? -6 : 1)
  startOfWeek.setDate(diff)
  startOfWeek.setHours(0, 0, 0, 0)

  const visibleOrders = showAllOrders 
    ? orders 
    : orders.filter(order => new Date(order.order_date) >= startOfWeek)

  return (
    <div className={styles.container}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '1rem' }}>
        <h2 className={styles.title} style={{ marginBottom: 0 }}>Mijn Bestellingen</h2>
        <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontSize: '0.9rem', color: 'var(--text-main)' }}>
          <input 
            type="checkbox" 
            checked={showAllOrders}
            onChange={(e) => setShowAllOrders(e.target.checked)}
            style={{ width: 'auto', margin: 0 }}
          />
          Toon historiek (30 dagen)
        </label>
      </div>
      
      {error && <div className={styles.error}>{error}</div>}

      <div className={styles.orderList}>
        {visibleOrders.length === 0 && !showAllOrders ? (
          <p style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>Geen bestellingen gevonden vanaf deze week. Vink de optie hierboven aan om eerdere bestellingen te zien.</p>
        ) : visibleOrders.map((order) => {
          const editable = isEditable(order.order_date)
          const isEditing = editingOrderId === order.id
          const isLoading = loadingId === order.id
          const catererMeals = availableMeals[order.meals.caterer_id] || []

          return (
            <div key={order.id} className={`${styles.orderCard} ${isLoading ? styles.loading : ''}`}>
              <div className={styles.orderHeader}>
                <div>
                  <div className={styles.orderDate}>
                    {new Date(order.order_date).toLocaleDateString('nl-BE', { weekday: 'long', day: 'numeric', month: 'long' })}
                  </div>
                  <div className={styles.orderSchool}>{order.schools.name}</div>
                </div>
                <div className={`${styles.statusBadge} ${editable ? styles.statusEditable : styles.statusFinal}`}>
                  {editable ? 'Kan nog gewijzigd worden' : 'Definitief'}
                </div>
              </div>

              {!isEditing ? (
                <>
                  <div className={styles.orderDetails}>
                    <div className={styles.mealInfo}>
                      <span className={styles.mealCategory}>{order.meals.category}</span>
                      <span className={styles.mealName}>{order.quantity}x {order.meals.name}</span>
                    </div>
                    <div className={styles.orderPrice}>
                      €{(order.price_at_order * order.quantity).toFixed(2)}
                    </div>
                  </div>

                  {editable && (
                    <div className={styles.actions}>
                      <button onClick={() => handleEditClick(order)} className={`${styles.btn} ${styles.btnEdit}`}>
                        Wijzig
                      </button>
                      <button onClick={() => handleDelete(order.id)} className={`${styles.btn} ${styles.btnDelete}`}>
                        Annuleer
                      </button>
                    </div>
                  )}
                </>
              ) : (
                <form className={styles.editForm} onSubmit={(e) => handleUpdate(e, order.id)}>
                  <div className={styles.formGroup}>
                    <label className={styles.label}>Maaltijd</label>
                    <select 
                      name="meal_id" 
                      className={styles.select} 
                      value={editMealId} 
                      onChange={e => setEditMealId(e.target.value)}
                    >
                      {catererMeals.map(meal => (
                        <option key={meal.id} value={meal.id}>
                          {meal.name} (€{meal.price.toFixed(2)})
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className={styles.formGroup}>
                    <label className={styles.label}>Aantal</label>
                    <input 
                      type="number" 
                      name="quantity" 
                      min="1" 
                      className={styles.input} 
                      value={editQuantity} 
                      onChange={e => setEditQuantity(parseInt(e.target.value))}
                    />
                  </div>
                  <div className={styles.editActions}>
                    <button type="button" onClick={() => setEditingOrderId(null)} className={`${styles.btn} ${styles.btnCancel}`}>
                      Annuleer
                    </button>
                    <button type="submit" className={`${styles.btn} ${styles.btnSave}`}>
                      Opslaan
                    </button>
                  </div>
                </form>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
