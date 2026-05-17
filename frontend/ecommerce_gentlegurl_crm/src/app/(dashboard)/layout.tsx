'use client'

import { ReactNode, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'

import Header from '@/components/Header'
import DashboardNavigationProgress from '@/components/DashboardNavigationProgress'
import Sidebar from '@/components/Sidebar'
import { LogoLoader } from '@/components/LogoLoader'
import { clearLoginPortal, getLoginPagePath } from '@/lib/login-portal'

type ProfileResponse = {
  success?: boolean
  authed?: boolean
  data?: {
    id?: number
    name?: string
    email?: string | null
    username?: string
    staff_id?: number | null
    permissions?: unknown
  } | null
}

export default function DashboardLayout({ children }: { children: ReactNode }) {
  const router = useRouter()
  const hasRedirected = useRef(false)
  // Mobile: start collapsed (hidden), Desktop: start expanded
  const [collapsed, setCollapsed] = useState(true)
  const [overlaySidebar, setOverlaySidebar] = useState(true)
  const [userEmail, setUserEmail] = useState('')
  const [checkingAuth, setCheckingAuth] = useState(true)
  const [permissions, setPermissions] = useState<string[]>([])
  const [staffId, setStaffId] = useState<number | null>(null)

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
        router.replace(getLoginPagePath())
        return response
      }

      try {
        const data = await response.clone().json()
        if (isUnauthenticated(data, response.status)) {
          clearAuthCookies()
          hasRedirected.current = true
          router.replace(getLoginPagePath())
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
          setStaffId(typeof data?.data?.staff_id === 'number' ? data.data.staff_id : (data?.data?.staff_id ?? null))
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
          clearSessionCookiesOnClient()
          router.replace(getLoginPagePath())
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

  // Phone uses overlay drawer; iPad+ keeps a persistent scrollable sidebar (all menu items stay available).
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 767px)')

    const applySidebarMode = () => {
      const shouldOverlay = mq.matches
      setOverlaySidebar(shouldOverlay)
      setCollapsed(shouldOverlay)
    }

    applySidebarMode()
    mq.addEventListener('change', applySidebarMode)
    return () => mq.removeEventListener('change', applySidebarMode)
  }, [])

  const toggleSidebar = () => setCollapsed((c) => !c)

  const clearSessionCookiesOnClient = () => {
    const names = ['connect.sid', 'laravel-session', 'gentlegurl-api-session']
    names.forEach((name) => {
      document.cookie = `${name}=; Max-Age=0; path=/`
    })
  }

  const handleLogout = async () => {
    try {
      await fetch('/api/logout', { method: 'POST', credentials: 'include' })
    } catch (error) {
      console.error('Logout failed', error)
    } finally {
      setUserEmail('')
      setPermissions([])
      const postLogout = getLoginPagePath()
      clearSessionCookiesOnClient()
      clearLoginPortal()
      window.location.assign(postLogout)
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
    <LogoLoader>
      <div className="crm-dashboard-root flex h-[100dvh] min-h-0 flex-col overflow-hidden">
      <Header
        userEmail={userEmail}
        onLogout={handleLogout}
        onToggleSidebar={toggleSidebar}
        permissions={permissions}
        staffId={staffId}
      />
      <div className="crm-dashboard-shell flex min-h-0 flex-1 pt-16">
          <Sidebar
            collapsed={collapsed}
            overlayMode={overlaySidebar}
            permissions={permissions}
            staffId={staffId}
            onToggleSidebar={toggleSidebar}
          />
          <main className="crm-dashboard-main relative min-h-0 min-w-0 flex-1 bg-slate-100">
            <DashboardNavigationProgress />
            {children}
          </main>
        </div>
      </div>
    </LogoLoader>
  )
}
