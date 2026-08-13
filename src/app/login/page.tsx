'use client'

import { useState } from 'react'
import Link from 'next/link'
import { login, signup } from './actions'
import styles from './login.module.css'

export default function LoginPage() {
  const [isLogin, setIsLogin] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)

  async function handleSubmit(formData: FormData) {
    setLoading(true)
    setError(null)
    
    if (!isLogin) {
      const password = formData.get('password') as string
      const confirmPassword = formData.get('confirmPassword') as string
      if (password !== confirmPassword) {
        setError('De wachtwoorden komen niet overeen.')
        setLoading(false)
        return
      }
    }
    
    const action = isLogin ? login : signup
    const result = await action(formData)
    
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
          {isLogin ? 'Welkom terug' : 'Maak een account'}
        </h1>
        <p className={styles.subtitle}>
          {isLogin 
            ? 'Log in om je maaltijd te bestellen' 
            : 'Registreer om toegang te krijgen tot het portaal'}
        </p>

        {error && <div className={styles.errorMessage}>{error}</div>}

        <form action={handleSubmit}>
          {!isLogin && (
            <>
              <div className={styles.formGroup}>
                <label htmlFor="firstName">Voornaam</label>
                <input 
                  type="text" 
                  id="firstName" 
                  name="firstName" 
                  required={!isLogin} 
                  placeholder="Typ je voornaam"
                />
              </div>
              <div className={styles.formGroup}>
                <label htmlFor="lastName">Achternaam</label>
                <input 
                  type="text" 
                  id="lastName" 
                  name="lastName" 
                  required={!isLogin}
                  placeholder="Typ je achternaam"
                />
              </div>
            </>
          )}

          <div className={styles.formGroup}>
            <label htmlFor="email">E-mailadres</label>
            <input 
              type="email" 
              id="email" 
              name="email" 
              required 
              placeholder="bijv. naam@school.be"
            />
          </div>

          <div className={styles.formGroup}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <label htmlFor="password">Wachtwoord</label>
              {isLogin && (
                <Link href="/wachtwoord-vergeten" style={{ fontSize: '0.85rem', color: 'var(--primary)', textDecoration: 'none' }}>
                  Wachtwoord vergeten?
                </Link>
              )}
            </div>
            <div style={{ position: 'relative' }}>
              <input 
                type={showPassword ? "text" : "password"} 
                id="password" 
                name="password" 
                required 
                placeholder="••••••••"
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

          {!isLogin && (
            <div className={styles.formGroup}>
              <label htmlFor="confirmPassword">Bevestig Wachtwoord</label>
              <div style={{ position: 'relative' }}>
                <input 
                  type={showPassword ? "text" : "password"} 
                  id="confirmPassword" 
                  name="confirmPassword" 
                  required={!isLogin} 
                  placeholder="••••••••"
                  style={{ width: '100%', paddingRight: '40px' }}
                />
              </div>
            </div>
          )}

          <button 
            type="submit" 
            className={`btn btn-primary ${styles.submitBtn}`}
            disabled={loading}
          >
            {loading ? 'Bezig...' : (isLogin ? 'Inloggen' : 'Registreren')}
          </button>
        </form>

        <div className="text-center mt-6">
          <p className="text-muted" style={{ fontSize: '0.875rem' }}>
            {isLogin ? 'Nog geen account?' : 'Heb je al een account?'}
            {' '}
            <button 
              type="button" 
              onClick={() => {
                setIsLogin(!isLogin)
                setError(null)
              }}
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--primary)',
                fontWeight: '600',
                cursor: 'pointer',
                fontFamily: 'inherit',
                fontSize: '0.875rem'
              }}
            >
              {isLogin ? 'Registreer hier' : 'Log in'}
            </button>
          </p>
        </div>
      </div>
    </div>
  )
}
