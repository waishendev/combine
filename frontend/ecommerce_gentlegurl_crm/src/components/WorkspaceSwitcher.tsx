'use client'

import Link from 'next/link'
import { startTransition, useEffect, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'

import { getWorkspace, getWorkspaceLanding, setWorkspace, type Workspace } from '@/lib/workspace'

const OPTIONS: Array<{ label: string; value: Workspace }> = [
  { label: 'Ecommerce', value: 'ecommerce' },
  { label: 'Booking', value: 'booking' },
]

type WorkspaceSwitcherProps = {
  permissions?: string[]
}

const segmentClass = (active: boolean) =>
  `rounded-md px-3 py-1 text-xs font-semibold transition ${
    active ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-600 hover:text-slate-900'
  }`

export default function WorkspaceSwitcher({ permissions = [] }: WorkspaceSwitcherProps) {
  const router = useRouter()
  const pathname = usePathname()
  const [workspace, setWorkspaceState] = useState<Workspace>(() => getWorkspace())
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

  // Warm common targets so leaving POS / heavy pages feels snappier.
  useEffect(() => {
    router.prefetch('/dashboard')
    router.prefetch('/booking/appointments')
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

  return (
    <div className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-slate-50 p-1">
      {OPTIONS.map((option) => {
        const isActive = option.value === workspace && !isPosRoute

        return (
          <button
            key={option.value}
            type="button"
            onClick={() => handleSwitch(option.value)}
            className={segmentClass(isActive)}
          >
            {option.label}
          </button>
        )
      })}
      {showPos && (
        <>
          <Link href="/pos" className={segmentClass(isPosCheckout)}>
            POS
          </Link>
          <Link href="/pos/appointments" className={segmentClass(isPosAppointments)}>
            Appointments
          </Link>
        </>
      )}
      {showSalesReport && (
        <Link href="/reports/sales/visual" className={segmentClass(isSalesVisualRoute)}>
          Daily Sales report
        </Link>
      )}
    </div>
  )
}
