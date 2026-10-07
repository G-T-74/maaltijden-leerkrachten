'use client'

import { useState } from 'react'
import StudentOrdersDailyClient from './StudentOrdersDailyClient'
import StudentOrdersWeeklyClient from './StudentOrdersWeeklyClient'
import styles from './StudentOrdersClient.module.css'

export default function StudentOrdersClient({ activeSchoolId }: { activeSchoolId: string }) {
  const [viewMode, setViewMode] = useState<'daily' | 'weekly'>('daily')

  return (
    <div className={styles.wrapperContainer}>
      <div className={styles.viewToggle}>
        <button 
          className={`${styles.toggleBtn} ${viewMode === 'daily' ? styles.toggleBtnActive : ''}`}
          onClick={() => setViewMode('daily')}
        >
          Dagweergave
        </button>
        <button 
          className={`${styles.toggleBtn} ${viewMode === 'weekly' ? styles.toggleBtnActive : ''}`}
          onClick={() => setViewMode('weekly')}
        >
          Weekweergave
        </button>
      </div>

      {viewMode === 'daily' ? (
        <StudentOrdersDailyClient activeSchoolId={activeSchoolId} />
      ) : (
        <StudentOrdersWeeklyClient activeSchoolId={activeSchoolId} />
      )}
    </div>
  )
}
