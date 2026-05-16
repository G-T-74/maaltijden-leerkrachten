'use client'

import { useState, useEffect } from 'react'
import { getSchoolsWithDeadlines, setActiveAdminSchool } from '@/app/actions/admin'
import DailyOrdersReport from './DailyOrdersReport'
import KitchenTotalsReport from './KitchenTotalsReport'
import MonthlyOverviewReport from './MonthlyOverviewReport'
import MealsManagement from './MealsManagement'
import SchoolSettings from './SchoolSettings'
import styles from './AdminTabs.module.css'

export default function AdminTabs() {
  const [activeTab, setActiveTab] = useState<'daily' | 'kitchen' | 'monthly' | 'meals' | 'settings'>('daily')
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
      <div style={{ marginBottom: '2rem', display: 'flex', alignItems: 'center', gap: '1rem', backgroundColor: 'var(--surface)', padding: '1rem', borderRadius: '8px', border: '1px solid var(--border)' }}>
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

      <div className={styles.tabContainer}>
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
        {activeTab === 'settings' && <SchoolSettings />}
      </div>
    </div>
  )
}
