'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { renderPosBodyModalPortal } from './posBodyModalPortal'

export type PackageLineInfo = {
  line_type: 'main_service' | 'addon'
  line_index: number
  booking_service_id: number
  service_name: string
  cn_name?: string | null
  parent_service_index?: number
}

export type EligibleLineEntry = PackageLineInfo & {
  can_apply: boolean
  already_applied: boolean
  reason?: string | null
  available_qty: number
}

export type PackageBalanceItem = {
  booking_service_id: number
  service_name: string
  total_qty: number
  used_qty: number
  remaining_qty: number
  reserved_qty: number
  available_qty: number
}

export type EligiblePackage = {
  customer_service_package_id: number
  package_name: string
  status: string
  started_at?: string | null
  expires_at?: string | null
  items: PackageBalanceItem[]
  eligible_lines: EligibleLineEntry[]
  has_relevant_lines: boolean
}

export type CurrentClaim = {
  usage_id: number
  customer_service_package_id: number
  booking_service_id: number
  status: string
  used_qty: number
}

type CheckedEntry = {
  customer_service_package_id: number
  booking_service_id: number
  line_type: 'main_service' | 'addon'
  line_index: number
}

function lineKey(lineType: string, lineIndex: number, bookingServiceId: number): string {
  return `${lineType}:${lineIndex}:${bookingServiceId}`
}

function formatExpiryLabel(expiresAt: string | null | undefined): string | null {
  if (!expiresAt) return null
  const date = new Date(expiresAt)
  if (Number.isNaN(date.getTime())) return null
  return date.toLocaleDateString(undefined, { day: '2-digit', month: '2-digit', year: 'numeric' })
}

function balanceTone(available: number, total: number): string {
  if (available <= 0) return 'text-red-600 bg-red-50 ring-red-100'
  if (available < total) return 'text-amber-700 bg-amber-50 ring-amber-100'
  return 'text-emerald-700 bg-emerald-50 ring-emerald-100'
}

function resolveEligibleLineForPackageItem(
  eligibleLines: EligibleLineEntry[],
  bookingServiceId: number,
): EligibleLineEntry | undefined {
  const matches = eligibleLines.filter((line) => line.booking_service_id === bookingServiceId)
  if (matches.length === 0) return undefined
  if (matches.length === 1) return matches[0]
  return matches.find((line) => line.line_type === 'addon') ?? matches[0]
}

function resolveDisplayAvailableQty(
  item: PackageBalanceItem,
  packageId: number,
  key: string | null,
  checkedByLineKey: Map<string, CheckedEntry>,
  initialChecked: Map<string, CheckedEntry>,
): number {
  if (!key) return item.available_qty

  const isCheckedNow = checkedByLineKey.get(key)?.customer_service_package_id === packageId
  const wasCheckedInitially = initialChecked.get(key)?.customer_service_package_id === packageId

  let delta = 0
  if (wasCheckedInitially && !isCheckedNow) delta += 1
  if (!wasCheckedInitially && isCheckedNow) delta -= 1

  return Math.max(0, item.available_qty + delta)
}

function buildCheckedFromClaims(
  claims: CurrentClaim[],
  appointmentLines: PackageLineInfo[],
): Map<string, CheckedEntry> {
  const map = new Map<string, CheckedEntry>()
  for (const claim of claims) {
    if (claim.status !== 'reserved') continue
    const matches = appointmentLines.filter((l) => l.booking_service_id === claim.booking_service_id)
    const line = matches.find((l) => l.line_type === 'addon') ?? matches.find((l) => l.line_type === 'main_service') ?? matches[0]
    if (!line) continue
    const key = lineKey(line.line_type, line.line_index, claim.booking_service_id)
    map.set(key, {
      customer_service_package_id: claim.customer_service_package_id,
      booking_service_id: claim.booking_service_id,
      line_type: line.line_type,
      line_index: line.line_index,
    })
  }
  return map
}

