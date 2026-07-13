'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'

import CrmFormModalShell from '@/components/CrmFormModalShell'

type StaffOption = { id: number; name: string }

type SplitRow = {
  id: string
  staff_id: number | null
  share_percent: number
  search: string
  open: boolean
}

type ItemSplitDraft = {
  order_item_id: number
  item_type: string
  name: string
  qty: number
  unit_amount: number
  line_total: number
  rows: SplitRow[]
}

const createSplitRow = (seed?: Partial<SplitRow>): SplitRow => ({
  id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
  staff_id: seed?.staff_id ?? null,
  share_percent: Number(seed?.share_percent ?? 100),
  search: seed?.search ?? '',
  open: false,
})

type Props = {
  orderId: number
  orderNumber?: string | null
  onClose: () => void
  onSaved?: () => void
  showMsg?: (message: string, type: 'success' | 'error') => void
}

export default function PosDepositOrderStaffSplitModal({
  orderId,
  orderNumber,
  onClose,
  onSaved,
  showMsg,
}: Props) {
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [staffOptions, setStaffOptions] = useState<StaffOption[]>([])
  const [draftItems, setDraftItems] = useState<ItemSplitDraft[]>([])
  const [editingItemId, setEditingItemId] = useState<number | null>(null)
  const [autoBalanceByItem, setAutoBalanceByItem] = useState<Record<number, boolean>>({})
  const [remark, setRemark] = useState('')

  const loadDraft = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [staffRes, draftRes] = await Promise.all([
        fetch('/api/proxy/staffs?page=1&per_page=200', { cache: 'no-store' }),
        fetch(`/api/proxy/ecommerce/orders/${orderId}/offline-actions/sales-person`, { cache: 'no-store' }),
      ])

      if (staffRes.ok) {
        const staffJson = await staffRes.json().catch(() => ({}))
        const rows: unknown[] = Array.isArray(staffJson?.data?.data) ? staffJson.data.data : []
        setStaffOptions(
          rows
            .map((item) => {
              const row = item as { id?: number; name?: string }
              return { id: Number(row.id), name: row.name ?? `Staff #${row.id}` }
            })
            .filter((item) => Number.isFinite(item.id)),
        )
      }

      if (!draftRes.ok) {
        const draftJson = await draftRes.json().catch(() => ({}))
        setDraftItems([])
        setError(typeof draftJson?.message === 'string' ? draftJson.message : 'Unable to load deposit order staff split.')
        return
      }

      const draftJson = await draftRes.json().catch(() => ({}))
      const items: unknown[] = Array.isArray(draftJson?.data?.items) ? draftJson.data.items : []
      const mapped = items.map((item) => {
        const row = item as {
          order_item_id?: number
          item_type?: string
          type?: string
          name?: string
          qty?: number
          unit_amount?: number
          line_total?: number
          splits?: Array<{ staff_id?: number; share_percent?: number; staff_name?: string }>
        }
        const splitRows = Array.isArray(row.splits) && row.splits.length > 0
          ? row.splits.map((split) => createSplitRow({
            staff_id: Number(split.staff_id),
            share_percent: Number(split.share_percent),
            search: split.staff_name ?? '',
          }))
          : []

        return {
          order_item_id: Number(row.order_item_id),
          item_type: row.item_type ?? row.type ?? 'booking_deposit',
          name: row.name ?? 'Deposit',
          qty: Number(row.qty ?? 1),
          unit_amount: Number(row.unit_amount ?? 0),
          line_total: Number(row.line_total ?? 0),
          rows: splitRows,
        } satisfies ItemSplitDraft
      })

      setDraftItems(mapped)
      setAutoBalanceByItem(
        mapped.reduce((acc, item) => {
          acc[item.order_item_id] = true
          return acc
        }, {} as Record<number, boolean>),
      )
      if (mapped.length === 1) {
        setEditingItemId(mapped[0].order_item_id)
      }
    } finally {
      setLoading(false)
    }
  }, [orderId])

  useEffect(() => {
    void loadDraft()
  }, [loadDraft])

  const editingItem = useMemo(
    () => draftItems.find((item) => item.order_item_id === editingItemId) ?? null,
    [draftItems, editingItemId],
  )

  const staffNameById = useMemo(() => {
    const map = new Map<number, string>()
    staffOptions.forEach((staff) => map.set(staff.id, staff.name))
    return map
  }, [staffOptions])

  const validateItem = (item: ItemSplitDraft): string | null => {
    if (item.rows.length === 0) return `${item.name}: assign at least one staff member.`
    const seen = new Set<number>()
    const total = item.rows.reduce((sum, row) => sum + Number(row.share_percent || 0), 0)
    for (const row of item.rows) {
      if (!row.staff_id) return `${item.name}: please select staff for all rows.`
      if (seen.has(row.staff_id)) return `${item.name}: duplicate staff is not allowed.`
      seen.add(row.staff_id)
    }
    if (total !== 100) return `${item.name}: total split must equal 100%.`
    return null
  }

  const onChangeShare = (orderItemId: number, rowId: string, nextShare: number) => {
    setDraftItems((prev) => prev.map((item) => {
      if (item.order_item_id !== orderItemId) return item
      const autoBalance = autoBalanceByItem[orderItemId] ?? true
      if (!autoBalance) {
        return { ...item, rows: item.rows.map((row) => (row.id === rowId ? { ...row, share_percent: nextShare } : row)) }
      }

      const primary = item.rows[0]
      if (!primary || primary.id === rowId) return item

      const rows = item.rows.map((row) => (row.id === rowId ? { ...row, share_percent: nextShare } : row))
      const othersTotal = rows.slice(1).reduce((sum, row) => sum + row.share_percent, 0)
      const primaryShare = 100 - othersTotal
      if (primaryShare < 0) return item
      rows[0] = { ...rows[0], share_percent: primaryShare }
      return { ...item, rows }
    }))
  }

  const selectRowStaff = (orderItemId: number, rowId: string, staff: StaffOption) => {
    setDraftItems((prev) => prev.map((item) => item.order_item_id !== orderItemId ? item : {
      ...item,
      rows: item.rows.map((row) => row.id === rowId ? { ...row, staff_id: staff.id, search: staff.name, open: false } : row),
    }))
  }

  const save = async () => {
    setError(null)
    for (const item of draftItems) {
      const validationError = validateItem(item)
      if (validationError) {
        setError(validationError)
        return
      }
    }

    setSubmitting(true)
    try {
      const res = await fetch(`/api/proxy/ecommerce/orders/${orderId}/offline-actions/sales-person`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          item_splits: draftItems.map((item) => ({
            order_item_id: item.order_item_id,
            item_type: item.item_type,
            splits: item.rows.map((row) => ({ staff_id: row.staff_id, share_percent: row.share_percent })),
          })),
          remark: remark.trim() || null,
        }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok || json?.success === false) {
        setError(typeof json?.message === 'string' ? json.message : 'Failed to update sales person.')
        return
      }
      showMsg?.('Deposit sales person updated.', 'success')
      onSaved?.()
      onClose()
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <CrmFormModalShell
      title="Edit deposit sales person"
      onClose={onClose}
      closeDisabled={submitting || loading}
      size="lg"
      footer={(
        <>
          <button
            type="button"
            disabled={submitting || loading}
            onClick={onClose}
            className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50 sm:w-auto"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={submitting || loading || draftItems.length === 0}
            onClick={() => void save()}
            className="w-full rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50 sm:w-auto"
          >
            {submitting ? 'Saving…' : loading ? 'Loading…' : 'Save sales person'}
          </button>
        </>
      )}
    >
      <div className="relative min-h-[280px]">
        {loading ? (
          <div className="absolute inset-0 z-10 flex min-h-[280px] flex-col items-center justify-center gap-3 bg-white/90 px-6 py-12 text-center">
            <div
              className="h-10 w-10 animate-spin rounded-full border-4 border-indigo-200 border-t-indigo-600"
              aria-hidden
            />
            <div>
              <p className="text-sm font-semibold text-gray-900">Loading deposit sales person…</p>
              <p className="mt-1 text-xs text-gray-500">
                Fetching staff split for
                {orderNumber ? <> order <span className="font-mono">{orderNumber}</span></> : ' this deposit order'}
                .
              </p>
            </div>
          </div>
        ) : null}

        <div className={loading ? 'pointer-events-none select-none opacity-0' : 'space-y-4 px-4 py-4 sm:px-5'}>
          <p className="text-sm text-gray-600">
            Update who receives commission credit for this deposit order
            {orderNumber ? <> (<span className="font-mono text-xs">{orderNumber}</span>)</> : null}.
            Settlement staff splits are managed separately on the left.
          </p>

          {error ? (
            <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">{error}</p>
          ) : null}

          {draftItems.length > 0 ? (
          <div className="overflow-hidden rounded-xl border border-slate-200">
            {draftItems.map((item) => (
              <div key={item.order_item_id} className="border-t border-slate-200 px-4 py-3 first:border-t-0">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="font-semibold text-slate-900">{item.name}</p>
                    <p className="text-xs text-slate-500">Line total: RM {item.line_total.toFixed(2)}</p>
                  </div>
                  {draftItems.length > 1 ? (
                    <button
                      type="button"
                      onClick={() => setEditingItemId(item.order_item_id)}
                      className="rounded-lg border border-indigo-300 bg-indigo-50 px-3 py-1.5 text-xs font-semibold text-indigo-700"
                    >
                      {editingItemId === item.order_item_id ? 'Editing' : 'Edit split'}
                    </button>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        ) : null}

        {editingItem ? (
          <div className="space-y-3 rounded-xl border border-indigo-100 bg-indigo-50/40 p-4">
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm font-semibold text-gray-900">{editingItem.name}</p>
              <label className="flex items-center gap-2 text-xs text-gray-600">
                <input
                  type="checkbox"
                  checked={autoBalanceByItem[editingItem.order_item_id] ?? true}
                  onChange={(event) => setAutoBalanceByItem((prev) => ({ ...prev, [editingItem.order_item_id]: event.target.checked }))}
                />
                Auto balance to 100%
              </label>
            </div>

            {editingItem.rows.map((row, index) => {
              const selectedIds = new Set(
                editingItem.rows
                  .filter((entry) => entry.id !== row.id && entry.staff_id)
                  .map((entry) => Number(entry.staff_id)),
              )
              const options = staffOptions.filter((staff) => !selectedIds.has(staff.id))
              const filtered = row.search.trim()
                ? options.filter((staff) => staff.name.toLowerCase().includes(row.search.toLowerCase()))
                : options

              return (
              <div key={row.id} className="grid grid-cols-1 gap-2 sm:grid-cols-[1fr_120px_auto]">
                <div className="relative">
                  <input
                    type="text"
                    value={row.search}
                    onChange={(event) => {
                      setDraftItems((prev) => prev.map((item) => item.order_item_id !== editingItem.order_item_id ? item : {
                        ...item,
                        rows: item.rows.map((entry) => entry.id === row.id ? { ...entry, search: event.target.value, open: true } : entry),
                      }))
                    }}
                    onFocus={() => {
                      setDraftItems((prev) => prev.map((item) => item.order_item_id !== editingItem.order_item_id ? item : {
                        ...item,
                        rows: item.rows.map((entry) => entry.id === row.id ? { ...entry, search: '', open: true } : entry),
                      }))
                    }}
                    onBlur={() => {
                      window.setTimeout(() => {
                        setDraftItems((prev) => prev.map((item) => item.order_item_id !== editingItem.order_item_id ? item : {
                          ...item,
                          rows: item.rows.map((entry) => {
                            if (entry.id !== row.id) return entry
                            const restoredName = entry.staff_id
                              ? (staffNameById.get(entry.staff_id) ?? entry.search)
                              : entry.search
                            return {
                              ...entry,
                              open: false,
                              search: entry.search.trim() ? entry.search : restoredName,
                            }
                          }),
                        }))
                      }, 120)
                    }}
                    placeholder="Search staff"
                    className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm"
                  />
                  {row.open ? (
                    <div className="absolute z-10 mt-1 max-h-40 w-full overflow-auto rounded-lg border border-gray-200 bg-white shadow-lg">
                      {filtered.length === 0 ? (
                        <p className="px-3 py-2 text-xs text-gray-500">No available staff</p>
                      ) : (
                        filtered.map((staff) => (
                          <button
                            key={staff.id}
                            type="button"
                            onMouseDown={(event) => event.preventDefault()}
                            onClick={() => selectRowStaff(editingItem.order_item_id, row.id, staff)}
                            className="block w-full px-3 py-2 text-left text-sm hover:bg-slate-50"
                          >
                            {staff.name}
                          </button>
                        ))
                      )}
                    </div>
                  ) : null}
                </div>
                <input
                  type="number"
                  min={0}
                  max={100}
                  value={row.share_percent}
                  disabled={index === 0 && (autoBalanceByItem[editingItem.order_item_id] ?? true)}
                  onChange={(event) => onChangeShare(editingItem.order_item_id, row.id, Number(event.target.value))}
                  className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm disabled:bg-gray-100"
                />
                <button
                  type="button"
                  disabled={editingItem.rows.length <= 1}
                  onClick={() => setDraftItems((prev) => prev.map((item) => item.order_item_id !== editingItem.order_item_id ? item : {
                    ...item,
                    rows: item.rows.filter((entry) => entry.id !== row.id),
                  }))}
                  className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-xs font-semibold text-gray-600 disabled:opacity-50"
                >
                  Remove
                </button>
              </div>
              )
            })}

            <button
              type="button"
              onClick={() => setDraftItems((prev) => prev.map((item) => item.order_item_id !== editingItem.order_item_id ? item : {
                ...item,
                rows: [...item.rows, createSplitRow({ share_percent: 0 })],
              }))}
              className="rounded-lg border border-emerald-300 bg-white px-3 py-1.5 text-xs font-semibold text-emerald-700"
            >
              + Add staff
            </button>
          </div>
        ) : null}

        <div>
          <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-600">Remark (optional)</label>
          <input
            type="text"
            value={remark}
            onChange={(event) => setRemark(event.target.value)}
            placeholder="Reason for adjustment"
            className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm"
          />
        </div>
        </div>
      </div>
    </CrmFormModalShell>
  )
}
