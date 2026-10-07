'use client'

import { useState, useEffect } from 'react'
import { getSchoolTeachers, unlinkTeacherFromSchool, getPlatformUsers, linkTeacherToSchool, checkIsSuperAdmin, deletePlatformUser, resetUserPassword } from '@/app/actions/admin'
import styles from './AdminTabs.module.css'

export default function TeachersManagement({ schoolId }: { schoolId: string }) {
  const [teachers, setTeachers] = useState<any[]>([])
  const [allUsers, setAllUsers] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [selectedUserId, setSelectedUserId] = useState('')
  const [linking, setLinking] = useState(false)
  const [isSuperAdmin, setIsSuperAdmin] = useState(false)

  useEffect(() => {
    loadData()
  }, [schoolId])

  const loadData = async () => {
    setLoading(true)
    setError('')
    
    const [teachersRes, usersRes, superAdminRes] = await Promise.all([
      getSchoolTeachers(schoolId),
      getPlatformUsers(),
      checkIsSuperAdmin()
    ])

    if (teachersRes.error) {
      setError(teachersRes.error)
    } else if (teachersRes.teachers) {
      setTeachers(teachersRes.teachers)
    }

    if (usersRes.users) {
      setAllUsers(usersRes.users)
    }

    setIsSuperAdmin(superAdminRes)
    setLoading(false)
  }

  const handleUnlink = async (teacherId: string, teacherName: string) => {
    if (!confirm(`Weet je zeker dat je ${teacherName} wilt ontkoppelen van deze school?`)) return

    const res = await unlinkTeacherFromSchool(teacherId, schoolId)
    if (res.error) {
      alert(`Fout bij ontkoppelen: ${res.error}`)
    } else {
      loadData()
    }
  }

  const handleLink = async () => {
    if (!selectedUserId) return
    setLinking(true)
    const res = await linkTeacherToSchool(selectedUserId, schoolId)
    if (res.error) {
      alert(`Fout bij koppelen: ${res.error}`)
    } else {
      setSelectedUserId('')
      loadData()
    }
    setLinking(false)
  }

  const handleDeleteUser = async (userId: string, userName: string) => {
    if (!confirm(`LET OP: Weet je zeker dat je het volledige account van ${userName} wilt VERWIJDEREN van het platform? Dit kan niet ongedaan gemaakt worden.`)) return
    
    const res = await deletePlatformUser(userId)
    if (res.error) {
      alert(`Fout bij verwijderen: ${res.error}`)
    } else {
      alert('Gebruiker is succesvol verwijderd.')
      loadData()
    }
  }

  const handleResetPassword = async (userId: string, userName: string) => {
    if (!confirm(`Weet je zeker dat je een nieuw wachtwoord wilt genereren voor ${userName}?`)) return
    
    const res = await resetUserPassword(userId)
    if (res.error) {
      alert(`Fout bij resetten: ${res.error}`)
    } else {
      alert(`Wachtwoord gereset! Het nieuwe wachtwoord voor ${userName} is: \n\n${res.newPassword}\n\nGeef dit veilig door aan de leerkracht.`)
    }
  }

  if (loading) return <div>Leerkrachten laden...</div>
  if (error) return <div style={{ color: 'var(--error)' }}>{error}</div>

  // Filter leerkrachten die nog niet gekoppeld zijn
  const unlinkedTeachers = allUsers.filter(u => !teachers.find(t => t.id === u.id))

  const mailtoLink = `mailto:?subject=Uitnodiging%20Maaltijden%20Platform&body=Beste%20collega,%0D%0A%0D%0AGelieve%20een%20account%20aan%20te%20maken%20op%20het%20maaltijdenplatform%20zodat%20we%20jou%20kunnen%20koppelen%20aan%20onze%20school.%0D%0A%0D%0AMet%20vriendelijke%20groeten,`

  return (
    <div style={{ backgroundColor: 'var(--surface)', padding: '1.5rem', borderRadius: '8px', border: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      
      <div>
        <h3 style={{ fontSize: '1.25rem', fontWeight: 600, marginBottom: '1rem', color: 'var(--primary)' }}>Leerkracht Koppelen</h3>
        <p style={{ marginBottom: '1rem', color: 'var(--text-muted)' }}>
          Koppel een bestaande leerkracht van het platform aan deze school. Staat de leerkracht er niet tussen? Dan moet deze zich eerst registreren.
        </p>
        
        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <select 
            value={selectedUserId} 
            onChange={(e) => setSelectedUserId(e.target.value)}
            style={{ padding: '0.5rem', borderRadius: '4px', border: '1px solid var(--border)', backgroundColor: 'var(--background)', color: 'var(--text-main)', minWidth: '250px' }}
          >
            <option value="">-- Selecteer een leerkracht --</option>
            {unlinkedTeachers.map(u => (
              <option key={u.id} value={u.id}>{u.name}</option>
            ))}
          </select>
          <button 
            onClick={handleLink}
            disabled={!selectedUserId || linking}
            style={{
              padding: '0.5rem 1rem',
              backgroundColor: !selectedUserId || linking ? 'var(--border)' : 'var(--primary)',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: !selectedUserId || linking ? 'not-allowed' : 'pointer',
              fontWeight: 600
            }}
          >
            {linking ? 'Koppelen...' : 'Koppel aan school'}
          </button>

          <a 
            href={mailtoLink}
            style={{
              padding: '0.5rem 1rem',
              backgroundColor: 'transparent',
              color: 'var(--primary)',
              border: '1px solid var(--primary)',
              borderRadius: '4px',
              cursor: 'pointer',
              fontWeight: 600,
              textDecoration: 'none',
              display: 'inline-block'
            }}
          >
            ?? Uitnodigen via mail
          </a>
        </div>
      </div>

      <div>
        <h3 style={{ fontSize: '1.25rem', fontWeight: 600, marginBottom: '1rem', color: 'var(--primary)' }}>Gekoppelde Leerkrachten</h3>
        <p style={{ marginBottom: '1.5rem', color: 'var(--text-muted)' }}>
          Hier zie je welke leerkrachten al gekoppeld zijn aan deze school. Je kan leerkrachten die hier niet meer werken ontkoppelen.
        </p>

        {teachers.length === 0 ? (
          <p>Er zijn momenteel geen leerkrachten gekoppeld aan deze school.</p>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', minWidth: '500px' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid var(--border)' }}>
                  <th style={{ padding: '0.75rem 0' }}>Naam</th>
                  <th style={{ padding: '0.75rem 0' }}>Acties</th>
                </tr>
              </thead>
              <tbody>
                {teachers.map(teacher => (
                  <tr key={teacher.id} style={{ borderBottom: '1px solid var(--border)' }}>
                    <td style={{ padding: '0.75rem 0', fontWeight: 500 }}>{teacher.name}</td>
                    <td style={{ padding: '0.75rem 0' }}>
                      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                        <button 
                          onClick={() => handleUnlink(teacher.id, teacher.name)}
                          style={{ 
                            backgroundColor: 'transparent', 
                            color: '#eab308', 
                            border: '1px solid #eab308', 
                            padding: '4px 8px', 
                            borderRadius: '4px',
                            cursor: 'pointer',
                            fontSize: '0.875rem'
                          }}
                        >
                          Ontkoppel
                        </button>

                        {isSuperAdmin && (
                          <>
                            <button 
                              onClick={() => handleResetPassword(teacher.id, teacher.name)}
                              style={{ 
                                backgroundColor: 'transparent', 
                                color: '#3b82f6', 
                                border: '1px solid #3b82f6', 
                                padding: '4px 8px', 
                                borderRadius: '4px',
                                cursor: 'pointer',
                                fontSize: '0.875rem'
                              }}
                            >
                              Reset Wachtwoord
                            </button>
                            
                            <button 
                              onClick={() => handleDeleteUser(teacher.id, teacher.name)}
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
                              Verwijder Account
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
