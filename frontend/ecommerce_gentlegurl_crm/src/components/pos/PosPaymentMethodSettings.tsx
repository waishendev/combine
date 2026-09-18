'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'

import { useBranch } from '@/contexts/BranchContext'
import type { PosPaymentConfiguration } from '@/hooks/usePosPaymentConfiguration'

type MethodKey = PosPaymentConfiguration['methods'][number]['key']

const METHOD_META: Record<MethodKey, { icon: string; hint: string }> = {
  cash: { icon: 'fa-solid fa-money-bill-wave', hint: 'Cash tender and change calculation' },
  qrpay: { icon: 'fa-solid fa-qrcode', hint: 'QR / e-wallet payments at counter' },
  credit_card: { icon: 'fa-solid fa-credit-card', hint: 'Card terminal payments' },
  customer_balance: { icon: 'fa-solid fa-wallet', hint: 'Member wallet / store credit' },
}

type Props = {
  canUpdate?: boolean
}

export default function PosPaymentMethodSettings({ canUpdate = false }: Props) {
  const { selectedBranchId, selectedBranch } = useBranch()
  const [config, setConfig] = useState<PosPaymentConfiguration | null>(null)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    setConfig(null)
    setMessage('')
    setError('')
    if (!selectedBranchId) return

    const controller = new AbortController()
    setLoading(true)
    fetch(`/api/proxy/pos/settings/payment-methods?store_location_id=${selectedBranchId}`, {
      cache: 'no-store',
      signal: controller.signal,
    })
      .then(async (response) => {
        const payload = await response.json()
        if (!response.ok) throw new Error(payload?.message || 'Unable to load configuration.')
        setConfig(payload.data)
      })
      .catch((err) => {
        if (err?.name === 'AbortError') return
        setError(err instanceof Error ? err.message : 'Unable to load configuration.')
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false)
      })

    return () => controller.abort()
  }, [selectedBranchId])

  const orderedMethods = useMemo(() => {
    if (!config) return []
    return [...config.methods].sort((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name))
  }, [config])

  const enabledCount = useMemo(
    () => orderedMethods.filter((method) => method.is_enabled).length,
    [orderedMethods],
  )

  const updateMethod = useCallback((key: MethodKey, patch: Partial<PosPaymentConfiguration['methods'][number]>) => {
    setConfig((prev) => {
      if (!prev) return prev
      return {
        ...prev,
        methods: prev.methods.map((method) => (method.key === key ? { ...method, ...patch } : method)),
      }
    })
    setMessage('')
    setError('')
  }, [])

  const moveMethod = useCallback((key: MethodKey, direction: 'up' | 'down') => {
    setConfig((prev) => {
      if (!prev) return prev
      const sorted = [...prev.methods].sort((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name))
      const index = sorted.findIndex((method) => method.key === key)
      if (index < 0) return prev
      const swapWith = direction === 'up' ? index - 1 : index + 1
      if (swapWith < 0 || swapWith >= sorted.length) return prev

      const current = sorted[index]
      const neighbor = sorted[swapWith]
      const nextSortCurrent = neighbor.sort_order
      const nextSortNeighbor = current.sort_order

      return {
        ...prev,
        methods: prev.methods.map((method) => {
          if (method.key === current.key) return { ...method, sort_order: nextSortCurrent }
          if (method.key === neighbor.key) return { ...method, sort_order: nextSortNeighbor }
          return method
        }),
      }
    })
    setMessage('')
    setError('')
  }, [])

  const save = async () => {
    if (!config || !canUpdate) return
    if (!config.methods.some((method) => method.is_enabled)) {
      setError('Enable at least one payment method before saving.')
      return
    }

    setSaving(true)
    setMessage('')
    setError('')
    try {
      const response = await fetch('/api/proxy/pos/settings/payment-methods', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config),
      })
      const payload = await response.json()
      if (!response.ok) throw new Error(payload?.message || 'Save failed.')
      setConfig(payload.data)
      setMessage('POS payment configuration saved.')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed.')
    } finally {
      setSaving(false)
    }
  }

  if (!selectedBranchId || !selectedBranch) {
    return (
      <div className="rounded-xl border border-amber-200 bg-amber-50 px-5 py-6 text-sm text-amber-900">
        Select a specific Branch in the header. <span className="font-semibold">ALL BRANCHES</span> is not a POS configuration context.
      </div>
    )
  }

  if (loading && !config) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white px-5 py-8 text-sm text-slate-600 shadow-sm">
        Loading payment configuration…
      </div>
    )
  }

  if (!config) {
    return (
      <div className="rounded-xl border border-rose-200 bg-rose-50 px-5 py-6 text-sm text-rose-800">
        {error || 'Unable to load payment configuration.'}
      </div>
    )
  }

  const minSortOrder = orderedMethods[0]?.sort_order ?? null
  const maxSortOrder = orderedMethods[orderedMethods.length - 1]?.sort_order ?? null

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3 rounded-xl border border-slate-200 bg-white px-5 py-4 shadow-sm">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Branch</p>
          <p className="mt-1 text-lg font-semibold text-slate-900">
            {selectedBranch.name}
          </p>

        </div>
        <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-right">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Enabled</p>
          <p className="text-xl font-semibold text-slate-900">{enabledCount}/{orderedMethods.length}</p>
        </div>
      </div>
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left">
            <tr>
              <th className="px-4 py-3 font-semibold uppercase tracking-wider text-gray-600">Payment Method</th>
              <th className="px-4 py-3 font-semibold uppercase tracking-wider text-gray-600">Status</th>
              <th className="px-4 py-3 text-center font-semibold uppercase tracking-wider text-gray-600">Sort Order</th>
            </tr>
          </thead>
          <tbody>
            {orderedMethods.map((method) => {
              const meta = METHOD_META[method.key]
              const isFirst = method.sort_order === minSortOrder
              const isLast = method.sort_order === maxSortOrder
              return (
                <tr key={method.key} className="border-t border-slate-100">
                  <td className="px-4 py-3">
                    <div className="flex items-start gap-3">
                      <span className="mt-0.5 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-700">
                        <i className={`${meta.icon} text-sm`} aria-hidden />
                      </span>
                      <div>
                        <p className="font-semibold text-slate-900">{method.name}</p>
                        <p className="mt-0.5 text-xs text-slate-500">{meta.hint}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <label className={`inline-flex items-center gap-2 ${canUpdate ? 'cursor-pointer' : 'cursor-not-allowed opacity-70'}`}>
                      <input
                        type="checkbox"
                        className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                        checked={method.is_enabled}
                        disabled={!canUpdate}
                        onChange={(event) => updateMethod(method.key, { is_enabled: event.target.checked })}
                      />
                      <span className={`text-sm font-medium ${method.is_enabled ? 'text-emerald-700' : 'text-slate-500'}`}>
                        {method.is_enabled ? 'Enabled' : 'Disabled'}
                      </span>
                    </label>
                  </td>
                  <td className="px-4 py-3">
                    {canUpdate ? (
                      <div className="flex items-center justify-center gap-3">
                        <button
                          type="button"
                          className="inline-flex h-7 w-7 items-center justify-center rounded bg-blue-500 text-white transition-colors hover:bg-blue-600 disabled:cursor-not-allowed disabled:opacity-30"
                          onClick={() => moveMethod(method.key, 'up')}
                          disabled={isFirst}
                          aria-label={`Move ${method.name} up`}
                          title="Move up"
                        >
                          <i className="fa-solid fa-chevron-up text-xs" />
                        </button>
                        <span className="min-w-[2rem] bg-gray-50 text-center text-sm font-medium text-gray-700">
                          {method.sort_order}
                        </span>
                        <button
                          type="button"
                          className="inline-flex h-7 w-7 items-center justify-center rounded bg-blue-500 text-white transition-colors hover:bg-blue-600 disabled:cursor-not-allowed disabled:opacity-30"
                          onClick={() => moveMethod(method.key, 'down')}
                          disabled={isLast}
                          aria-label={`Move ${method.name} down`}
                          title="Move down"
                        >
                          <i className="fa-solid fa-chevron-down text-xs" />
                        </button>
                      </div>
                    ) : (
                      <div className="text-center text-sm font-medium text-gray-700">{method.sort_order}</div>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        {canUpdate ? (
          <button
            type="button"
            disabled={saving || enabledCount === 0}
            onClick={() => void save()}
            className="rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {saving ? 'Saving…' : 'Save Configuration'}
          </button>
        ) : (
          <p className="text-sm text-slate-500">You have view-only access for this page.</p>
        )}
        {message ? <span className="text-sm font-medium text-emerald-700">{message}</span> : null}
        {error ? <span className="text-sm font-medium text-rose-700">{error}</span> : null}
      </div>
    </div>
  )
}