function mapsEqual(a: Map<string, CheckedEntry>, b: Map<string, CheckedEntry>): boolean {
  if (a.size !== b.size) return false
  for (const [key, val] of a) {
    const other = b.get(key)
    if (!other || other.customer_service_package_id !== val.customer_service_package_id) return false
  }
  return true
}

type Props = {
  open: boolean
  onClose: () => void
  onSuccess: () => void
  customerName?: string
} & (
  | { mode?: 'appointment'; bookingId: number; customerId?: never; bookingServiceId?: never; serviceItemId?: never; serviceName?: never }
  | { mode: 'service-item'; customerId: number; bookingServiceId: number; serviceItemId: number; bookingId?: never; serviceName?: string }
)

export default function ApplyPackageModal(props: Props) {
  const { open, onClose, customerName, onSuccess } = props
  const mode = props.mode ?? 'appointment'
  const bookingId = 'bookingId' in props ? (props.bookingId ?? 0) : 0
  const [loading, setLoading] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [packages, setPackages] = useState<EligiblePackage[]>([])
  const [currentClaims, setCurrentClaims] = useState<CurrentClaim[]>([])
  const [appointmentLines, setAppointmentLines] = useState<PackageLineInfo[]>([])
  const [checkedByLineKey, setCheckedByLineKey] = useState<Map<string, CheckedEntry>>(new Map())
  const [initialChecked, setInitialChecked] = useState<Map<string, CheckedEntry>>(new Map())
  const [expandedPackageIds, setExpandedPackageIds] = useState<Set<number>>(new Set())
  const [error, setError] = useState<string | null>(null)

  const serviceItemId = props.mode === 'service-item' ? props.serviceItemId : 0

  const parseEligiblePackagesResponse = (data: {
    packages?: EligiblePackage[]
    current_claims?: CurrentClaim[]
    appointment_lines?: PackageLineInfo[]
  }) => {
    const pkgs: EligiblePackage[] = data.packages ?? []
    const claims: CurrentClaim[] = data.current_claims ?? []
    const lines: PackageLineInfo[] = data.appointment_lines ?? []
    setPackages(pkgs)
    setCurrentClaims(claims)
    setAppointmentLines(lines)
    setExpandedPackageIds(new Set(pkgs.map((pkg) => pkg.customer_service_package_id)))
    const initial = buildCheckedFromClaims(claims, lines)
    setCheckedByLineKey(new Map(initial))
    setInitialChecked(new Map(initial))
  }

  const fetchEligiblePackages = useCallback(async () => {
    if (mode === 'appointment' && !bookingId) return
    if (mode === 'service-item' && !serviceItemId) return
    setLoading(true)
    setError(null)
    try {
      const url =
        mode === 'appointment'
          ? `/api/proxy/pos/appointments/${bookingId}/eligible-packages`
          : `/api/proxy/pos/cart/service-items/${serviceItemId}/eligible-packages`
      const res = await fetch(url, { cache: 'no-store' })
      if (!res.ok) throw new Error('Failed to load packages')
      const json = await res.json()
      parseEligiblePackagesResponse(json.data ?? json)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load packages')
    } finally {
      setLoading(false)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, bookingId, serviceItemId])

  useEffect(() => {
    if (open) {
      setCheckedByLineKey(new Map())
      setInitialChecked(new Map())
      fetchEligiblePackages()
    }
  }, [open, fetchEligiblePackages])

  const togglePackageExpanded = useCallback((packageId: number) => {
    setExpandedPackageIds((prev) => {
      const next = new Set(prev)
      if (next.has(packageId)) next.delete(packageId)
      else next.add(packageId)
      return next
    })
  }, [])

  const hasChanges = useMemo(
    () => !mapsEqual(checkedByLineKey, initialChecked),
    [checkedByLineKey, initialChecked],
  )

  const togglePackageItem = useCallback(
    (pkg: EligiblePackage, item: PackageBalanceItem, line: EligibleLineEntry | undefined) => {
      if (!line) return
      const key = lineKey(line.line_type, line.line_index, line.booking_service_id)
      const isCheckedHere = checkedByLineKey.get(key)?.customer_service_package_id === pkg.customer_service_package_id

      const consumedClaim = currentClaims.find(
        (c) =>
          c.customer_service_package_id === pkg.customer_service_package_id &&
          c.booking_service_id === item.booking_service_id &&
          c.status === 'consumed',
      )
      if (consumedClaim) return

      if (isCheckedHere) {
        setCheckedByLineKey((prev) => {
          const next = new Map(prev)
          next.delete(key)
          return next
        })
        return
      }

      if (!line.can_apply && !line.already_applied) return

      setCheckedByLineKey((prev) => {
        const next = new Map(prev)
        next.set(key, {
          customer_service_package_id: pkg.customer_service_package_id,
          booking_service_id: line.booking_service_id,
          line_type: line.line_type,
          line_index: line.line_index,
        })
        return next
      })
    },
    [checkedByLineKey, currentClaims],
  )

  const { applyCount, releaseCount } = useMemo(() => {
    let apply = 0
    let release = 0

    for (const claim of currentClaims) {
      if (claim.status !== 'reserved') continue
      const line = appointmentLines.find((l) => l.booking_service_id === claim.booking_service_id)
      if (!line) continue
      const key = lineKey(line.line_type, line.line_index, claim.booking_service_id)
      const still = checkedByLineKey.get(key)
      if (!still || still.customer_service_package_id !== claim.customer_service_package_id) {
        release += 1
      }
    }

    for (const [key, entry] of checkedByLineKey) {
      const wasReserved = [...currentClaims].some((c) => {
        if (c.status !== 'reserved') return false
        const line = appointmentLines.find((l) => l.booking_service_id === c.booking_service_id)
        if (!line) return false
        return (
          lineKey(line.line_type, line.line_index, c.booking_service_id) === key &&
          c.customer_service_package_id === entry.customer_service_package_id
        )
      })
      if (!wasReserved) apply += 1
    }

    return { applyCount: apply, releaseCount: release }
  }, [checkedByLineKey, currentClaims, appointmentLines])

  const handleSubmit = async () => {
    if (!hasChanges) return
    setSubmitting(true)
    setError(null)
    try {
      const batchBase =
        mode === 'appointment'
          ? `/api/proxy/pos/appointments/${bookingId}`
          : `/api/proxy/pos/cart/service-items/${serviceItemId}`

      const releases: number[] = []
      for (const claim of currentClaims) {
        if (claim.status !== 'reserved') continue
        const line = appointmentLines.find((l) => l.booking_service_id === claim.booking_service_id)
        if (!line) continue
        const key = lineKey(line.line_type, line.line_index, claim.booking_service_id)
        const still = checkedByLineKey.get(key)
        if (!still || still.customer_service_package_id !== claim.customer_service_package_id) {
          releases.push(claim.usage_id)
        }
      }

      const applications: CheckedEntry[] = []
      for (const [key, entry] of checkedByLineKey) {
        const wasReserved = currentClaims.some((c) => {
          if (c.status !== 'reserved') return false
          const line = appointmentLines.find((l) => l.booking_service_id === c.booking_service_id)
          if (!line) return false
          return (
            lineKey(line.line_type, line.line_index, c.booking_service_id) === key &&
            c.customer_service_package_id === entry.customer_service_package_id
          )
        })
        if (!wasReserved) applications.push(entry)
      }

      if (releases.length > 0) {
        const releaseRes = await fetch(`${batchBase}/batch-release-packages`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ releases: releases.map((id) => ({ usage_id: id })) }),
        })
        if (!releaseRes.ok) {
          const releaseJson = await releaseRes.json().catch(() => ({}))
          throw new Error(releaseJson.message || 'Failed to release packages')
        }
      }

      if (applications.length > 0) {
        const applyRes = await fetch(`${batchBase}/batch-apply-packages`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            applications: applications.map((s) => ({
              customer_service_package_id: s.customer_service_package_id,
              booking_service_id: s.booking_service_id,
              line_type: s.line_type,
              line_index: s.line_index,
              used_qty: 1,
            })),
          }),
        })
        if (!applyRes.ok) {
          const applyJson = await applyRes.json().catch(() => ({}))
          throw new Error(applyJson.message || 'Failed to apply packages')
        }
      }

      onSuccess()
      onClose()
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Operation failed')
    } finally {
      setSubmitting(false)
    }
  }

  if (!open) return null

  const modalTitle = 'Apply Package'

  const modal = (
    <div className="pos-body-stack-modal fixed inset-0 z-[9999] flex items-end justify-center overflow-y-auto bg-black/55 p-2 backdrop-blur-sm sm:items-center sm:p-4">
      <div className="absolute inset-0" onClick={onClose} aria-hidden />
      <div className="relative z-10 flex max-h-[92dvh] w-full max-w-3xl flex-col overflow-hidden rounded-t-2xl border border-gray-200 bg-white shadow-2xl sm:max-h-[min(88dvh,calc(100vh-2rem))] sm:rounded-2xl">
        <div className="shrink-0 border-b border-amber-200/80 bg-gradient-to-r from-amber-50 via-white to-orange-50 px-4 py-4 sm:px-6">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-amber-500 text-white shadow-sm">
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                  </svg>
                </span>
                <div className="min-w-0">
                  <h2 className="text-lg font-bold text-gray-900">{modalTitle}</h2>
                  {customerName ? <p className="truncate text-sm text-gray-600">{customerName}</p> : null}
                </div>
              </div>
              <p className="mt-2 text-xs text-gray-500">Tick to apply · untick to remove · then Confirm</p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg p-2 text-gray-400 transition hover:bg-gray-100 hover:text-gray-700"
              aria-label="Close"
            >
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-6">
          {loading ? (
            <div className="flex flex-col items-center justify-center gap-3 py-16">
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-amber-500 border-t-transparent" />
              <span className="text-sm text-gray-500">Loading member packages…</span>
            </div>
          ) : null}

          {!loading && packages.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-2 py-16 text-center">
              <p className="text-sm font-medium text-gray-700">No packages available</p>
              <p className="max-w-xs text-xs text-gray-500">This member has no active service packages.</p>
            </div>
          ) : null}

          {!loading && error ? (
            <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-800" role="alert">
              {error}
            </div>
          ) : null}

          {!loading && packages.length > 0 ? (
            <div className="space-y-3">
              {packages.map((pkg) => {
                const isExpired = !!(pkg.expires_at && new Date(pkg.expires_at) < new Date())
                const expiryLabel = formatExpiryLabel(pkg.expires_at)
                const isExpanded = expandedPackageIds.has(pkg.customer_service_package_id)
                const selectedOnPackage = pkg.items.filter((item) => {
                  const line = resolveEligibleLineForPackageItem(pkg.eligible_lines, item.booking_service_id)
                  if (!line) return false
                  const key = lineKey(line.line_type, line.line_index, line.booking_service_id)
                  return checkedByLineKey.get(key)?.customer_service_package_id === pkg.customer_service_package_id
                }).length

                return (
                  <article
                    key={pkg.customer_service_package_id}
                    className={`overflow-hidden rounded-2xl border shadow-sm ${
                      isExpired ? 'border-gray-200 bg-gray-50 opacity-75' : 'border-gray-200 bg-white'
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => togglePackageExpanded(pkg.customer_service_package_id)}
                      aria-expanded={isExpanded}
                      className={`flex w-full items-start gap-3 px-4 py-3 text-left transition sm:px-5 ${
                        isExpanded ? 'border-b border-gray-100 bg-amber-50/40' : 'hover:bg-gray-50'
                      }`}
                    >
                      <div className="min-w-0 flex-1">
                        <h3 className="text-base font-bold text-gray-900">{pkg.package_name}</h3>
                        <div className="mt-1.5 flex flex-wrap items-center gap-2">
                          <span
                            className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${
                              isExpired ? 'bg-red-100 text-red-700' : 'bg-emerald-100 text-emerald-800'
                            }`}
                          >
                            {isExpired ? 'Expired' : pkg.status}
                          </span>
                          {expiryLabel ? (
                            <span className="text-xs text-gray-500">
                              {isExpired ? 'Expired' : 'Expires'} {expiryLabel}
                            </span>
                          ) : null}
                          {!isExpanded ? (
                            <span className="text-[10px] text-gray-400">
                              {pkg.items.length} service{pkg.items.length === 1 ? '' : 's'}
                              {selectedOnPackage > 0 ? ` · ${selectedOnPackage} selected` : ''}
                            </span>
                          ) : null}
                        </div>
                      </div>
                      <span
                        className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-gray-200 bg-white text-gray-500 transition ${
                          isExpanded ? 'rotate-180 border-amber-200 text-amber-700' : ''
                        }`}
                        aria-hidden
                      >
                        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                        </svg>
                      </span>
                    </button>

                    {isExpanded ? (
                    <div className="divide-y divide-gray-100">
                      {pkg.items.map((item) => {
                        const line = resolveEligibleLineForPackageItem(pkg.eligible_lines, item.booking_service_id)
                        const onVisit = !!line
                        const key = line
                          ? lineKey(line.line_type, line.line_index, line.booking_service_id)
                          : null
                        const isChecked =
                          key != null &&
                          checkedByLineKey.get(key)?.customer_service_package_id === pkg.customer_service_package_id
                        const consumedClaim = currentClaims.some(
                          (c) =>
                            c.customer_service_package_id === pkg.customer_service_package_id &&
                            c.booking_service_id === item.booking_service_id &&
                            c.status === 'consumed',
                        )
                        const checkedElsewhere =
                          key != null &&
                          checkedByLineKey.has(key) &&
                          checkedByLineKey.get(key)!.customer_service_package_id !== pkg.customer_service_package_id

                        const reservedClaimForRow = currentClaims.find(
                          (c) =>
                            c.status === 'reserved' &&
                            c.customer_service_package_id === pkg.customer_service_package_id &&
                            c.booking_service_id === item.booking_service_id,
                        )

                        const canToggle =
                          onVisit &&
                          !isExpired &&
                          !consumedClaim &&
                          (line!.can_apply || line!.already_applied || isChecked || !!reservedClaimForRow) &&
                          !checkedElsewhere

                        const displayAvailableQty = resolveDisplayAvailableQty(
                          item,
                          pkg.customer_service_package_id,
                          key,
                          checkedByLineKey,
                          initialChecked,
                        )
                        const pct = item.total_qty > 0 ? Math.round((displayAvailableQty / item.total_qty) * 100) : 0

                        let hint: string | null = null
                        if (!onVisit) hint = 'Not on this visit'
                        else if (consumedClaim) hint = 'Already used'
                        else if (checkedElsewhere) hint = 'Selected in another package'
                        else if (line?.reason) hint = line.reason

                        const rowContent = (
                          <>
                            {onVisit ? (
                              <span
                                className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md border-2 ${
                                  isChecked
                                    ? 'border-amber-500 bg-amber-500 text-white'
                                    : canToggle
                                      ? 'border-gray-300 bg-white'
                                      : 'border-gray-200 bg-gray-100'
                                }`}
                              >
                                {isChecked ? (
                                  <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                  </svg>
                                ) : null}
                              </span>
                            ) : (
                              <span className="h-5 w-5 shrink-0" />
                            )}
                            <div className="min-w-0 flex-1">
                              <p className="text-sm font-semibold text-gray-900">
                                {onVisit && line?.line_type === 'addon' ? (
                                  <span className="mr-1.5 inline-flex rounded bg-cyan-100 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-cyan-800">
                                    Add-on
                                  </span>
                                ) : onVisit && line?.line_type === 'main_service' ? (
                                  <span className="mr-1.5 inline-flex rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-slate-700">
                                    Service
                                  </span>
                                ) : null}
                                {item.service_name}
                                {line?.cn_name ? (
                                  <span className="ml-1 font-normal text-gray-400">({line.cn_name})</span>
                                ) : null}
                              </p>
                              <div className="mt-1.5 h-1.5 max-w-[140px] overflow-hidden rounded-full bg-gray-100">
                                <div
                                  className={`h-full rounded-full ${
                                    displayAvailableQty <= 0 ? 'bg-red-400' : displayAvailableQty < item.total_qty ? 'bg-amber-400' : 'bg-emerald-500'
                                  }`}
                                  style={{ width: `${Math.max(0, Math.min(100, pct))}%` }}
                                />
                              </div>
                              <p className="mt-1 text-[10px] tabular-nums text-gray-400">
                                {displayAvailableQty} / {item.total_qty} left
                              </p>
                            </div>
                            <div className="shrink-0 text-right">
                              <span className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-bold ring-1 ${balanceTone(displayAvailableQty, item.total_qty)}`}>
                                {displayAvailableQty <= 0 ? 'Used up' : `${displayAvailableQty} left`}
                              </span>
                              {hint ? (
                                <p
                                  className={`mt-1 text-[10px] font-medium ${
                                    hint.includes('Not') || hint.includes('No ') || hint.includes('Used') || hint.includes('Selected') || hint.includes('covered')
                                      ? 'text-gray-400'
                                      : 'text-amber-700'
                                  }`}
                                >
                                  {hint}
                                </p>
                              ) : null}
                            </div>
                          </>
                        )

                        if (canToggle || (onVisit && isChecked && !consumedClaim)) {
                          return (
                            <button
                              key={item.booking_service_id}
                              type="button"
                              onClick={() => togglePackageItem(pkg, item, line)}
                              className={`flex w-full items-center gap-3 px-4 py-3 text-left transition sm:px-5 ${
                                isChecked
                                  ? 'bg-amber-50/80 hover:bg-amber-50'
                                  : 'hover:bg-gray-50'
                              }`}
                            >
                              {rowContent}
                            </button>
                          )
                        }

                        return (
                          <div
                            key={item.booking_service_id}
                            className={`flex items-center gap-3 px-4 py-3 sm:px-5 ${!onVisit ? 'opacity-80' : 'opacity-60'}`}
                          >
                            {rowContent}
                          </div>
                        )
                      })}
                      {pkg.items.length === 0 ? (
                        <p className="px-4 py-3 text-xs text-gray-400 sm:px-5">No services in this package.</p>
                      ) : null}
                    </div>
                    ) : null}
                  </article>
                )
              })}
            </div>
          ) : null}
        </div>

        <div className="shrink-0 border-t border-gray-200 bg-gray-50 px-4 py-3 sm:px-6 sm:py-4">
          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs text-gray-500">
              {!hasChanges
                ? 'No changes'
                : [
                    applyCount > 0 ? `${applyCount} to apply` : null,
                    releaseCount > 0 ? `${releaseCount} to remove` : null,
                  ]
                    .filter(Boolean)
                    .join(' · ')}
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={onClose}
                disabled={submitting}
                className="flex-1 rounded-xl border border-gray-300 bg-white px-4 py-2.5 text-sm font-semibold text-gray-700 transition hover:bg-gray-50 disabled:opacity-50 sm:flex-none"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSubmit}
                disabled={submitting || !hasChanges}
                className="inline-flex flex-1 items-center justify-center rounded-xl bg-amber-500 px-5 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-amber-600 disabled:cursor-not-allowed disabled:opacity-50 sm:flex-none"
              >
                {submitting ? (
                  <div className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                ) : null}
                Confirm
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )

  return renderPosBodyModalPortal(modal)
}
