'use client'

import { useEffect } from 'react'

export default function SyncSchoolCookie({ activeSchoolId }: { activeSchoolId: string }) {
  useEffect(() => {
    document.cookie = `activeSchoolId=${activeSchoolId}; path=/; max-age=31536000; SameSite=Lax`
  }, [activeSchoolId])

  return null
}
