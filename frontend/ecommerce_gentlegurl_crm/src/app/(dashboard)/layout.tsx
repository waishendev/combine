'use client'

import { ReactNode, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'

import Header from '@/components/Header'
import Sidebar from '@/components/Sidebar'

type ProfileResponse = {
  success?: boolean
  authed?: boolean
  data?: {
    id?: number
    name?: string
    email?: string | null
    username?: string
    permissions?: unknown
  } | null
}

export default function DashboardLayout({ children }: { children: ReactNode }) {
  const router = useRouter()
  const hasRedirected = useRef(false)
  // Mobile: start collapsed (hidden), Desktop: start expanded
  const [collapsed, setCollapsed] = useState(true)
  const [userEmail, setUserEmail] = useState('')
  const [checkingAuth, setCheckingAuth] = useState(true)
  const [permissions, setPermissions] = useState<string[]>([])

  useEffect(() => {
    const authCookieNames = [
      'connect.sid',
      'laravel-session',
      'gentlegurl-api-session',
    ]

    const clearAuthCookies = () => {
      authCookieNames.forEach((name) => {
        document.cookie = `${name}=; Max-Age=0; path=/`
      })
    }

    const isUnauthenticated = (data: unknown, status: number) => {
      if (status === 401 || status === 419) {
        return true
      }

      if (data && typeof data === 'object' && 'message' in data) {
        const message = (data as { message?: unknown }).message
        if (typeof message === 'string') {
          const normalized = message.toLowerCase()
          return normalized === 'unauthenticated' || normalized === 'unauthorized'
        }
      }

      return false
    }

    const originalFetch = window.fetch.bind(window)

    window.fetch = async (...args) => {
      const response = await originalFetch(...args)

      if (hasRedirected.current) {
        return response
      }

      if (response.status === 401 || response.status === 419) {
        clearAuthCookies()
        hasRedirected.current = true
        router.replace('/login')
        return response
      }

      try {
        const data = await response.clone().json()
        if (isUnauthenticated(data, response.status)) {
          clearAuthCookies()
          hasRedirected.current = true
          router.replace('/login')
        }
      } catch {
        // Ignore non-JSON responses
      }

      return response
    }

    return () => {
      window.fetch = originalFetch
    }
  }, [router])

  useEffect(() => {
    let isActive = true
    const controller = new AbortController()

    const fetchProfile = async () => {
      try {
        const response = await fetch('/api/me', {
          cache: 'no-store',
          signal: controller.signal,
          credentials: 'include',
        })

        if (!response.ok) {
          throw new Error('Unauthorized')
        }

        const data: ProfileResponse = await response.json()
        
        // Check for both success and authed fields
        if (!data?.success && !data?.authed) {
          throw new Error('Unauthorized')
        }

        if (isActive) {
          setUserEmail(data?.data?.email ?? '')
          const permissionsData = data.data?.permissions
          const perms = Array.isArray(permissionsData)
            ? permissionsData.filter((perm): perm is string => typeof perm === 'string')
            : []
          setPermissions(perms)
        }
      } catch (err) {
        if (controller.signal.aborted) return
        if (err instanceof DOMException && err.name === 'AbortError') return
        if (isActive) {
          router.replace('/login')
        }
      } finally {
        if (isActive) {
          setCheckingAuth(false)
        }
      }
    }

    fetchProfile()

    return () => {
      isActive = false
      controller.abort()
    }
  }, [router])

  // Auto-expand sidebar on desktop (md breakpoint and above)
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth >= 768) {
        // Desktop: expand sidebar
        setCollapsed(false)
      } else {
        // Mobile: collapse sidebar
        setCollapsed(true)
      }
    }

    // Set initial state based on screen size
    handleResize()

    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  const toggleSidebar = () => setCollapsed((c) => !c)

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' })
    } catch (error) {
      console.error('Logout failed', error)
    } finally {
      setUserEmail('')
      setPermissions([])
      router.replace('/')
    }
  }

  if (checkingAuth) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-100">
        <span className="text-sm text-slate-500">Loading dashboard...</span>
      </div>
    )
  }

  return (
    <>
      <Header
        userEmail={userEmail}
        onLogout={handleLogout}
        onToggleSidebar={toggleSidebar}
      />
      <div className="flex h-screen pt-16">
        <Sidebar collapsed={collapsed} permissions={permissions} onToggleSidebar={toggleSidebar} />
        <main className="flex-1 overflow-y-auto bg-slate-100">{children}</main>
      </div>
    </>
  )
}
