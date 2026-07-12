'use client'

import { SessionProvider } from 'next-auth/react'
import { useEffect, type ReactNode } from 'react'

export default function Providers({ children }: { children: ReactNode }) {
  useEffect(() => {
    const appearance = localStorage.getItem('sommeil:appearance')
    if (appearance === 'light' || appearance === 'dark' || appearance === 'automatic') {
      document.documentElement.dataset.appearance = appearance
    }
    if ('serviceWorker' in navigator && process.env.NODE_ENV === 'production') {
      navigator.serviceWorker.register('/sw.js').catch(() => {
        // Offline support is progressive enhancement; tracking still works
        // normally when registration is unavailable.
      })
    }
  }, [])

  return <SessionProvider>{children}</SessionProvider>
}
