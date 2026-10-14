'use client'

import { useState, useEffect } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { getSchoolsWithDeadlines, setActiveAdminSchool } from '@/app/actions/admin'
import DailyOrdersReport from './DailyOrdersReport'
import KitchenTotalsReport from './KitchenTotalsReport'
import MonthlyOverviewReport from './MonthlyOverviewReport'
import MealsManagement from './MealsManagement'
import StudentsManagement from './StudentsManagement'
import ClassGroupsManagement from './ClassGroupsManagement'
import SchoolSettings from './SchoolSettings'
import TeachersManagement from './TeachersManagement'
import styles from './AdminTabs.module.css'

type TabKey = 'daily' | 'kitchen' | 'monthly' | 'meals' | 'students' | 'groups' | 'teachers' | 'settings'

export default function AdminTabs() {
  const [activeTab, setActiveTab] = useState<TabKey>('daily')
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

  if (loading) {
    return (
      <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
        Dashboard laden...
      </div>
    )
  }

  if (schools.length === 0) {
    return (
      <div style={{ padding: '2.5rem', backgroundColor: 'var(--surface)', borderRadius: '12px', border: '1px solid var(--border)', textAlign: 'center' }}>
        <h2 style={{ color: 'var(--primary)', marginBottom: '0.75rem', fontSize: '1.5rem' }}>Geen toegang</h2>
        <p style={{ color: 'var(--text-muted)' }}>Je bent momenteel aan geen enkele school gekoppeld als beheerder.</p>
        <Link href="/" className={styles.actionBtn} style={{ marginTop: '1.5rem', display: 'inline-flex' }}>
          Terug naar Home
        </Link>
      </div>
    )
  }

  const activeSchool = schools.find(s => s.id === activeSchoolId) || schools[0]

  return (
    <div>
      {/* HOOFDING MET SCHOOL LOGO & ACTIES */}
      <div className={`${styles.headerCard} no-print`}>
        <div className={styles.schoolInfo}>
          <div className={styles.logoWrapper}>
            {activeSchool?.logo_url ? (
              <Image 
                src={activeSchool.logo_url} 
                alt={`Logo ${activeSchool.name}`}
                fill
                className={styles.logoImage}
              />
            ) : (
              <div className={styles.logoFallback}>
                {activeSchool?.name?.charAt(0) || 'S'}
              </div>
            )}
          </div>
          <div className={styles.schoolTitles}>
            <span className={styles.badge}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
                <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
              </svg>
              Beheerderspaneel
            </span>
            <h1 className={styles.schoolName}>{activeSchool?.name}</h1>
            <span className={styles.schoolSubtitle}>Overzicht maaltijden & schoolbeheer</span>
          </div>
        </div>

        <div className={styles.headerActions}>
          {schools.length > 1 && (
            <div className={styles.selectorGroup}>
              <label className={styles.selectorLabel}>Wissel van school:</label>
              <select 
                value={activeSchoolId} 
                onChange={(e) => handleSchoolChange(e.target.value)}
                className={styles.schoolSelect}
              >
                {schools.map(s => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </div>
          )}

          <button 
            onClick={() => window.print()} 
            className={styles.actionBtn}
            title="Druk het huidige overzicht af"
          >
            <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
            </svg>
            Printen
          </button>

          <Link href="/" className={styles.actionBtn} title="Ga terug naar het gebruikersoverzicht">
            <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
            </svg>
            Naar Bestellen
          </Link>
        </div>
      </div>

      {/* OVERZICHTELIJK MENU IN TWEE DELEN */}
      <div className={`${styles.navWrapper} no-print`}>
        {/* DEEL 1: RAPPORTEN & OVERZICHTEN */}
        <div className={styles.navSection}>
          <div className={styles.navSectionHeader}>
            <span>Overzichten & Rapporten</span>
          </div>
          <div className={styles.reportsGrid}>
            {/* DAGOVERZICHT */}
            <button 
              className={`${styles.reportCardBtn} ${activeTab === 'daily' ? styles.activeReport : ''}`}
              onClick={() => setActiveTab('daily')}
            >
              <div className={styles.iconWrapper}>
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
                  <line x1="16" y1="2" x2="16" y2="6"/>
                  <line x1="8" y1="2" x2="8" y2="6"/>
                  <line x1="3" y1="10" x2="21" y2="10"/>
                  <path d="m9 16 2 2 4-4"/>
                </svg>
              </div>
              <div className={styles.tabText}>
                <span className={styles.tabTitle}>Dagoverzicht</span>
                <span className={styles.tabSubtitle}>Details per klas & leerling</span>
              </div>
            </button>

            {/* KEUKENOVERZICHT */}
            <button 
              className={`${styles.reportCardBtn} ${activeTab === 'kitchen' ? styles.activeReport : ''}`}
              onClick={() => setActiveTab('kitchen')}
            >
              <div className={styles.iconWrapper}>
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M6 13.8V4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v9.8"/>
                  <path d="M4 14h16a2 2 0 0 1 2 2v1a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4v-1a2 2 0 0 1 2-2z"/>
                  <line x1="12" y1="6" x2="12" y2="10"/>
                </svg>
              </div>
              <div className={styles.tabText}>
                <span className={styles.tabTitle}>Keukenoverzicht</span>
                <span className={styles.tabSubtitle}>Totalen voor traiteur/keuken</span>
              </div>
            </button>

            {/* MAANDOVERZICHT */}
            <button 
              className={`${styles.reportCardBtn} ${activeTab === 'monthly' ? styles.activeReport : ''}`}
              onClick={() => setActiveTab('monthly')}
            >
              <div className={styles.iconWrapper}>
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="20" x2="18" y2="10"/>
                  <line x1="12" y1="20" x2="12" y2="4"/>
                  <line x1="6" y1="20" x2="6" y2="14"/>
                </svg>
              </div>
              <div className={styles.tabText}>
                <span className={styles.tabTitle}>Maandoverzicht</span>
                <span className={styles.tabSubtitle}>Facturatie & maandtotalen</span>
              </div>
            </button>
          </div>
        </div>

        {/* DEEL 2: BEHEER & CONFIGURATIE */}
        <div className={styles.navSection}>
          <div className={styles.navSectionHeader}>
            <span>Beheer & Configuratie</span>
          </div>
          <div className={styles.managementRow}>
            {/* MAALTIJDEN */}
            <button 
              className={`${styles.mgmtTabBtn} ${activeTab === 'meals' ? styles.activeMgmt : ''}`}
              onClick={() => setActiveTab('meals')}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M18 8h1a4 4 0 0 1 0 8h-1"/>
                <path d="M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V8z"/>
                <line x1="6" y1="1" x2="6" y2="4"/>
                <line x1="10" y1="1" x2="10" y2="4"/>
                <line x1="14" y1="1" x2="14" y2="4"/>
              </svg>
              Maaltijden
            </button>

            {/* LEERLINGEN & KLASSEN */}
            <button 
              className={`${styles.mgmtTabBtn} ${activeTab === 'students' ? styles.activeMgmt : ''}`}
              onClick={() => setActiveTab('students')}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
                <circle cx="9" cy="7" r="4"/>
                <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
                <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
              </svg>
              Leerlingen & Klassen
            </button>

            {/* KLASSENGROEPEN */}
            <button 
              className={`${styles.mgmtTabBtn} ${activeTab === 'groups' ? styles.activeMgmt : ''}`}
              onClick={() => setActiveTab('groups')}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polygon points="12 2 2 7 12 12 22 7 12 2"/>
                <polyline points="2 17 12 22 22 17"/>
                <polyline points="2 12 12 17 22 12"/>
              </svg>
              Klassengroepen
            </button>

            {/* LEERKRACHTEN */}
            <button 
              className={`${styles.mgmtTabBtn} ${activeTab === 'teachers' ? styles.activeMgmt : ''}`}
              onClick={() => setActiveTab('teachers')}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
                <circle cx="12" cy="7" r="4"/>
              </svg>
              Leerkrachten
            </button>

            {/* INSTELLINGEN */}
            <button 
              className={`${styles.mgmtTabBtn} ${activeTab === 'settings' ? styles.activeMgmt : ''}`}
              onClick={() => setActiveTab('settings')}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="3"/>
                <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/>
              </svg>
              School Instellingen
            </button>
          </div>
        </div>
      </div>

      {/* DASHBOARD INHOUD */}
      <div className={styles.content}>
        {activeTab === 'daily' && <DailyOrdersReport schoolId={activeSchool.id} catererId={activeSchool.caterer_id} />}
        {activeTab === 'kitchen' && <KitchenTotalsReport schoolId={activeSchool.id} />}
        {activeTab === 'monthly' && <MonthlyOverviewReport schoolId={activeSchool.id} />}
        {activeTab === 'meals' && <MealsManagement catererId={activeSchool.caterer_id} />}
        {activeTab === 'students' && <StudentsManagement schoolId={activeSchool.id} />}
        {activeTab === 'groups' && <ClassGroupsManagement schoolId={activeSchool.id} />}
        {activeTab === 'teachers' && <TeachersManagement schoolId={activeSchool.id} />}
        {activeTab === 'settings' && <SchoolSettings />}
      </div>
    </div>
  )
}
