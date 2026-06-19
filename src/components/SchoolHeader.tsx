'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import Image from 'next/image'

type School = {
  id: string
  name: string
  caterer_id: string | null
  logo_url: string | null
  order_deadline?: string
}

type SchoolHeaderProps = {
  userSchools: { school: School }[]
  activeSchoolId: string
  basePath: string // '/leerlingen' of '/mijn-maaltijden'
}

export default function SchoolHeader({ userSchools, activeSchoolId, basePath }: SchoolHeaderProps) {
  const router = useRouter()
  const searchParams = useSearchParams()

  const activeSchool = userSchools.find(us => us.school.id === activeSchoolId)?.school

  const handleSchoolChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newSchoolId = e.target.value
    const currentParams = new URLSearchParams(Array.from(searchParams.entries()))
    currentParams.set('school', newSchoolId)
    window.location.assign(`${basePath}?${currentParams.toString()}`)
  }

  if (userSchools.length === 0) return null

  return (
    <div style={{ 
      display: 'flex', 
      alignItems: 'center', 
      justifyContent: 'space-between', 
      marginBottom: '2rem',
      backgroundColor: 'var(--surface)',
      padding: '1.5rem',
      borderRadius: 'var(--radius-md)',
      boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
      border: '1px solid var(--border)'
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
        {activeSchool?.logo_url ? (
          <div style={{ width: '80px', height: '80px', position: 'relative', overflow: 'hidden', borderRadius: 'var(--radius-md)' }}>
            <Image 
              src={activeSchool.logo_url} 
              alt={`Logo ${activeSchool.name}`}
              fill
              style={{ objectFit: 'contain' }}
            />
          </div>
        ) : (
          <div style={{ 
            width: '80px', height: '80px', 
            backgroundColor: 'var(--primary)', 
            borderRadius: 'var(--radius-md)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: 'white', fontWeight: 'bold', fontSize: '2rem'
          }}>
            {activeSchool?.name.charAt(0)}
          </div>
        )}
        
        <div>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 'bold', margin: '0 0 0.5rem 0', color: 'var(--text-main)' }}>
            {activeSchool?.name}
          </h2>
          <p style={{ margin: 0, color: 'var(--text-muted)' }}>
            Bestellen voor deze school
          </p>
        </div>
      </div>

      <div>
        {userSchools.length > 1 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <label htmlFor="schoolSelector" style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-main)' }}>
              Wissel van school:
            </label>
            <select
              id="schoolSelector"
              value={activeSchoolId}
              onChange={handleSchoolChange}
              style={{
                padding: '0.5rem 1rem',
                borderRadius: 'var(--radius-sm)',
                border: '1px solid var(--border)',
                backgroundColor: 'var(--background)',
                color: 'var(--text-main)',
                fontSize: '1rem',
                minWidth: '200px',
                cursor: 'pointer'
              }}
            >
              {userSchools.map(us => (
                <option key={us.school.id} value={us.school.id}>
                  {us.school.name}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>
    </div>
  )
}
