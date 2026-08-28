'use client'

import React from 'react'
import Link from 'next/link'

export default function NavigationTabs({ activeSchoolId, currentTab }: { activeSchoolId: string, currentTab: 'leerlingen' | 'mijn-maaltijden' }) {
  const navigate = (path: string) => {
    // Explicit hard-navigation guarantees URL params are not stripped by Next.js router caches
    window.location.assign(`${path}?school=${activeSchoolId}`)
  }

  return (
    <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem', borderBottom: '1px solid var(--border)', paddingBottom: '1rem' }}>
      <Link 
        href={`/leerlingen?school=${activeSchoolId}`}
        className="btn" 
        style={{ 
          backgroundColor: currentTab === 'leerlingen' ? 'var(--primary)' : 'transparent', 
          color: currentTab === 'leerlingen' ? 'white' : 'var(--text-main)',
          border: currentTab === 'leerlingen' ? 'none' : '1px solid var(--border)',
          cursor: 'pointer',
          textDecoration: 'none'
        }}
      >
        Leerlingenmaaltijden
      </Link>
      <Link 
        href={`/mijn-maaltijden?school=${activeSchoolId}`}
        className="btn" 
        style={{ 
          backgroundColor: currentTab === 'mijn-maaltijden' ? 'var(--primary)' : 'transparent', 
          color: currentTab === 'mijn-maaltijden' ? 'white' : 'var(--text-main)',
          border: currentTab === 'mijn-maaltijden' ? 'none' : '1px solid var(--border)',
          cursor: 'pointer',
          textDecoration: 'none'
        }}
      >
        Mijn Maaltijden
      </Link>
    </div>
  )
}
