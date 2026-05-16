"use client"

import * as React from "react"
import { useTheme } from "next-themes"

export function ThemeToggle() {
  const { theme, setTheme } = useTheme()
  const [mounted, setMounted] = React.useState(false)

  // Avoid hydration mismatch
  React.useEffect(() => {
    setMounted(true)
  }, [])

  if (!mounted) {
    return <div style={{ height: '40px' }} /> // placeholder
  }

  return (
    <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '2rem' }}>
      <button 
        onClick={() => setTheme('light')}
        className="btn"
        style={{ 
          flex: 1, 
          backgroundColor: theme === 'light' ? 'var(--primary)' : 'var(--surface)', 
          color: theme === 'light' ? 'white' : 'var(--text-main)',
          border: '1px solid var(--border)'
        }}
      >
        Licht
      </button>
      <button 
        onClick={() => setTheme('dark')}
        className="btn"
        style={{ 
          flex: 1, 
          backgroundColor: theme === 'dark' ? 'var(--primary)' : 'var(--surface)', 
          color: theme === 'dark' ? 'white' : 'var(--text-main)',
          border: '1px solid var(--border)'
        }}
      >
        Donker
      </button>
      <button 
        onClick={() => setTheme('system')}
        className="btn"
        style={{ 
          flex: 1, 
          backgroundColor: theme === 'system' ? 'var(--primary)' : 'var(--surface)', 
          color: theme === 'system' ? 'white' : 'var(--text-main)',
          border: '1px solid var(--border)'
        }}
      >
        Systeem
      </button>
    </div>
  )
}
