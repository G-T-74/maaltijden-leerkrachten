'use client'

import { useState, useEffect } from 'react'
import { getMealsForSchool, placeOrder } from '@/app/actions/order'
import styles from './OrderForm.module.css'

type School = {
  id: string
  name: string
  caterer_id: string | null
  logo_url: string | null
}

type Meal = {
  id: string
  name: string
  category: string
  price: number
}

type OrderFormProps = {
  userSchools: { school: School }[]
}

export default function OrderForm({ userSchools }: OrderFormProps) {
  const [selectedSchoolId, setSelectedSchoolId] = useState<string>(
    userSchools.length > 0 ? userSchools[0].school.id : ''
  )
  const [meals, setMeals] = useState<Meal[]>([])
  const [selectedSchoolDetails, setSelectedSchoolDetails] = useState<School | null>(null)
  const [selectedMealId, setSelectedMealId] = useState<string>('')
  const [quantity, setQuantity] = useState<number>(1)
  const [orderDate, setOrderDate] = useState<string>('')
  
  const [loading, setLoading] = useState<boolean>(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<boolean>(false)

  // Initialize date logic (08:15 deadline)
  useEffect(() => {
    const now = new Date()
    // Brussels time approximation
    const brusselsTime = new Date(now.toLocaleString("en-US", { timeZone: "Europe/Brussels" }))
    const currentHour = brusselsTime.getHours()
    const currentMinute = brusselsTime.getMinutes()
    
    let defaultDate = new Date(brusselsTime)
    
    // If it's past 08:15, default to tomorrow
    if (currentHour > 8 || (currentHour === 8 && currentMinute >= 15)) {
      defaultDate.setDate(defaultDate.getDate() + 1)
    }
    
    // Format YYYY-MM-DD
    setOrderDate(defaultDate.toISOString().split('T')[0])
  }, [])

  // Fetch meals when school changes
  useEffect(() => {
    async function loadMeals() {
      if (!selectedSchoolId) return
      
      setLoading(true)
      const result = await getMealsForSchool(selectedSchoolId)
      
      if (result.error) {
        setError(result.error)
        setMeals([])
      } else {
        setMeals(result.meals)
        setSelectedSchoolDetails(result.school || null)
        setError(null)
      }
      setLoading(false)
    }
    
    loadMeals()
  }, [selectedSchoolId])

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setError(null)
    setSuccess(false)
    setLoading(true)

    const formData = new FormData(e.currentTarget)
    const result = await placeOrder(formData)

    if (result.error) {
      setError(result.error)
    } else if (result.success) {
      setSuccess(true)
      setSelectedMealId('')
      setQuantity(1)
    }
    setLoading(false)
  }

  return (
    <div className={styles.formContainer}>
      {selectedSchoolDetails && (
        <div className={styles.schoolHeader}>
          {selectedSchoolDetails.logo_url && (
            <img 
              src={selectedSchoolDetails.logo_url} 
              alt={`Logo ${selectedSchoolDetails.name}`} 
              className={styles.schoolLogo} 
            />
          )}
          <h2 className={styles.schoolName}>{selectedSchoolDetails.name}</h2>
        </div>
      )}

      {error && <div className={styles.error}>{error}</div>}
      {success && <div className={styles.success}>Je bestelling is succesvol geplaatst!</div>}

      <form onSubmit={handleSubmit}>
        <div className={styles.formGroup}>
          <label className={styles.label}>School</label>
          <select 
            name="school_id" 
            className={styles.select}
            value={selectedSchoolId}
            onChange={(e) => {
              setSelectedSchoolId(e.target.value)
              setSelectedMealId('') // Reset meal selection
            }}
            required
          >
            {userSchools.map(({ school }) => (
              <option key={school.id} value={school.id}>
                {school.name}
              </option>
            ))}
          </select>
        </div>

        <div className={styles.formGroup}>
          <label className={styles.label}>Datum</label>
          <input 
            type="date" 
            name="order_date" 
            className={styles.input}
            value={orderDate}
            onChange={(e) => setOrderDate(e.target.value)}
            required
          />
        </div>

        <div className={styles.formGroup}>
          <label className={styles.label}>Kies een maaltijd</label>
          <input type="hidden" name="meal_id" value={selectedMealId} required />
          
          {loading && !meals.length && <p>Laden...</p>}
          {!loading && meals.length === 0 && <p>Geen maaltijden beschikbaar voor deze school/traiteur.</p>}
          
          <div className={styles.mealsGrid}>
            {meals.map((meal) => (
              <div 
                key={meal.id} 
                className={`${styles.mealCard} ${selectedMealId === meal.id ? styles.selected : ''}`}
                onClick={() => setSelectedMealId(meal.id)}
              >
                <div>
                  <div className={styles.mealCategory}>{meal.category}</div>
                  <div className={styles.mealName}>{meal.name}</div>
                </div>
                <div className={styles.mealPrice}>€{meal.price.toFixed(2)}</div>
              </div>
            ))}
          </div>
        </div>

        <div className={styles.formGroup}>
          <label className={styles.label}>Aantal</label>
          <input 
            type="number" 
            name="quantity" 
            className={styles.input}
            min="1"
            value={quantity}
            onChange={(e) => setQuantity(parseInt(e.target.value))}
            required
          />
        </div>

        <button 
          type="submit" 
          className={styles.submitBtn}
          disabled={loading || !selectedMealId}
        >
          {loading ? 'Bezig met bestellen...' : 'Bestelling Plaatsen'}
        </button>
      </form>
    </div>
  )
}
