'use client'

import { useState, useEffect } from 'react'
import { getAdminMeals, getCaterers, saveMeal, deleteMeal } from '@/app/actions/admin'
import styles from './MealsManagement.module.css'

type Meal = {
  id: string
  name: string
  category: string
  price: number
  is_active: boolean
  caterer_id: string
  caterers: { name: string }
}

type Caterer = {
  id: string
  name: string
}

export default function MealsManagement() {
  const [meals, setMeals] = useState<Meal[]>([])
  const [caterers, setCaterers] = useState<Caterer[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  
  // Form state
  const [isEditing, setIsEditing] = useState(false)
  const [editId, setEditId] = useState('')
  const [name, setName] = useState('')
  const [category, setCategory] = useState('')
  const [price, setPrice] = useState<number | ''>('')
  const [catererId, setCatererId] = useState('')
  const [isActive, setIsActive] = useState(true)

  const [saving, setSaving] = useState(false)

  const loadData = async () => {
    setLoading(true)
    const [mealsRes, caterersRes] = await Promise.all([
      getAdminMeals(),
      getCaterers()
    ])
    
    if (mealsRes.error) setError(mealsRes.error)
    else if (mealsRes.meals) setMeals(mealsRes.meals as any)
      
    if (caterersRes.error && !error) setError(caterersRes.error)
    else if (caterersRes.caterers) {
      setCaterers(caterersRes.caterers)
      if (caterersRes.caterers.length > 0) {
        setCatererId(caterersRes.caterers[0].id)
      }
    }
    setLoading(false)
  }

  useEffect(() => {
    loadData()
  }, [])

  const resetForm = () => {
    setIsEditing(false)
    setEditId('')
    setName('')
    setCategory('')
    setPrice('')
    setIsActive(true)
    if (caterers.length > 0) setCatererId(caterers[0].id)
  }

  const handleEdit = (meal: Meal) => {
    setIsEditing(true)
    setEditId(meal.id)
    setName(meal.name)
    setCategory(meal.category)
    setPrice(meal.price)
    setCatererId(meal.caterer_id)
    setIsActive(meal.is_active)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Weet je zeker dat je deze maaltijd wilt verwijderen? Let op: dit kan mislukken als er al bestellingen voor zijn geplaatst. Zet hem in dat geval op non-actief.')) return
    
    const res = await deleteMeal(id)
    if (res.error) {
      alert(res.error)
    } else {
      loadData()
    }
  }

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setSaving(true)
    setError(null)
    
    const formData = new FormData()
    if (isEditing) formData.append('id', editId)
    formData.append('name', name)
    formData.append('category', category)
    formData.append('price', price.toString())
    formData.append('caterer_id', catererId)
    formData.append('is_active', isActive.toString())

    const res = await saveMeal(formData)
    
    if (res.error) {
      setError(res.error)
    } else {
      resetForm()
      loadData()
    }
    setSaving(false)
  }

  if (loading && meals.length === 0) return <div>Laden...</div>

  return (
    <div>
      <h2 style={{ fontSize: '1.5rem', fontWeight: 'bold', marginBottom: '1rem', color: 'var(--text-main)' }}>
        Maaltijden Beheer
      </h2>
      
      {error && <div style={{ color: 'var(--primary)', marginBottom: '1rem' }}>{error}</div>}

      <div className={styles.formCard}>
        <h3 style={{ fontSize: '1.1rem', fontWeight: 'bold', marginBottom: '1rem' }}>
          {isEditing ? 'Maaltijd Wijzigen' : 'Nieuwe Maaltijd Toevoegen'}
        </h3>
        <form onSubmit={handleSubmit} className={styles.formGrid}>
          <div className={styles.formGroup}>
            <label className={styles.label}>Naam</label>
            <input 
              type="text" 
              className={styles.input} 
              value={name} 
              onChange={e => setName(e.target.value)} 
              required 
              placeholder="Bijv. Spaghetti Bolognese"
            />
          </div>
          <div className={styles.formGroup}>
            <label className={styles.label}>Categorie</label>
            <input 
              type="text" 
              className={styles.input} 
              value={category} 
              onChange={e => setCategory(e.target.value)} 
              required 
              placeholder="Bijv. Warm, Koud, Soep"
            />
          </div>
          <div className={styles.formGroup}>
            <label className={styles.label}>Prijs (€)</label>
            <input 
              type="number" 
              step="0.01" 
              min="0"
              className={styles.input} 
              value={price} 
              onChange={e => setPrice(parseFloat(e.target.value))} 
              required 
            />
          </div>
          <div className={styles.formGroup}>
            <label className={styles.label}>Traiteur</label>
            <select 
              className={styles.select} 
              value={catererId} 
              onChange={e => setCatererId(e.target.value)}
              required
            >
              {caterers.map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
          <div className={styles.formGroup} style={{ display: 'flex', alignItems: 'flex-end', paddingBottom: '0.5rem' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
              <input 
                type="checkbox" 
                checked={isActive} 
                onChange={e => setIsActive(e.target.checked)} 
              />
              Actief (kan besteld worden)
            </label>
          </div>
          <div className={styles.formActions}>
            {isEditing && (
              <button type="button" onClick={resetForm} className={`${styles.btn} ${styles.btnSecondary}`}>
                Annuleren
              </button>
            )}
            <button type="submit" className={styles.btn} disabled={saving}>
              {saving ? 'Opslaan...' : 'Opslaan'}
            </button>
          </div>
        </form>
      </div>

      <div className={styles.tableContainer}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Naam</th>
              <th>Categorie</th>
              <th>Prijs</th>
              <th>Traiteur</th>
              <th>Status</th>
              <th>Acties</th>
            </tr>
          </thead>
          <tbody>
            {meals.map(meal => (
              <tr key={meal.id} style={{ opacity: meal.is_active ? 1 : 0.6 }}>
                <td>{meal.name}</td>
                <td>{meal.category}</td>
                <td>€{meal.price.toFixed(2)}</td>
                <td>{meal.caterers?.name}</td>
                <td>
                  <span className={meal.is_active ? styles.statusActive : styles.statusInactive}>
                    {meal.is_active ? 'Actief' : 'Inactief'}
                  </span>
                </td>
                <td>
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <button onClick={() => handleEdit(meal)} className={`${styles.actionBtn} ${styles.editBtn}`}>
                      Wijzig
                    </button>
                    <button onClick={() => handleDelete(meal.id)} className={`${styles.actionBtn} ${styles.deleteBtn}`}>
                      Wis
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
