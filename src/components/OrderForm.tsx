'use client'

import { useState, useEffect } from 'react'
import { getMealsForSchool, placeOrder } from '@/app/actions/order'
import styles from './OrderForm.module.css'

type School = {
  id: string
  name: string
  caterer_id: string | null
  logo_url: string | null
  order_deadline?: string
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
  const [selectedCategory, setSelectedCategory] = useState<string>('')
  const [quantity, setQuantity] = useState<number>(1)
  const [orderDate, setOrderDate] = useState<string>('')
  
  const [loading, setLoading] = useState<boolean>(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<boolean>(false)

  // Bereken unieke categorieën
  const categories = Array.from(new Set(meals.map(m => m.category))).sort()

  // Functie om de eerstvolgende geldige weekdag te vinden
  const getNextValidDay = (date: Date) => {
    const d = new Date(date)
    while (d.getDay() === 0 || d.getDay() === 6) {
      d.setDate(d.getDate() + 1)
    }
    return d
  }

  // Initialize date logic based on school deadline
  useEffect(() => {
    if (orderDate) return // Alleen initiële datum instellen

    const school = userSchools.find(us => us.school.id === selectedSchoolId)?.school
    const deadline = school?.order_deadline || '08:15:00'
    const [hours, minutes] = deadline.split(':').map(Number)

    const now = new Date()
    // Brussels time approximation
    const brusselsTime = new Date(now.toLocaleString("en-US", { timeZone: "Europe/Brussels" }))
    const currentHour = brusselsTime.getHours()
    const currentMinute = brusselsTime.getMinutes()
    
    let defaultDate = new Date(brusselsTime)
    
    // If it's past the deadline, default to tomorrow
    if (currentHour > hours || (currentHour === hours && currentMinute >= minutes)) {
      defaultDate.setDate(defaultDate.getDate() + 1)
    }
    
    // Zorg dat het geen weekend is
    defaultDate = getNextValidDay(defaultDate)
    
    // Format YYYY-MM-DD
    setOrderDate(defaultDate.toISOString().split('T')[0])
  }, [selectedSchoolId, userSchools, orderDate])

  // Check of gekozen datum een weekend is
  const chosenDateObj = orderDate ? new Date(orderDate) : null
  const isWeekend = chosenDateObj ? (chosenDateObj.getDay() === 0 || chosenDateObj.getDay() === 6) : false

  // Fetch meals when school changes
  useEffect(() => {
    async function loadMeals() {
      if (!selectedSchoolId) return
      
      setLoading(true)
      const result = await getMealsForSchool(selectedSchoolId)
      
      if (result.error) {
        setError(result.error)
        setMeals([])
        setSelectedCategory('')
      } else {
        setMeals(result.meals)
        setSelectedSchoolDetails(result.school || null)
        setError(null)
        
        if (result.meals.length > 0) {
          const uniqueCats = Array.from(new Set(result.meals.map((m: Meal) => m.category))).sort()
          const warmCat = uniqueCats.find(c => c.toLowerCase().includes('warm'))
          setSelectedCategory(warmCat || uniqueCats[0])
        } else {
          setSelectedCategory('')
        }
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
            className={`${styles.input} ${isWeekend ? styles.inputError : ''}`}
            value={orderDate}
            onChange={(e) => setOrderDate(e.target.value)}
            required
          />
          {isWeekend && (
            <p style={{ color: 'var(--primary)', fontSize: '0.875rem', marginTop: '0.5rem' }}>
              Bestellen voor het weekend is niet mogelijk.
            </p>
          )}
        </div>

        {meals.length > 0 && (
          <div className={styles.formGroup}>
            <label className={styles.label}>Categorie</label>
            <select 
              className={styles.select}
              value={selectedCategory}
              onChange={(e) => {
                setSelectedCategory(e.target.value)
                setSelectedMealId('') // Reset selected meal when category changes
              }}
            >
              {categories.map(c => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>
        )}

        <div className={styles.formGroup}>
          <label className={styles.label}>Kies een maaltijd</label>
          <input type="hidden" name="meal_id" value={selectedMealId} required />
          
          {loading && !meals.length && <p>Laden...</p>}
          {!loading && meals.length === 0 && <p>Geen maaltijden beschikbaar voor deze school/traiteur.</p>}
          
          <div className={styles.mealsGrid}>
            {meals.filter(m => m.category === selectedCategory).map((meal) => (
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
          disabled={loading || !selectedMealId || isWeekend}
        >
          {loading ? 'Bezig met bestellen...' : 'Bestelling Plaatsen'}
        </button>
      </form>
    </div>
  )
}
