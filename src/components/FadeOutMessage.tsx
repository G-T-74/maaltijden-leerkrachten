'use client'

import { useState, useEffect } from 'react'

export default function FadeOutMessage({ children }: { children: React.ReactNode }) {
  const [visible, setVisible] = useState(true)
  const [fading, setFading] = useState(false)

  useEffect(() => {
    // Start fading out after 4 seconds
    const fadeTimer = setTimeout(() => {
      setFading(true)
    }, 4000)

    // Remove from DOM completely after 4.5 seconds
    const removeTimer = setTimeout(() => {
      setVisible(false)
    }, 4500)

    return () => {
      clearTimeout(fadeTimer)
      clearTimeout(removeTimer)
    }
  }, [])

  if (!visible) return null

  return (
    <div style={{ 
      transition: 'opacity 0.5s ease-in-out, margin 0.5s ease-in-out, height 0.5s ease-in-out',
      opacity: fading ? 0 : 1,
      overflow: 'hidden',
      height: fading ? 0 : 'auto',
      marginBottom: fading ? 0 : '1rem' // Adjust if the children have their own margins
    }}>
      {children}
    </div>
  )
}
