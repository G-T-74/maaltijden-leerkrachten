'use client'

import { useState } from 'react'
import Link from 'next/link'
import { sendResetLink } from './actions'
import styles from '../login/login.module.css'

export default function WachtwoordVergetenPage() {
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(formData: FormData) {
    setLoading(true)
    setError(null)
    setSuccess(null)
    
    const result = await sendResetLink(formData)
    
    if (result?.error) {
      setError(result.error)
    } else if (result?.success) {
      setSuccess(result.success)
    }
    
    setLoading(false)
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
          Wachtwoord Vergeten
        </h1>
        <p className={styles.subtitle}>
          Vul je e-mailadres in om een herstellink te ontvangen.
        </p>

        {error && <div className={styles.errorMessage}>{error}</div>}
        {success && <div style={{ 
          padding: '1rem', 
          backgroundColor: '#e6f4ea', 
          color: '#137333', 
          borderRadius: '8px', 
          marginBottom: '1.5rem',
          fontSize: '0.9rem',
          lineHeight: '1.5'
        }}>{success}</div>}

        <form action={handleSubmit}>
          <div className={styles.formGroup}>
            <label htmlFor="email">E-mailadres</label>
            <input 
              type="email" 
              id="email" 
              name="email" 
              required 
              placeholder="voorbeeld@school.be"
            />
          </div>

          <button type="submit" className={styles.submitButton} disabled={loading || !!success}>
            {loading ? 'Verzenden...' : 'Stuur reset link'}
          </button>
        </form>

        <div className={styles.toggleText}>
          <Link href="/login" style={{ color: 'var(--primary)', textDecoration: 'none' }}>
            Terug naar inloggen
          </Link>
        </div>
      </div>
    </div>
  )
}
