'use client'

import Link from 'next/link'
import { startTransition, useEffect, useRef, useState } from 'react'
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
  const staffPortalOnly = getLoginPortal() === 'staff'
  const workspaceOptions = staffPortalOnly ? OPTIONS.filter((o) => o.value === 'booking') : OPTIONS
  const showPos = permissions.includes('pos.checkout')
  const showSalesReport = permissions.includes('ecommerce.daily-sales-reports.view')
  const isPosCheckout = pathname === '/pos'
  const isPosAppointments = pathname === '/pos/appointments' || pathname.startsWith('/pos/appointments/')
  const isPosRoute = pathname === '/pos' || pathname.startsWith('/pos/')
  const isSalesVisualRoute = pathname === '/reports/sales/visual' || pathname.startsWith('/reports/sales/visual/')

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

  useEffect(() => {
    if (!menuOpen) return
    const close = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [menuOpen])

  // Warm common targets so leaving POS / heavy pages feels snappier.
  useEffect(() => {
    router.prefetch('/dashboard')
    router.prefetch('/booking/appointment-history')
    router.prefetch('/pos/appointments')
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
    if (isPosAppointments) return 'Appointments'
    if (isPosRoute) return 'POS'
    if (staffPortalOnly) return 'Booking'
    if (workspace === 'booking') return 'Booking'
    return 'Ecommerce'
  })()

  const closeMenu = () => setMenuOpen(false)

  return (
    <>
      {/* Phone: one large control + full-width tap targets in a dropdown */}
      <div className="relative w-full min-w-0 sm:hidden" ref={menuRef}>
        <button
          type="button"
          aria-expanded={menuOpen}
          aria-haspopup="listbox"
          onClick={() => setMenuOpen((o) => !o)}
          className="flex h-11 w-full min-w-0 max-w-[min(100%,14rem)] touch-manipulation items-center justify-between gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 text-left shadow-sm"
        >
          <span className="truncate text-sm font-semibold text-slate-800">{mobileActiveLabel}</span>
          <i className={`fa-solid fa-chevron-down shrink-0 text-xs text-slate-500 transition ${menuOpen ? 'rotate-180' : ''}`} />
        </button>
        {menuOpen && (
          <div
            className="absolute right-0 z-[110] mt-1 max-h-[min(70vh,24rem)] w-[min(calc(100vw-5rem),16rem)] overflow-y-auto rounded-xl border border-slate-200 bg-white py-1 shadow-lg"
            role="listbox"
          >
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
              </>
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
          </div>
        )}
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
          <>
            <Link href="/pos" className={segmentClass(isPosCheckout)}>
              POS
            </Link>
            <Link href="/pos/appointments" className={segmentClass(isPosAppointments)} title="Appointments">
              <span className="xl:hidden">Apts</span>
              <span className="hidden xl:inline">Appointments</span>
            </Link>
          </>
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
