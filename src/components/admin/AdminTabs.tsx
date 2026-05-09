'use client'

import { useState } from 'react'
import DailyOrdersReport from './DailyOrdersReport'
import KitchenTotalsReport from './KitchenTotalsReport'
import MonthlyOverviewReport from './MonthlyOverviewReport'
import styles from './AdminTabs.module.css'

export default function AdminTabs() {
  const [activeTab, setActiveTab] = useState<'daily' | 'kitchen' | 'monthly'>('daily')

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
      </div>

      <div className={styles.content}>
        {activeTab === 'daily' && <DailyOrdersReport />}
        {activeTab === 'kitchen' && <KitchenTotalsReport />}
        {activeTab === 'monthly' && <MonthlyOverviewReport />}
      </div>
    </div>
  )
}
