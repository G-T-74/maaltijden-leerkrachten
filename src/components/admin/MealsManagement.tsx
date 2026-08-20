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
  caterers?: { name: string }
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
  
  // Top form state (Nieuwe Maaltijd)
  const [newName, setNewName] = useState('')
  const [newCategory, setNewCategory] = useState('')
  const [newPrice, setNewPrice] = useState<string | number>('')
  const [newPriceKleuter, setNewPriceKleuter] = useState<string | number>('')
  const [newPriceLager, setNewPriceLager] = useState<string | number>('')
  const [newCatererId, setNewCatererId] = useState('')
  const [newIsActive, setNewIsActive] = useState(true)

  const [savingNew, setSavingNew] = useState(false)

  // Inline edit state
  const [editId, setEditId] = useState<string | null>(null)
  const [editForm, setEditForm] = useState<Partial<Meal>>({})
  const [savingEdit, setSavingEdit] = useState(false)

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
      const activeCaterer = caterersRes.caterers.find((c: Caterer) => c.id === activeCatererId)
      if (activeCaterer) {
        setCaterers([activeCaterer])
        if (!newCatererId) setNewCatererId(activeCaterer.id)
      } else {
        setCaterers([])
      }
    }
    setLoading(false)
  }

  useEffect(() => {
    loadData()
  }, [activeCatererId, activeTab])

  const resetNewForm = () => {
    setNewName('')
    setNewCategory('')
    setNewPrice('')
    setNewPriceKleuter('')
    setNewPriceLager('')
    setNewIsActive(true)
    if (caterers.length > 0) setNewCatererId(caterers[0].id)
  }

  const cancelEdit = () => {
    setEditId(null)
    setEditForm({})
  }

  const startEdit = (meal: Meal) => {
    setEditId(meal.id)
    setEditForm({ ...meal })
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

  const handleCreateNew = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setSavingNew(true)
    setError(null)
    
    const formData = new FormData()
    formData.append('name', newName)
    formData.append('caterer_id', newCatererId)
    formData.append('is_active', newIsActive.toString())
    
    if (activeTab === 'teacher') {
      formData.append('category', newCategory)
      formData.append('price', String(newPrice).replace(',', '.'))
    } else {
      formData.append('price_kleuter', String(newPriceKleuter).replace(',', '.'))
      formData.append('price_lager', String(newPriceLager).replace(',', '.'))
    }

    const res = activeTab === 'teacher' ? await saveMeal(formData) : await saveStudentMeal(formData)
    
    if (res.error) {
      setError(res.error)
    } else {
      resetNewForm()
      loadData()
    }
    setSavingNew(false)
  }

  const handleSaveEdit = async (e: React.FormEvent | React.MouseEvent) => {
    e.preventDefault()
    if (!editId) return

    setSavingEdit(true)
    setError(null)
    
    const formData = new FormData()
    formData.append('id', editId)
    formData.append('name', editForm.name || '')
    formData.append('caterer_id', editForm.caterer_id || '')
    formData.append('is_active', (editForm.is_active ?? true).toString())
    
    if (activeTab === 'teacher') {
      formData.append('category', editForm.category || '')
      formData.append('price', String(editForm.price || 0).replace(',', '.'))
    } else {
      formData.append('price_kleuter', String(editForm.price_kleuter || 0).replace(',', '.'))
      formData.append('price_lager', String(editForm.price_lager || 0).replace(',', '.'))
    }

    const res = activeTab === 'teacher' ? await saveMeal(formData) : await saveStudentMeal(formData)
    
    if (res.error) {
      setError(res.error)
    } else {
      cancelEdit()
      loadData()
    }
    setSavingEdit(false)
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
            onClick={() => { setActiveTab('teacher'); resetNewForm(); cancelEdit(); }}
            className={`${styles.btn} ${activeTab === 'teacher' ? styles.btnPrimary : styles.btnSecondary}`}
          >
            Leerkrachten
          </button>
          <button 
            onClick={() => { setActiveTab('student'); resetNewForm(); cancelEdit(); }}
            className={`${styles.btn} ${activeTab === 'student' ? styles.btnPrimary : styles.btnSecondary}`}
          >
            Leerlingen
          </button>
        </div>
      </div>
      
      {error && <div style={{ color: 'var(--primary)', marginBottom: '1rem', backgroundColor: 'rgba(255,0,0,0.1)', padding: '1rem', borderRadius: '8px' }}>{error}</div>}

      <div className={`${styles.formCard} no-print`}>
        <h3 style={{ fontSize: '1.1rem', fontWeight: 'bold', marginBottom: '1rem' }}>
          Nieuwe Maaltijd Toevoegen
        </h3>
        <form onSubmit={handleCreateNew} className={styles.formGrid}>
          <div className={styles.formGroup}>
            <label className={styles.label}>Naam</label>
            <input 
              type="text" 
              className={styles.input} 
              value={newName} 
              onChange={e => setNewName(e.target.value)} 
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
                value={newCategory} 
                onChange={e => setNewCategory(e.target.value)} 
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
                step="0.1" 
                min="0"
                className={styles.input} 
                value={newPrice} 
                onChange={e => setNewPrice(e.target.value)} 
                required 
              />
            </div>
          ) : (
            <>
              <div className={styles.formGroup}>
                <label className={styles.label}>Prijs Kleuter (€)</label>
                <input 
                  type="number" 
                  step="0.1" 
                  min="0"
                  className={styles.input} 
                  value={newPriceKleuter} 
                  onChange={e => setNewPriceKleuter(e.target.value)} 
                  required 
                />
              </div>
              <div className={styles.formGroup}>
                <label className={styles.label}>Prijs Lager (€)</label>
                <input 
                  type="number" 
                  step="0.1" 
                  min="0"
                  className={styles.input} 
                  value={newPriceLager} 
                  onChange={e => setNewPriceLager(e.target.value)} 
                  required 
                />
              </div>
            </>
          )}

          <div className={styles.formGroup}>
            <label className={styles.label}>Traiteur</label>
            <select 
              className={styles.select} 
              value={newCatererId} 
              onChange={e => setNewCatererId(e.target.value)}
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
                checked={newIsActive} 
                onChange={e => setNewIsActive(e.target.checked)} 
              />
              Actief (kan besteld worden)
            </label>
          </div>
          <div className={styles.formActions}>
            <button type="submit" className={styles.btn} disabled={savingNew}>
              {savingNew ? 'Toevoegen...' : 'Toevoegen'}
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
              <th className="no-print" style={{ minWidth: '150px' }}>Acties</th>
            </tr>
          </thead>
          <tbody>
            {meals.map(meal => {
              const isEditing = editId === meal.id

              return (
                <tr key={meal.id} style={{ opacity: (!isEditing && !meal.is_active) ? 0.6 : 1, backgroundColor: isEditing ? 'var(--surface-hover)' : 'transparent' }}>
                  {isEditing ? (
                    // EDIT MODE
                    <>
                      <td>
                        <input 
                          type="text" 
                          value={editForm.name || ''} 
                          onChange={e => setEditForm({ ...editForm, name: e.target.value })}
                          className={styles.input}
                          style={{ minWidth: '150px' }}
                        />
                      </td>
                      {activeTab === 'teacher' && (
                        <td>
                          <input 
                            type="text" 
                            value={editForm.category || ''} 
                            onChange={e => setEditForm({ ...editForm, category: e.target.value })}
                            className={styles.input}
                            style={{ minWidth: '100px' }}
                          />
                        </td>
                      )}
                      {activeTab === 'teacher' ? (
                        <td>
                          <input 
                            type="number" 
                            step="0.1" 
                            value={editForm.price ?? ''} 
                            onChange={e => setEditForm({ ...editForm, price: e.target.value })}
                            className={styles.input}
                            style={{ width: '80px' }}
                          />
                        </td>
                      ) : (
                        <>
                          <td>
                            <input 
                              type="number" 
                              step="0.1" 
                              value={editForm.price_kleuter ?? ''} 
                              onChange={e => setEditForm({ ...editForm, price_kleuter: e.target.value })}
                              className={styles.input}
                              style={{ width: '80px' }}
                            />
                          </td>
                          <td>
                            <input 
                              type="number" 
                              step="0.1" 
                              value={editForm.price_lager ?? ''} 
                              onChange={e => setEditForm({ ...editForm, price_lager: e.target.value })}
                              className={styles.input}
                              style={{ width: '80px' }}
                            />
                          </td>
                        </>
                      )}
                      <td>
                        <select 
                          value={editForm.caterer_id || ''} 
                          onChange={e => setEditForm({ ...editForm, caterer_id: e.target.value })}
                          className={styles.select}
                        >
                          {caterers.map(c => (
                            <option key={c.id} value={c.id}>{c.name}</option>
                          ))}
                        </select>
                      </td>
                      <td>
                        <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', whiteSpace: 'nowrap' }}>
                          <input 
                            type="checkbox" 
                            checked={editForm.is_active ?? true} 
                            onChange={e => setEditForm({ ...editForm, is_active: e.target.checked })} 
                          />
                          Actief
                        </label>
                      </td>
                      <td className="no-print">
                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                          <button onClick={handleSaveEdit} disabled={savingEdit} className={`${styles.actionBtn} ${styles.editBtn}`} style={{ backgroundColor: 'var(--success)' }}>
                            {savingEdit ? '...' : 'Opslaan'}
                          </button>
                          <button onClick={cancelEdit} disabled={savingEdit} className={`${styles.actionBtn} ${styles.deleteBtn}`} style={{ backgroundColor: 'var(--text-muted)' }}>
                            Annuleer
                          </button>
                        </div>
                      </td>
                    </>
                  ) : (
                    // VIEW MODE
                    <>
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
                          <button onClick={() => startEdit(meal)} className={`${styles.actionBtn} ${styles.editBtn}`}>
                            Wijzig
                          </button>
                          <button onClick={() => handleDelete(meal.id)} className={`${styles.actionBtn} ${styles.deleteBtn}`}>
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
    </div>
  )
}
