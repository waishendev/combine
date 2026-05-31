'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function DashboardError({
  error,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  const router = useRouter()

  useEffect(() => {
    console.error('[Dashboard error boundary]', error)

    const authCookieNames = ['connect.sid', 'laravel-session', 'gentlegurl-api-session']
    authCookieNames.forEach((name) => {
      document.cookie = `${name}=; Max-Age=0; path=/`
    })

    window.location.replace('/login')
  }, [error, router])

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-100">
      <span className="text-sm text-slate-500">Redirecting to login...</span>
    </div>
  )
}
