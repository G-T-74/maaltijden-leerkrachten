'use client'

import { useState, useEffect } from 'react'
import { getSchoolsWithDeadlines, setActiveAdminSchool } from '@/app/actions/admin'
import DailyOrdersReport from './DailyOrdersReport'
import KitchenTotalsReport from './KitchenTotalsReport'
import MonthlyOverviewReport from './MonthlyOverviewReport'
import MealsManagement from './MealsManagement'
import StudentsManagement from './StudentsManagement'
import ClassGroupsManagement from './ClassGroupsManagement'
import SchoolSettings from './SchoolSettings'
import styles from './AdminTabs.module.css'

export default function AdminTabs() {
  const [activeTab, setActiveTab] = useState<'daily' | 'kitchen' | 'monthly' | 'meals' | 'students' | 'groups' | 'settings'>('daily')
  const [schools, setSchools] = useState<any[]>([])
  const [activeSchoolId, setActiveSchoolId] = useState<string>('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function loadSchools() {
      const res = await getSchoolsWithDeadlines()
      if (res.schools) {
        setSchools(res.schools)
        if (res.activeSchoolId && res.schools.find((s: any) => s.id === res.activeSchoolId)) {
          setActiveSchoolId(res.activeSchoolId)
        } else if (res.schools.length > 0) {
          setActiveSchoolId(res.schools[0].id)
          await setActiveAdminSchool(res.schools[0].id)
        }
      }
      setLoading(false)
    }
    loadSchools()
  }, [])

  const handleSchoolChange = async (newId: string) => {
    setActiveSchoolId(newId)
    await setActiveAdminSchool(newId)
  }

  if (loading) return <div>Dashboard laden...</div>

  if (schools.length === 0) {
    return (
      <div style={{ padding: '2rem', backgroundColor: 'var(--surface)', borderRadius: '8px', border: '1px solid var(--border)' }}>
        <h2 style={{ color: 'var(--primary)', marginBottom: '1rem' }}>Geen toegang</h2>
        <p style={{ color: 'var(--text-muted)' }}>Je bent momenteel aan geen enkele school gekoppeld als beheerder.</p>
      </div>
    )
  }

  const activeSchool = schools.find(s => s.id === activeSchoolId) || schools[0]

  return (
    <div>
      <div className="no-print" style={{ marginBottom: '2rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', backgroundColor: 'var(--surface)', padding: '1rem', borderRadius: '8px', border: '1px solid var(--border)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <label style={{ fontWeight: 500, color: 'var(--text-main)' }}>Hoofdschool (Huidig overzicht):</label>
          <select 
            value={activeSchoolId} 
            onChange={(e) => handleSchoolChange(e.target.value)}
            style={{ padding: '0.5rem', borderRadius: '4px', border: '1px solid var(--border)', backgroundColor: 'var(--background)', color: 'var(--text-main)', minWidth: '200px' }}
          >
            {schools.map(s => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
        </div>
        <button 
          onClick={() => window.print()} 
          style={{ padding: '0.5rem 1rem', display: 'flex', alignItems: 'center', gap: '0.5rem', backgroundColor: 'transparent', border: '1px solid var(--border)', borderRadius: '4px', cursor: 'pointer', fontWeight: 500, color: 'var(--text-main)' }}
        >
          <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
          </svg>
          Print Overzicht
        </button>
      </div>

      <div className={`${styles.tabContainer} no-print`}>
        <button 
          className={`${styles.tab} ${activeTab === 'daily' ? styles.active : ''}`}
          onClick={() => setActiveTab('daily')}
        >
          Dagoverzicht (Details)
        </button>
        <button 
          className={`${styles.tab} ${activeTab === 'kitchen' ? styles.active : ''}`}
          onClick={() => setActiveTab('kitchen')}
        >
          Keukenoverzicht (Totalen)
        </button>
        <button 
          className={`${styles.tab} ${activeTab === 'monthly' ? styles.active : ''}`}
          onClick={() => setActiveTab('monthly')}
        >
          Maandoverzicht (Facturatie)
        </button>
        <button 
          className={`${styles.tab} ${activeTab === 'meals' ? styles.active : ''}`}
          onClick={() => setActiveTab('meals')}
        >
          Maaltijden Beheer
        </button>
        <button 
          className={`${styles.tab} ${activeTab === 'students' ? styles.active : ''}`}
          onClick={() => setActiveTab('students')}
        >
          Leerlingen & Klassen
        </button>
        <button 
          className={`${styles.tab} ${activeTab === 'groups' ? styles.active : ''}`}
          onClick={() => setActiveTab('groups')}
        >
          Klassengroepen
        </button>
        <button 
          className={`${styles.tab} ${activeTab === 'settings' ? styles.active : ''}`}
          onClick={() => setActiveTab('settings')}
        >
          Instellingen
        </button>
      </div>

      <div className={styles.content}>
        {activeTab === 'daily' && <DailyOrdersReport schoolId={activeSchool.id} catererId={activeSchool.caterer_id} />}
        {activeTab === 'kitchen' && <KitchenTotalsReport schoolId={activeSchool.id} />}
        {activeTab === 'monthly' && <MonthlyOverviewReport schoolId={activeSchool.id} />}
        {activeTab === 'meals' && <MealsManagement catererId={activeSchool.caterer_id} />}
        {activeTab === 'students' && <StudentsManagement schoolId={activeSchool.id} />}
        {activeTab === 'groups' && <ClassGroupsManagement schoolId={activeSchool.id} />}
        {activeTab === 'settings' && <SchoolSettings />}
      </div>
    </div>
  )
}
