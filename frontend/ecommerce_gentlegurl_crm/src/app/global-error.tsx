'use client'

import { useEffect } from 'react'

export default function GlobalError({
  error,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('[Global error boundary]', error)

    const authCookieNames = ['connect.sid', 'laravel-session', 'gentlegurl-api-session']
    authCookieNames.forEach((name) => {
      document.cookie = `${name}=; Max-Age=0; path=/`
    })

    window.location.replace('/login')
  }, [error])

  return (
    <html lang="en">
      <body>
        <div style={{
          display: 'flex',
          minHeight: '100vh',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: '#f1f5f9',
        }}>
          <span style={{ fontSize: '14px', color: '#64748b' }}>
            Redirecting to login...
          </span>
        </div>
      </body>
    </html>
  )
}
