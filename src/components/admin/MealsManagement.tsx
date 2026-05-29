'use client'

import { useState, useEffect } from 'react'
import { getAdminMeals, getAdminStudentMeals, getCaterers, saveMeal, deleteMeal, saveStudentMeal, deleteStudentMeal } from '@/app/actions/admin'
import styles from './MealsManagement.module.css'

type Meal = {
  id: string
  name: string
  category?: string // Optional for student meals
  price?: number
  price_kleuter?: number
  price_lager?: number
  is_active: boolean
  caterer_id: string
  caterers: { name: string }
}

type Caterer = {
  id: string
  name: string
}

export default function MealsManagement({ catererId: activeCatererId }: { catererId: string | null }) {
  const [meals, setMeals] = useState<Meal[]>([])
  const [caterers, setCaterers] = useState<Caterer[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<'teacher' | 'student'>('teacher')
  
  // Form state
  const [isEditing, setIsEditing] = useState(false)
  const [editId, setEditId] = useState('')
  const [name, setName] = useState('')
  const [category, setCategory] = useState('')
  const [price, setPrice] = useState<number | ''>('')
  const [priceKleuter, setPriceKleuter] = useState<number | ''>('')
  const [priceLager, setPriceLager] = useState<number | ''>('')
  const [catererId, setCatererId] = useState('')
  const [isActive, setIsActive] = useState(true)

  const [saving, setSaving] = useState(false)

  const loadData = async () => {
    setLoading(true)
    const [mealsRes, studentMealsRes, caterersRes] = await Promise.all([
      getAdminMeals(activeCatererId),
      getAdminStudentMeals(activeCatererId),
      getCaterers()
    ])
    
    if (activeTab === 'teacher') {
      if (mealsRes.error) setError(mealsRes.error)
      else if (mealsRes.meals) setMeals(mealsRes.meals as any)
    } else {
      if (studentMealsRes.error) setError(studentMealsRes.error)
      else if (studentMealsRes.meals) setMeals(studentMealsRes.meals as any)
    }
      
    if (caterersRes.error && !error) setError(caterersRes.error)
    else if (caterersRes.caterers) {
      // Filter the caterers to only include the active one so they don't add meals for another caterer via this screen
      const activeCaterer = caterersRes.caterers.find((c: Caterer) => c.id === activeCatererId)
      if (activeCaterer) {
        setCaterers([activeCaterer])
        setCatererId(activeCaterer.id)
      } else {
        setCaterers([])
      }
    }
    setLoading(false)
  }

  useEffect(() => {
    loadData()
  }, [activeCatererId, activeTab])

  const resetForm = () => {
    setIsEditing(false)
    setEditId('')
    setName('')
    setCategory('')
    setPrice('')
    setPriceKleuter('')
    setPriceLager('')
    setIsActive(true)
    if (caterers.length > 0) setCatererId(caterers[0].id)
  }

  const handleEdit = (meal: Meal) => {
    setIsEditing(true)
    setEditId(meal.id)
    setName(meal.name)
    if (activeTab === 'teacher') {
      setCategory(meal.category || '')
      setPrice(meal.price || 0)
    } else {
      setPriceKleuter(meal.price_kleuter || 0)
      setPriceLager(meal.price_lager || 0)
    }
    setCatererId(meal.caterer_id)
    setIsActive(meal.is_active)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Weet je zeker dat je deze maaltijd wilt verwijderen? Let op: dit kan mislukken als er al bestellingen voor zijn geplaatst. Zet hem in dat geval op non-actief.')) return
    
    const res = activeTab === 'teacher' ? await deleteMeal(id) : await deleteStudentMeal(id)
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
    formData.append('caterer_id', catererId)
    formData.append('is_active', isActive.toString())
    
    if (activeTab === 'teacher') {
      formData.append('category', category)
      formData.append('price', price.toString())
    } else {
      formData.append('price_kleuter', priceKleuter.toString())
      formData.append('price_lager', priceLager.toString())
    }

    const res = activeTab === 'teacher' ? await saveMeal(formData) : await saveStudentMeal(formData)
    
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
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <h2 style={{ fontSize: '1.5rem', fontWeight: 'bold', color: 'var(--text-main)' }}>
          Maaltijden Beheer
        </h2>
        
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button 
            onClick={() => { setActiveTab('teacher'); resetForm(); }}
            className={`${styles.btn} ${activeTab === 'teacher' ? styles.btnPrimary : styles.btnSecondary}`}
          >
            Leerkrachten
          </button>
          <button 
            onClick={() => { setActiveTab('student'); resetForm(); }}
            className={`${styles.btn} ${activeTab === 'student' ? styles.btnPrimary : styles.btnSecondary}`}
          >
            Leerlingen
          </button>
        </div>
      </div>
      
      {error && <div style={{ color: 'var(--primary)', marginBottom: '1rem' }}>{error}</div>}

      <div className={`${styles.formCard} no-print`}>
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
              placeholder={activeTab === 'teacher' ? "Bijv. Spaghetti Bolognese" : "Bijv. Warme Maaltijd"}
            />
          </div>
          
          {activeTab === 'teacher' && (
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
          )}
          
          {activeTab === 'teacher' ? (
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
          ) : (
            <>
              <div className={styles.formGroup}>
                <label className={styles.label}>Prijs Kleuter (€)</label>
                <input 
                  type="number" 
                  step="0.01" 
                  min="0"
                  className={styles.input} 
                  value={priceKleuter} 
                  onChange={e => setPriceKleuter(parseFloat(e.target.value))} 
                  required 
                />
              </div>
              <div className={styles.formGroup}>
                <label className={styles.label}>Prijs Lager (€)</label>
                <input 
                  type="number" 
                  step="0.01" 
                  min="0"
                  className={styles.input} 
                  value={priceLager} 
                  onChange={e => setPriceLager(parseFloat(e.target.value))} 
                  required 
                />
              </div>
            </>
          )}

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
              {activeTab === 'teacher' && <th>Categorie</th>}
              {activeTab === 'teacher' ? (
                <th>Prijs</th>
              ) : (
                <>
                  <th>Prijs Kleuter</th>
                  <th>Prijs Lager</th>
                </>
              )}
              <th>Traiteur</th>
              <th>Status</th>
              <th className="no-print">Acties</th>
            </tr>
          </thead>
          <tbody>
            {meals.map(meal => (
              <tr key={meal.id} style={{ opacity: meal.is_active ? 1 : 0.6 }}>
                <td>{meal.name}</td>
                {activeTab === 'teacher' && <td>{meal.category}</td>}
                {activeTab === 'teacher' ? (
                  <td>€{meal.price?.toFixed(2)}</td>
                ) : (
                  <>
                    <td>€{meal.price_kleuter?.toFixed(2)}</td>
                    <td>€{meal.price_lager?.toFixed(2)}</td>
                  </>
                )}
                <td>{meal.caterers?.name}</td>
                <td>
                  <span className={meal.is_active ? styles.statusActive : styles.statusInactive}>
                    {meal.is_active ? 'Actief' : 'Inactief'}
                  </span>
                </td>
                <td className="no-print">
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
