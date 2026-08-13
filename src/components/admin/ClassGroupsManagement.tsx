'use client'

import { useState, useEffect } from 'react'
import { getClassGroups, createClassGroup, updateClassGroup, deleteClassGroup, assignClassToGroup } from '@/app/actions/admin'
import { getClassesAndStudents } from '@/app/actions/student_admin'

export default function ClassGroupsManagement({ schoolId }: { schoolId: string }) {
  const [groups, setGroups] = useState<any[]>([])
  const [classes, setClasses] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  const [newGroupName, setNewGroupName] = useState('')
  const [newGroupCode, setNewGroupCode] = useState('')
  const [creating, setCreating] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')
  const [successMsg, setSuccessMsg] = useState('')

  useEffect(() => {
    loadData()
  }, [schoolId])

  const loadData = async () => {
    setLoading(true)
    const [groupsRes, classesRes] = await Promise.all([
      getClassGroups(schoolId),
      getClassesAndStudents(schoolId)
    ])
    if (groupsRes.groups) setGroups(groupsRes.groups)
    if (classesRes.classes) setClasses(classesRes.classes)
    setLoading(false)
  }

  const handleCreateGroup = async (e: React.FormEvent) => {
    e.preventDefault()
    setCreating(true)
    setErrorMsg('')
    setSuccessMsg('')
    
    if (!newGroupName.trim() || !newGroupCode.trim()) {
      setErrorMsg('Vul zowel naam als bestelcode in.')
      setCreating(false)
      return
    }

    const res = await createClassGroup(schoolId, newGroupName.trim(), newGroupCode.trim())
    if (res.error) {
      setErrorMsg(res.error)
    } else {
      setSuccessMsg('Groep succesvol aangemaakt!')
      setNewGroupName('')
      setNewGroupCode('')
      loadData()
    }
    setCreating(false)
  }

  const handleDeleteGroup = async (groupId: string) => {
    if (!confirm('Weet je zeker dat je deze groep wilt verwijderen? Klassen in deze groep zullen ontkoppeld worden.')) return
    
    const res = await deleteClassGroup(groupId)
    if (res.error) {
      alert(res.error)
    } else {
      loadData()
    }
  }

  const handleAssignClass = async (classId: string, groupId: string) => {
    const res = await assignClassToGroup(classId, groupId === 'none' ? null : groupId)
    if (res.error) {
      alert(res.error)
    } else {
      loadData()
    }
  }

  if (loading) return <div>Groepen laden...</div>

  return (
    <div style={{ padding: '1rem' }}>
      <h2 style={{ fontSize: '1.5rem', fontWeight: 'bold', marginBottom: '1rem' }}>Klassengroepen Beheer</h2>
      <p style={{ color: 'var(--text-muted)', marginBottom: '2rem' }}>
        Groepeer klassen samen onder een specifieke bestelcode (bijv. Kleuters = XC01). Deze groepering bepaalt hoe de totalen in het keukenoverzicht getoond worden. Zorg dat alle klassen aan een groep zijn toegewezen.
      </p>

      {errorMsg && <div style={{ padding: '1rem', backgroundColor: '#ffebee', color: '#c62828', borderRadius: '4px', marginBottom: '1rem' }}>{errorMsg}</div>}
      {successMsg && <div style={{ padding: '1rem', backgroundColor: '#e8f5e9', color: '#2e7d32', borderRadius: '4px', marginBottom: '1rem' }}>{successMsg}</div>}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem' }}>
        {/* Nieuwe Groep Maken & Lijst */}
        <div>
          <div style={{ backgroundColor: 'var(--surface)', padding: '1.5rem', borderRadius: '8px', border: '1px solid var(--border)', marginBottom: '2rem' }}>
            <h3 style={{ fontSize: '1.25rem', fontWeight: '600', marginBottom: '1rem' }}>Nieuwe Groep Aanmaken</h3>
            <form onSubmit={handleCreateGroup}>
              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>Naam (bv. Kleuters)</label>
                <input 
                  type="text" 
                  value={newGroupName}
                  onChange={e => setNewGroupName(e.target.value)}
                  className="input"
                  required
                />
              </div>
              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>Bestelcode (bv. XC01)</label>
                <input 
                  type="text" 
                  value={newGroupCode}
                  onChange={e => setNewGroupCode(e.target.value)}
                  className="input"
                  required
                />
              </div>
              <button type="submit" disabled={creating} className="btn btn-primary" style={{ width: '100%' }}>
                {creating ? 'Aanmaken...' : 'Groep Toevoegen'}
              </button>
            </form>
          </div>

          <h3 style={{ fontSize: '1.25rem', fontWeight: '600', marginBottom: '1rem' }}>Bestaande Groepen</h3>
          {groups.length === 0 ? (
            <p style={{ color: 'var(--text-muted)' }}>Er zijn nog geen groepen aangemaakt.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {groups.map(group => (
                <div key={group.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: 'var(--surface)', padding: '1rem', borderRadius: '8px', border: '1px solid var(--border)' }}>
                  <div>
                    <div style={{ fontWeight: 600 }}>{group.name}</div>
                    <div style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>Code: {group.order_code}</div>
                  </div>
                  <button 
                    onClick={() => handleDeleteGroup(group.id)}
                    style={{ backgroundColor: 'transparent', border: 'none', color: '#c62828', cursor: 'pointer' }}
                  >
                    Verwijder
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Klassen Toewijzen */}
        <div>
          <h3 style={{ fontSize: '1.25rem', fontWeight: '600', marginBottom: '1rem' }}>Klassen Toewijzen</h3>
          {classes.length === 0 ? (
            <p style={{ color: 'var(--text-muted)' }}>Er zijn nog geen klassen toegevoegd aan deze school.</p>
          ) : (
            <div style={{ backgroundColor: 'var(--surface)', borderRadius: '8px', border: '1px solid var(--border)', overflow: 'hidden' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid var(--border)', backgroundColor: 'var(--background)' }}>
                    <th style={{ padding: '1rem' }}>Klas</th>
                    <th style={{ padding: '1rem' }}>Groep</th>
                  </tr>
                </thead>
                <tbody>
                  {classes.map(cls => (
                    <tr key={cls.id} style={{ borderBottom: '1px solid var(--border)' }}>
                      <td style={{ padding: '1rem', fontWeight: 500 }}>
                        {cls.name}
                        {!cls.class_group_id && (
                          <span style={{ marginLeft: '0.5rem', color: '#c62828', fontSize: '0.75rem', fontWeight: 'bold' }}>! Niet toegewezen</span>
                        )}
                      </td>
                      <td style={{ padding: '1rem' }}>
                        <select 
                          value={cls.class_group_id || 'none'}
                          onChange={(e) => handleAssignClass(cls.id, e.target.value)}
                          style={{ padding: '0.5rem', borderRadius: '4px', border: '1px solid var(--border)', width: '100%' }}
                        >
                          <option value="none">-- Selecteer Groep --</option>
                          {groups.map(g => (
                            <option key={g.id} value={g.id}>{g.name} ({g.order_code})</option>
                          ))}
                        </select>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
