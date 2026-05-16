'use client'

import { useState } from 'react'
import DailyOrdersReport from './DailyOrdersReport'
import KitchenTotalsReport from './KitchenTotalsReport'
import MonthlyOverviewReport from './MonthlyOverviewReport'
import MealsManagement from './MealsManagement'
import SchoolSettings from './SchoolSettings'
import styles from './AdminTabs.module.css'

export default function AdminTabs() {
  const [activeTab, setActiveTab] = useState<'daily' | 'kitchen' | 'monthly' | 'meals' | 'settings'>('daily')

  return (
    <div>
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
        {activeTab === 'daily' && <DailyOrdersReport />}
        {activeTab === 'kitchen' && <KitchenTotalsReport />}
        {activeTab === 'monthly' && <MonthlyOverviewReport />}
        {activeTab === 'meals' && <MealsManagement />}
        {activeTab === 'settings' && <SchoolSettings />}
      </div>
    </div>
  )
}
