'use client'

import { useState, useEffect } from 'react'
import { useUnsavedChanges } from '@/components/UnsavedChangesProvider'
import StudentOrdersDailyClient from './StudentOrdersDailyClient'
import StudentOrdersWeeklyClient from './StudentOrdersWeeklyClient'
import styles from './StudentOrdersClient.module.css'

export default function StudentOrdersClient({ activeSchoolId }: { activeSchoolId: string }) {
  const [viewMode, setViewMode] = useState<'daily' | 'weekly'>('daily')
  const { hasUnsavedChanges, confirmIfUnsaved } = useUnsavedChanges()
  
  // Bewaar de geselecteerde klas zodat deze behouden blijft bij het schakelen tussen dag- en weekweergave
  const [activeClassId, setActiveClassId] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      return sessionStorage.getItem('student_orders_active_class_' + activeSchoolId) || ''
    }
    return ''
  })

  // Als de actieve school verandert, laad de opgeslagen klas voor die school
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const saved = sessionStorage.getItem('student_orders_active_class_' + activeSchoolId)
      setActiveClassId(saved || '')
    }
  }, [activeSchoolId])

  const handleViewModeChange = (mode: 'daily' | 'weekly') => {
    if (mode === viewMode) return
    if (hasUnsavedChanges && !confirmIfUnsaved()) return
    setViewMode(mode)
  }

  const handleSelectClass = (classId: string) => {
    setActiveClassId(classId)
    if (typeof window !== 'undefined' && classId) {
      sessionStorage.setItem('student_orders_active_class_' + activeSchoolId, classId)
    }
  }

  return (
    <div className={styles.wrapperContainer}>
      <div className={styles.viewToggle}>
        <button 
          className={`${styles.toggleBtn} ${viewMode === 'daily' ? styles.toggleBtnActive : ''}`}
          onClick={() => handleViewModeChange('daily')}
        >
          Dagweergave
        </button>
        <button 
          className={`${styles.toggleBtn} ${viewMode === 'weekly' ? styles.toggleBtnActive : ''}`}
          onClick={() => handleViewModeChange('weekly')}
        >
          Weekweergave
        </button>
      </div>

      {viewMode === 'daily' ? (
        <StudentOrdersDailyClient 
          activeSchoolId={activeSchoolId} 
          activeClassId={activeClassId}
          onSelectClass={handleSelectClass}
        />
      ) : (
        <StudentOrdersWeeklyClient 
          activeSchoolId={activeSchoolId} 
          activeClassId={activeClassId}
          onSelectClass={handleSelectClass}
        />
      )}
    </div>
  )
}
