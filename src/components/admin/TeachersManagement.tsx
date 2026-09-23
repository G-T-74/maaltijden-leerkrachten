'use client'

import { useState, useEffect } from 'react'
import { getSchoolTeachers, unlinkTeacherFromSchool } from '@/app/actions/admin'
import styles from './AdminTabs.module.css'

export default function TeachersManagement({ schoolId }: { schoolId: string }) {
  const [teachers, setTeachers] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    loadTeachers()
  }, [schoolId])

  const loadTeachers = async () => {
    setLoading(true)
    setError('')
    const res = await getSchoolTeachers(schoolId)
    if (res.error) {
      setError(res.error)
    } else if (res.teachers) {
      setTeachers(res.teachers)
    }
    setLoading(false)
  }

  const handleUnlink = async (teacherId: string, teacherName: string) => {
    if (!confirm(`Weet je zeker dat je ${teacherName} wilt ontkoppelen van deze school?`)) return

    const res = await unlinkTeacherFromSchool(teacherId, schoolId)
    if (res.error) {
      alert(`Fout bij ontkoppelen: ${res.error}`)
    } else {
      loadTeachers()
    }
  }

  if (loading) return <div>Leerkrachten laden...</div>
  if (error) return <div style={{ color: 'var(--error)' }}>{error}</div>

  return (
    <div style={{ backgroundColor: 'var(--surface)', padding: '1.5rem', borderRadius: '8px', border: '1px solid var(--border)' }}>
      <h3 style={{ fontSize: '1.25rem', fontWeight: 600, marginBottom: '1rem', color: 'var(--primary)' }}>Leerkrachten Beheer</h3>
      <p style={{ marginBottom: '1.5rem', color: 'var(--text-muted)' }}>
        Hier zie je welke leerkrachten gekoppeld zijn aan deze school. Je kan leerkrachten die hier niet meer werken ontkoppelen.
      </p>

      {teachers.length === 0 ? (
        <p>Er zijn momenteel geen leerkrachten gekoppeld aan deze school.</p>
      ) : (
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
          <thead>
            <tr style={{ borderBottom: '2px solid var(--border)' }}>
              <th style={{ padding: '0.75rem 0' }}>Naam</th>
              <th style={{ padding: '0.75rem 0', width: '100px' }}>Acties</th>
            </tr>
          </thead>
          <tbody>
            {teachers.map(teacher => (
              <tr key={teacher.id} style={{ borderBottom: '1px solid var(--border)' }}>
                <td style={{ padding: '0.75rem 0', fontWeight: 500 }}>{teacher.name}</td>
                <td style={{ padding: '0.75rem 0' }}>
                  <button 
                    onClick={() => handleUnlink(teacher.id, teacher.name)}
                    style={{ 
                      backgroundColor: 'transparent', 
                      color: '#ef4444', 
                      border: '1px solid #ef4444', 
                      padding: '4px 8px', 
                      borderRadius: '4px',
                      cursor: 'pointer',
                      fontSize: '0.875rem'
                    }}
                  >
                    Ontkoppel
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}
