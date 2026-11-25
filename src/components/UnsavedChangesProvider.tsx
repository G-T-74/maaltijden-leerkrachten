'use client'

import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react'

interface UnsavedChangesContextType {
  hasUnsavedChanges: boolean
  setHasUnsavedChanges: (value: boolean) => void
  confirmIfUnsaved: (customMessage?: string) => boolean
}

const DEFAULT_CONFIRM_MESSAGE = 'Je hebt niet-opgeslagen wijzigingen. Weet je zeker dat je wilt weggaan zonder op te slaan?'

const UnsavedChangesContext = createContext<UnsavedChangesContextType>({
  hasUnsavedChanges: false,
  setHasUnsavedChanges: () => {},
  confirmIfUnsaved: () => true,
})

export function UnsavedChangesProvider({ children }: { children: React.ReactNode }) {
  const [hasUnsavedChanges, setHasUnsavedChangesState] = useState(false)
  const hasUnsavedRef = useRef(false)

  const setHasUnsavedChanges = useCallback((value: boolean) => {
    hasUnsavedRef.current = value
    setHasUnsavedChangesState(value)
  }, [])

  const confirmIfUnsaved = useCallback((customMessage?: string) => {
    if (!hasUnsavedRef.current) return true
    const confirmed = window.confirm(customMessage || DEFAULT_CONFIRM_MESSAGE)
    if (confirmed) {
      setHasUnsavedChanges(false)
      return true
    }
    return false
  }, [setHasUnsavedChanges])

  // 1. Browser beforeunload listener (bij sluiten van tabblad, herladen, browser back/forward)
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (hasUnsavedRef.current) {
        e.preventDefault()
        e.returnValue = ''
        return ''
      }
    }

    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload)
    }
  }, [])

  // 2. Onderschep link-clicks (<a href="..."> en Next.js <Link>)
  useEffect(() => {
    const handleAnchorClick = (e: MouseEvent) => {
      if (!hasUnsavedRef.current) return

      const target = e.target as HTMLElement | null
      const anchor = target?.closest('a')
      if (!anchor) return

      const href = anchor.getAttribute('href')
      if (!href || href.startsWith('#') || href.startsWith('javascript:')) return

      const confirmed = window.confirm(DEFAULT_CONFIRM_MESSAGE)
      if (!confirmed) {
        e.preventDefault()
        e.stopPropagation()
      } else {
        setHasUnsavedChanges(false)
      }
    }

    // Capture phase zodat we de click afvangen vóór de router-navigatie start
    document.addEventListener('click', handleAnchorClick, true)
    return () => {
      document.removeEventListener('click', handleAnchorClick, true)
    }
  }, [setHasUnsavedChanges])

  // 3. Browser back/forward knop (popstate)
  useEffect(() => {
    const handlePopState = () => {
      if (!hasUnsavedRef.current) return
      const confirmed = window.confirm(DEFAULT_CONFIRM_MESSAGE)
      if (!confirmed) {
        window.history.pushState(null, '', window.location.href)
      } else {
        setHasUnsavedChanges(false)
      }
    }

    window.addEventListener('popstate', handlePopState)
    return () => {
      window.removeEventListener('popstate', handlePopState)
    }
  }, [setHasUnsavedChanges])

  return (
    <UnsavedChangesContext.Provider value={{ hasUnsavedChanges, setHasUnsavedChanges, confirmIfUnsaved }}>
      {children}
    </UnsavedChangesContext.Provider>
  )
}

export function useUnsavedChanges() {
  return useContext(UnsavedChangesContext)
}
