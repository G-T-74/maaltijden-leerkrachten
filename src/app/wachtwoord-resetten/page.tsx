'use client'

import { useState } from 'react'
import { resetPassword } from './actions'
import styles from '../login/login.module.css'

export default function WachtwoordResettenPage() {
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(formData: FormData) {
    setLoading(true)
    setError(null)
    
    const result = await resetPassword(formData)
    
    if (result?.error) {
      setError(result.error)
      setLoading(false)
    }
  }

  return (
    <div className={styles.container}>
      <div className={styles.card}>
        <div className={styles.logoContainer}>
          <div className={styles.logoPlaceholder}>
            <span>S</span>
          </div>
        </div>
        
        <h1 className={styles.title}>
          Nieuw Wachtwoord
        </h1>
        <p className={styles.subtitle}>
          Stel een nieuw wachtwoord in voor je account.
        </p>

        {error && <div className={styles.errorMessage}>{error}</div>}

        <form action={handleSubmit}>
          <div className={styles.formGroup}>
            <label htmlFor="password">Nieuw Wachtwoord</label>
            <input 
              type="password" 
              id="password" 
              name="password" 
              required 
              placeholder="••••••••"
              minLength={6}
            />
          </div>

          <button type="submit" className={styles.submitButton} disabled={loading}>
            {loading ? 'Bezig met opslaan...' : 'Wachtwoord opslaan'}
          </button>
        </form>
      </div>
    </div>
  )
}
