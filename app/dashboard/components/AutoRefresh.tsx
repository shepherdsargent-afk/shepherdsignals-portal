'use client'

import { useEffect } from 'react'
import { usePathname, useRouter } from 'next/navigation'

/**
 * Server-rendered dashboard pages (Overview, Signals, Vendors) get a fresh
 * data fetch every time the user navigates to them — otherwise Next's client
 * router cache can show stale numbers right after an invoice upload.
 */
export function AutoRefresh() {
  const router = useRouter()
  const pathname = usePathname()
  useEffect(() => {
    router.refresh()
  }, [pathname, router])
  return null
}
