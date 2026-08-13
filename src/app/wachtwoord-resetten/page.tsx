'use client'

import { useState } from 'react'
import { resetPassword } from './actions'
import styles from '../login/login.module.css'

export default function WachtwoordResettenPage() {
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)

  async function handleSubmit(formData: FormData) {
    setLoading(true)
    setError(null)
    
    const password = formData.get('password') as string
    const confirmPassword = formData.get('confirmPassword') as string
    
    if (password !== confirmPassword) {
      setError('De wachtwoorden komen niet overeen.')
      setLoading(false)
      return
    }
    
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
            <div style={{ position: 'relative' }}>
              <input 
                type={showPassword ? "text" : "password"} 
                id="password" 
                name="password" 
                required 
                placeholder="••••••••"
                minLength={6}
                style={{ width: '100%', paddingRight: '40px' }}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                style={{
                  position: 'absolute',
                  right: '10px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  fontSize: '1.2rem',
                  color: 'var(--muted)',
                  padding: '0'
                }}
                title={showPassword ? 'Wachtwoord verbergen' : 'Wachtwoord tonen'}
              >
                {showPassword ? '👁️‍🗨️' : '👁️'}
              </button>
            </div>
          </div>

          <div className={styles.formGroup}>
            <label htmlFor="confirmPassword">Bevestig Nieuw Wachtwoord</label>
            <div style={{ position: 'relative' }}>
              <input 
                type={showPassword ? "text" : "password"} 
                id="confirmPassword" 
                name="confirmPassword" 
                required 
                placeholder="••••••••"
                minLength={6}
                style={{ width: '100%', paddingRight: '40px' }}
              />
            </div>
          </div>

          <button type="submit" className={styles.submitButton} disabled={loading}>
            {loading ? 'Bezig met opslaan...' : 'Wachtwoord opslaan'}
          </button>
        </form>
      </div>
    </div>
  )
}
