'use client'

import { useState } from 'react'
import { savePreferredCategory } from '@/app/profile/actions'

type Props = {
  initialCategory: string
  availableCategories: string[]
}

export default function PreferredCategorySetting({ initialCategory, availableCategories }: Props) {
  const [selected, setSelected] = useState<string>(initialCategory || '')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSave = async () => {
    setSaving(true)
    setError(null)
    setSaved(false)

    const res = await savePreferredCategory(selected)
    if (res?.error) {
      setError(res.error)
    } else {
      setSaved(true)
      setTimeout(() => setSaved(false), 4000)
    }
    setSaving(false)
  }

  // Helper om categorie netjes met hoofdletter te tonen
  const formatCategoryName = (cat: string) => {
    if (!cat) return ''
    return cat.charAt(0).toUpperCase() + cat.slice(1)
  }

  return (
    <div style={{
      padding: '1.5rem',
      backgroundColor: 'var(--surface)',
      borderRadius: 'var(--radius-md)',
      border: '1px solid var(--border)',
      marginBottom: '2rem'
    }}>
      <p style={{ color: 'var(--text-muted)', marginBottom: '1rem', fontSize: '0.95rem' }}>
        Kies welke maaltijdcategorie standaard geselecteerd staat wanneer je naar &apos;Mijn maaltijden&apos; gaat. Handig als je bijvoorbeeld meestal een broodje of koude schotel kiest!
      </p>

      <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', flexWrap: 'wrap' }}>
        <select
          value={selected}
          onChange={(e) => setSelected(e.target.value)}
          style={{
            padding: '0.65rem 1rem',
            borderRadius: 'var(--radius-sm)',
            border: '1px solid var(--border)',
            backgroundColor: 'var(--background)',
            color: 'var(--text-main)',
            fontSize: '1rem',
            minWidth: '260px',
            cursor: 'pointer'
          }}
        >
          <option value="">-- Geen voorkeur (Automatisch Warm) --</option>
          {availableCategories.map(cat => (
            <option key={cat} value={cat}>
              {formatCategoryName(cat)}
            </option>
          ))}
        </select>

        <button
          onClick={handleSave}
          disabled={saving}
          style={{
            padding: '0.65rem 1.25rem',
            backgroundColor: 'var(--primary)',
            color: 'white',
            border: 'none',
            borderRadius: 'var(--radius-sm)',
            fontWeight: 600,
            cursor: saving ? 'not-allowed' : 'pointer',
            opacity: saving ? 0.7 : 1,
            transition: 'background-color 0.2s'
          }}
        >
          {saving ? 'Opslaan...' : 'Voorkeur Opslaan'}
        </button>
      </div>

      {saved && (
        <div style={{ 
          marginTop: '1rem', 
          color: 'var(--success)', 
          display: 'flex', 
          alignItems: 'center', 
          gap: '0.5rem',
          fontSize: '0.9rem',
          fontWeight: 500
        }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12"/>
          </svg>
          Voorkeur succesvol opgeslagen!
        </div>
      )}

      {error && (
        <div style={{ marginTop: '1rem', color: 'var(--error)', fontSize: '0.9rem' }}>
          {error}
        </div>
      )}
    </div>
  )
}
