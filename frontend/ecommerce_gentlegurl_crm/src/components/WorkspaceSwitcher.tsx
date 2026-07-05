'use client'

import Link from 'next/link'
import { startTransition, useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { usePathname, useRouter } from 'next/navigation'

import { getWorkspace, getWorkspaceLanding, setWorkspace, type Workspace } from '@/lib/workspace'
import { getLoginPortal } from '@/lib/login-portal'

const OPTIONS: Array<{ label: string; value: Workspace }> = [
  { label: 'Ecommerce', value: 'ecommerce' },
  { label: 'Booking', value: 'booking' },
]

type WorkspaceSwitcherProps = {
  permissions?: string[]
}

const segmentClass = (active: boolean) =>
  `touch-manipulation whitespace-nowrap rounded-md px-2 py-1 text-[10px] font-semibold transition sm:px-3 sm:text-xs ${
    active ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-600 hover:text-slate-900'
  }`

const mobileRowClass = (active: boolean) =>
  `flex w-full touch-manipulation items-center gap-2 px-3 py-3.5 text-left text-sm font-semibold transition ${
    active ? 'bg-blue-50 text-blue-700' : 'text-slate-700 active:bg-slate-100'
  }`

export default function WorkspaceSwitcher({ permissions = [] }: WorkspaceSwitcherProps) {
  const router = useRouter()
  const pathname = usePathname()
  const [workspace, setWorkspaceState] = useState<Workspace>(() => getWorkspace())
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement | null>(null)
  const menuTriggerRef = useRef<HTMLButtonElement | null>(null)
  const [menuStyle, setMenuStyle] = useState<{ top: number; left: number; width: number } | null>(null)
  const staffPortalOnly = getLoginPortal() === 'staff'
  const workspaceOptions = staffPortalOnly ? OPTIONS.filter((o) => o.value === 'booking') : OPTIONS
  const showPos = permissions.includes('pos.checkout')
  const showPosAppointments = permissions.includes('pos.checkout') || permissions.includes('pos.appointments.manage')
  const showSalesReport = permissions.includes('ecommerce.daily-sales-reports.view')
  const showDailyBooking = permissions.includes('pos.checkout') || permissions.includes('booking.appointments.view')
  const isPosCheckout = pathname === '/pos'
  const isPosAppointments = pathname === '/pos/appointments' || pathname.startsWith('/pos/appointments/')
  const isPosRoute = pathname === '/pos' || pathname.startsWith('/pos/')
  const isSalesVisualRoute = pathname === '/reports/sales/visual' || pathname.startsWith('/reports/sales/visual/')
  const isDailyBookingRoute = pathname === '/daily-booking' || pathname.startsWith('/daily-booking/')

  useEffect(() => {
    const handleWorkspaceChanged = () => {
      setWorkspaceState(getWorkspace())
    }

    window.addEventListener('crm_workspace_changed', handleWorkspaceChanged)
    return () => window.removeEventListener('crm_workspace_changed', handleWorkspaceChanged)
  }, [])

  useEffect(() => {
    setMenuOpen(false)
  }, [pathname])

  const updateMenuPosition = useCallback(() => {
    const trigger = menuTriggerRef.current
    if (!trigger) return

    const rect = trigger.getBoundingClientRect()
    const width = Math.min(window.innerWidth - 16, Math.max(rect.width, 256))
    const left = Math.min(Math.max(8, rect.right - width), window.innerWidth - width - 8)

    setMenuStyle({
      top: rect.bottom + 4,
      left,
      width,
    })
  }, [])

  useEffect(() => {
    if (!menuOpen) {
      setMenuStyle(null)
      return
    }

    updateMenuPosition()

    const handleReposition = () => updateMenuPosition()
    window.addEventListener('resize', handleReposition)
    window.addEventListener('scroll', handleReposition, true)

    return () => {
      window.removeEventListener('resize', handleReposition)
      window.removeEventListener('scroll', handleReposition, true)
    }
  }, [menuOpen, updateMenuPosition])

  useEffect(() => {
    if (!menuOpen) return

    const close = (event: MouseEvent | TouchEvent) => {
      const target = event.target
      if (!(target instanceof Node)) return
      if (menuRef.current?.contains(target)) return
      if (target instanceof Element && target.closest('[data-crm-workspace-menu]')) return
      setMenuOpen(false)
    }

    document.addEventListener('mousedown', close)
    document.addEventListener('touchstart', close, { passive: true })

    return () => {
      document.removeEventListener('mousedown', close)
      document.removeEventListener('touchstart', close)
    }
  }, [menuOpen])

  // Warm common targets so leaving POS / heavy pages feels snappier.
  useEffect(() => {
    router.prefetch('/dashboard')
    router.prefetch('/booking/appointment-history')
    router.prefetch('/pos/appointments')
    router.prefetch('/daily-booking')
    router.prefetch('/reports/sales/visual')
  }, [router])

  const handleSwitch = (ws: Workspace) => {
    const landing = getWorkspaceLanding(ws)
    // POS 页不会改 workspace cookie，这里常仍是 ecommerce — 旧逻辑会 `ws === workspace` 直接 return，导致点 Ecommerce 不跳转、像卡住。
    if (ws === workspace && !isPosRoute) {
      return
    }

    if (ws !== workspace) {
      setWorkspace(ws)
      setWorkspaceState(ws)
    }

    startTransition(() => {
      router.push(landing)
    })
  }

  const mobileActiveLabel = (() => {
    if (isSalesVisualRoute) return 'Daily Sales'
    if (isDailyBookingRoute) return 'Daily Booking'
    if (isPosAppointments) return 'Appointments'
    if (isPosRoute) return 'POS'
    if (staffPortalOnly) return 'Booking'
    if (workspace === 'booking') return 'Booking'
    return 'Ecommerce'
  })()

  const closeMenu = () => setMenuOpen(false)

  const mobileMenuItems = (
    <>
      {workspaceOptions.map((option) => {
        const isActive = option.value === workspace && !isPosRoute
        return (
          <button
            key={option.value}
            type="button"
            role="option"
            aria-selected={isActive}
            onClick={() => {
              handleSwitch(option.value)
              closeMenu()
            }}
            className={mobileRowClass(isActive)}
          >
            {isActive ? <i className="fa-solid fa-check w-4 text-blue-600" /> : <span className="w-4" />}
            {option.label}
          </button>
        )
      })}
      {showPos && (
        <>
          <Link
            href="/pos"
            role="option"
            aria-selected={isPosCheckout}
            onClick={closeMenu}
            className={mobileRowClass(isPosCheckout)}
          >
            {isPosCheckout ? <i className="fa-solid fa-check w-4 text-blue-600" /> : <span className="w-4" />}
            POS
          </Link>
        </>
      )}
      {showPosAppointments && (
          <Link
            href="/pos/appointments"
            role="option"
            aria-selected={isPosAppointments}
            onClick={closeMenu}
            className={mobileRowClass(isPosAppointments)}
          >
            {isPosAppointments ? <i className="fa-solid fa-check w-4 text-blue-600" /> : <span className="w-4" />}
            Appointments
          </Link>
      )}
      {showDailyBooking && (
        <Link
          href="/daily-booking"
          role="option"
          aria-selected={isDailyBookingRoute}
          onClick={closeMenu}
          className={mobileRowClass(isDailyBookingRoute)}
        >
          {isDailyBookingRoute ? <i className="fa-solid fa-check w-4 text-blue-600" /> : <span className="w-4" />}
          Daily Booking
        </Link>
      )}
      {showSalesReport && (
        <Link
          href="/reports/sales/visual"
          role="option"
          aria-selected={isSalesVisualRoute}
          onClick={closeMenu}
          className={mobileRowClass(isSalesVisualRoute)}
        >
          {isSalesVisualRoute ? <i className="fa-solid fa-check w-4 text-blue-600" /> : <span className="w-4" />}
          Daily Sales report
        </Link>
      )}
    </>
  )

  const mobileMenuPortal =
    menuOpen && menuStyle && typeof document !== 'undefined'
      ? createPortal(
          <>
            <button
              type="button"
              className="fixed inset-0 z-[9998] cursor-default border-0 bg-black/20 p-0"
              aria-label="Close workspace menu"
              onClick={closeMenu}
            />
            <div
              data-crm-workspace-menu
              className="fixed z-[9999] max-h-[min(70vh,24rem)] overflow-y-auto rounded-xl border border-slate-200 bg-white py-1 shadow-lg"
              style={{
                top: menuStyle.top,
                left: menuStyle.left,
                width: menuStyle.width,
              }}
              role="listbox"
            >
              {mobileMenuItems}
            </div>
          </>,
          document.body,
        )
      : null

  return (
    <>
      {/* Phone: one large control + full-width tap targets in a dropdown */}
      <div className="relative w-full min-w-0 sm:hidden" ref={menuRef}>
        <button
          ref={menuTriggerRef}
          type="button"
          aria-expanded={menuOpen}
          aria-haspopup="listbox"
          onClick={() => setMenuOpen((open) => !open)}
          className="flex h-11 w-full min-w-0 max-w-[min(100%,14rem)] touch-manipulation items-center justify-between gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 text-left shadow-sm"
        >
          <span className="truncate text-sm font-semibold text-slate-800">{mobileActiveLabel}</span>
          <i className={`fa-solid fa-chevron-down shrink-0 text-xs text-slate-500 transition ${menuOpen ? 'rotate-180' : ''}`} />
        </button>
        {mobileMenuPortal}
      </div>

      {/* sm+: compact segmented control */}
      <div className="hidden shrink-0 items-center gap-0.5 rounded-lg border border-slate-200 bg-slate-50 p-0.5 sm:inline-flex sm:gap-1 sm:p-1">
        {workspaceOptions.map((option) => {
          const isActive = option.value === workspace && !isPosRoute

          return (
            <button
              key={option.value}
              type="button"
              title={option.label}
              onClick={() => handleSwitch(option.value)}
              className={segmentClass(isActive)}
            >
              <span className="md:hidden">{option.value === 'ecommerce' ? 'EC' : 'BK'}</span>
              <span className="hidden md:inline">{option.label}</span>
            </button>
          )
        })}
        {showPos && (
          <Link href="/pos" className={segmentClass(isPosCheckout)}>
            POS
          </Link>
        )}
        {showPosAppointments && (
          <Link href="/pos/appointments" className={segmentClass(isPosAppointments)} title="Appointments">
            <span className="xl:hidden">Apts</span>
            <span className="hidden xl:inline">Appointments</span>
          </Link>
        )}
        {showDailyBooking && (
          <Link href="/daily-booking" className={segmentClass(isDailyBookingRoute)} title="Daily Booking">
            <span className="lg:hidden">Daily</span>
            <span className="hidden lg:inline">Daily Booking</span>
          </Link>
        )}
        {showSalesReport && (
          <Link href="/reports/sales/visual" className={segmentClass(isSalesVisualRoute)} title="Daily Sales report">
            <span className="lg:hidden">Sales</span>
            <span className="hidden lg:inline">Daily Sales report</span>
          </Link>
        )}
      </div>
    </>
  )
}
