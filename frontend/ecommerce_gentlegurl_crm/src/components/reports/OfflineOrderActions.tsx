'use client'

import { useEffect, useMemo, useState } from 'react'

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
  item_type: 'product' | 'service_package'
  name: string
  qty: number
  unit_amount: number
  line_total: number
  rows: SplitRow[]
}

type OfflineOrderActionsProps = {
  orderId: number
  channel: string
  currentPaymentMethod?: string | null
  onDone: () => void
}

const PAYMENT_OPTIONS = [
  'cash',
  'card',
  'qrpay',
  'online_banking',
  'manual_transfer',
  'billplz_fpx',
  'billplz_card',
  'billplz_online_banking',
  'billplz_credit_card',
]

const labelize = (value: string) => value.replaceAll('_', ' ').replace(/\b\w/g, (char) => char.toUpperCase())

const money = (amount: number) => amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })

const createSplitRow = (seed?: Partial<SplitRow>): SplitRow => ({
  id: `${Date.now()}-${Math.random()}`,
  staff_id: seed?.staff_id ?? null,
  share_percent: seed?.share_percent ?? 0,
  search: seed?.search ?? '',
  open: seed?.open ?? false,
})

export default function OfflineOrderActions({ orderId, channel, currentPaymentMethod, onDone }: OfflineOrderActionsProps) {
  const [menuOpen, setMenuOpen] = useState(false)
  const [modal, setModal] = useState<'sales_person' | 'payment_method' | 'void' | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [toast, setToast] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  const [staffOptions, setStaffOptions] = useState<StaffOption[]>([])
  const [draftItems, setDraftItems] = useState<ItemSplitDraft[]>([])
  const [editingItemId, setEditingItemId] = useState<number | null>(null)
  const [paymentMethod, setPaymentMethod] = useState(currentPaymentMethod ?? 'cash')
  const [remark, setRemark] = useState('')
  const [autoBalanceByItem, setAutoBalanceByItem] = useState<Record<number, boolean>>({})

  useEffect(() => {
    if (!toast) return
    const timer = setTimeout(() => setToast(null), 2800)
    return () => clearTimeout(timer)
  }, [toast])

  useEffect(() => {
    if (modal !== 'sales_person') return
    void loadSalesDraft()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [modal, orderId])

  const loadSalesDraft = async () => {
    const [staffRes, draftRes] = await Promise.all([
      fetch('/api/proxy/staffs?page=1&per_page=200', { cache: 'no-store' }),
      fetch(`/api/proxy/ecommerce/orders/${orderId}/offline-actions/sales-person`, { cache: 'no-store' }),
    ])

    if (staffRes.ok) {
      const staffJson = await staffRes.json().catch(() => ({}))
      const rows: unknown[] = Array.isArray(staffJson?.data?.data) ? staffJson.data.data : []
      type StaffApiRow = { id?: number; name?: string }
      setStaffOptions(
        rows
          .map((item: unknown) => {
            const row = item as StaffApiRow
            return { id: Number(row.id), name: row.name ?? `Staff #${row.id}` }
          })
          .filter((item) => Number.isFinite(item.id)),
      )
    }

    if (draftRes.ok) {
      const draftJson = await draftRes.json().catch(() => ({}))
      const items: unknown[] = Array.isArray(draftJson?.data?.items) ? draftJson.data.items : []
      type DraftApiItem = {
        order_item_id?: number
        item_type?: 'product' | 'service_package'
        name?: string
        qty?: number
        unit_amount?: number
        line_total?: number
        splits?: Array<{ staff_id?: number; share_percent?: number; staff_name?: string }>
      }

      const mapped = items.map((item: unknown) => {
        const row = item as DraftApiItem
        const splitRows = Array.isArray(row.splits) && row.splits.length > 0
          ? row.splits.map((split) => createSplitRow({
              staff_id: Number(split.staff_id),
              share_percent: Number(split.share_percent),
              search: split.staff_name ?? '',
            }))
          : [createSplitRow({ share_percent: 100 })]

        return {
          order_item_id: Number(row.order_item_id),
          item_type: row.item_type === 'service_package' ? 'service_package' : 'product',
          name: row.name ?? 'Item',
          qty: Number(row.qty ?? 0),
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
    }
  }

  const isOffline = useMemo(() => channel.trim().toLowerCase() === 'offline', [channel])
  if (!isOffline) return null

  const closeModal = () => {
    setModal(null)
    setEditingItemId(null)
    setRemark('')
    setError(null)
    setSubmitting(false)
  }

  const validateItem = (item: ItemSplitDraft): string | null => {
    if (item.rows.length === 0) return `${item.name}: please add at least one staff row.`
    const seen = new Set<number>()
    const total = item.rows.reduce((sum, row) => sum + Number(row.share_percent || 0), 0)
    for (const row of item.rows) {
      if (!row.staff_id) return `${item.name}: please select staff for all rows.`
      if (seen.has(row.staff_id)) return `${item.name}: duplicate staff is not allowed.`
      seen.add(row.staff_id)
    }
    if (total !== 100) return `${item.name}: total split must be 100%.`
    return null
  }

  const submit = async () => {
    setError(null)
    setSubmitting(true)
    try {
      let endpoint = ''
      let payload: Record<string, unknown> = {}

      if (modal === 'sales_person') {
        for (const item of draftItems) {
          const validationError = validateItem(item)
          if (validationError) {
            setError(validationError)
            setSubmitting(false)
            return
          }
        }

        endpoint = `/api/proxy/ecommerce/orders/${orderId}/offline-actions/sales-person`
        payload = {
          item_splits: draftItems.map((item) => ({
            order_item_id: item.order_item_id,
            item_type: item.item_type,
            splits: item.rows.map((row) => ({ staff_id: row.staff_id, share_percent: row.share_percent })),
          })),
          remark: remark.trim() || null,
        }
      } else if (modal === 'payment_method') {
        endpoint = `/api/proxy/ecommerce/orders/${orderId}/offline-actions/payment-method`
        payload = { payment_method: paymentMethod.trim(), remark: remark.trim() || null }
      } else {
        if (!remark.trim()) {
          setError('Remarks are required to void this order.')
          setSubmitting(false)
          return
        }
        endpoint = `/api/proxy/ecommerce/orders/${orderId}/offline-actions/void`
        payload = { remark: remark.trim() }
      }

      const res = await fetch(endpoint, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      const json = await res.json().catch(() => ({}))
      if (!res.ok || json?.success === false) {
        setError(typeof json?.message === 'string' ? json.message : 'Action failed.')
        setSubmitting(false)
        return
      }

      setToast({ type: 'success', text: typeof json?.message === 'string' ? json.message : 'Action completed.' })
      closeModal()
      onDone()
    } catch {
      setError('Unable to process this request.')
      setSubmitting(false)
    }
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

  const setRowSearch = (orderItemId: number, rowId: string, value: string) => {
    setDraftItems((prev) => prev.map((item) => item.order_item_id !== orderItemId ? item : {
      ...item,
      rows: item.rows.map((row) => row.id === rowId ? { ...row, search: value, open: true } : row),
    }))
  }

  const selectRowStaff = (orderItemId: number, rowId: string, staff: StaffOption) => {
    setDraftItems((prev) => prev.map((item) => item.order_item_id !== orderItemId ? item : {
      ...item,
      rows: item.rows.map((row) => row.id === rowId ? { ...row, staff_id: staff.id, search: staff.name, open: false } : row),
    }))
  }

  const editingItem = draftItems.find((item) => item.order_item_id === editingItemId) ?? null

  return (
    <>
      {toast ? (
        <div className={`fixed right-4 top-4 z-[100] rounded px-4 py-2 text-sm text-white shadow ${toast.type === 'success' ? 'bg-emerald-600' : 'bg-red-600'}`}>
          {toast.text}
        </div>
      ) : null}

      <div className="relative inline-block text-left">
        <button type="button" className="inline-flex h-8 items-center justify-center rounded border border-slate-300 px-2 text-xs font-semibold text-slate-700 hover:bg-slate-100" onClick={() => setMenuOpen((prev) => !prev)}>
          Actions <i className="fa-solid fa-chevron-down ml-1 text-[10px]" />
        </button>
        {menuOpen ? (
          <div className="absolute right-0 z-20 mt-1 w-48 rounded border border-slate-200 bg-white shadow-lg">
            <button type="button" className="block w-full px-3 py-2 text-left text-xs hover:bg-slate-100" onClick={() => { setModal('sales_person'); setMenuOpen(false) }}>Edit Sales Person</button>
            <button type="button" className="block w-full px-3 py-2 text-left text-xs hover:bg-slate-100" onClick={() => { setModal('payment_method'); setMenuOpen(false) }}>Edit Payment Method</button>
            <button type="button" className="block w-full px-3 py-2 text-left text-xs text-red-600 hover:bg-red-50" onClick={() => { setModal('void'); setMenuOpen(false) }}>Void Order</button>
          </div>
        ) : null}
      </div>

      {modal ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center" role="dialog" aria-modal="true">
          <div className="absolute inset-0 bg-black/50" onClick={closeModal} />
          <div className="relative max-h-[90vh] w-full max-w-5xl overflow-auto rounded-lg bg-white shadow-lg" onClick={(e) => e.stopPropagation()}>
            <div className="border-b px-5 py-3">
              <h3 className="text-base font-semibold">{modal === 'sales_person' ? 'Edit Item Staff Split' : modal === 'payment_method' ? 'Edit Payment Method' : 'Void Offline Order'}</h3>
            </div>

            <div className="space-y-3 px-5 py-4 text-sm">
              {modal === 'sales_person' ? (
                <div className="overflow-hidden rounded-xl border border-slate-200">
                  <div className="grid grid-cols-4 gap-4 bg-slate-100 px-4 py-3 text-xs font-bold uppercase text-slate-600">
                    <span>Item</span>
                    <span>Details</span>
                    <span>Unit / Deposit</span>
                    <span>Line Total</span>
                  </div>
                  {draftItems.map((item) => {
                    const total = item.rows.reduce((sum, row) => sum + row.share_percent, 0)
                    const detail = item.rows.length > 0
                      ? `${item.rows.length} staff (${total}%)`
                      : 'No staff assigned'
                    return (
                      <div key={item.order_item_id} className="grid grid-cols-4 gap-4 border-t border-slate-200 px-4 py-4">
                        <div>
                          <p className="font-semibold text-slate-900">{item.name}</p>
                          <p className="text-xs text-slate-500">Qty: {item.qty}</p>
                        </div>
                        <div>
                          <p className="text-sm text-slate-700">{detail}</p>
                          <button type="button" className="mt-2 inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-3 py-2 text-xs font-semibold text-white" onClick={() => setEditingItemId(item.order_item_id)}>
                            <i className="fa-solid fa-plus" /> {item.rows.length > 0 ? 'Edit Staff' : 'Assign Staff'}
                          </button>
                        </div>
                        <div className="text-slate-700">RM {money(item.unit_amount)}</div>
                        <div className="font-semibold text-orange-600">RM {money(item.line_total)}</div>
                      </div>
                    )
                  })}
                </div>
              ) : null}

              {modal === 'payment_method' ? (
                <select value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)} className="h-10 w-full rounded border border-slate-300 px-3">
                  {PAYMENT_OPTIONS.map((item) => <option key={item} value={item}>{labelize(item)}</option>)}
                </select>
              ) : null}

              {modal === 'void' ? <p className="rounded border border-red-200 bg-red-50 px-3 py-2 text-red-700">Warning: This will void the offline order and invalidate related payments.</p> : null}

              <textarea value={remark} onChange={(e) => setRemark(e.target.value)} rows={3} className="w-full rounded border border-slate-300 px-3 py-2" placeholder={modal === 'void' ? 'Remarks (required)' : 'Remarks (optional)'} />

              {error ? <p className="text-xs text-red-600">{error}</p> : null}
            </div>

            <div className="flex items-center justify-end gap-2 border-t px-5 py-3">
              <button type="button" onClick={closeModal} className="rounded border border-slate-300 px-3 py-2 text-xs">Cancel</button>
              <button type="button" onClick={() => void submit()} disabled={submitting} className={`rounded px-3 py-2 text-xs text-white ${modal === 'void' ? 'bg-red-600 hover:bg-red-700' : 'bg-blue-600 hover:bg-blue-700'} disabled:opacity-60`}>
                {submitting ? 'Saving...' : modal === 'void' ? 'Confirm Void' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {editingItem ? (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-2xl rounded-2xl border border-gray-200 bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-gray-200 px-5 py-3">
              <h5 className="text-lg font-bold text-gray-900">Item Staff Split</h5>
              <button type="button" onClick={() => setEditingItemId(null)} className="text-2xl leading-none text-gray-500">×</button>
            </div>

            <div className="space-y-3 p-5">
              <label className="inline-flex items-center gap-2 text-sm font-medium text-gray-700">
                <input type="checkbox" checked={autoBalanceByItem[editingItem.order_item_id] ?? true} onChange={(event) => setAutoBalanceByItem((prev) => ({ ...prev, [editingItem.order_item_id]: event.target.checked }))} className="h-4 w-4" />
                Auto Balance
              </label>

              <div className="space-y-3">
                {editingItem.rows.map((row, index) => {
                  const selectedIds = new Set(editingItem.rows.filter((r) => r.id !== row.id && r.staff_id).map((r) => r.staff_id))
                  const options = staffOptions.filter((staff) => !selectedIds.has(staff.id))
                  const filtered = row.search.trim()
                    ? options.filter((staff) => staff.name.toLowerCase().includes(row.search.toLowerCase()))
                    : options

                  return (
                    <div key={row.id} className="grid grid-cols-[1.6fr_0.8fr_auto] gap-2 rounded-lg border border-gray-200 bg-gray-50 p-3">
                      <div className="relative">
                        <label className="mb-1 block text-xs font-semibold text-gray-600">Staff</label>
                        <input
                          value={row.search}
                          onFocus={() => setDraftItems((prev) => prev.map((item) => item.order_item_id !== editingItem.order_item_id ? item : { ...item, rows: item.rows.map((r) => r.id === row.id ? { ...r, open: true } : r) }))}
                          onChange={(e) => setRowSearch(editingItem.order_item_id, row.id, e.target.value)}
                          className="h-10 w-full rounded-lg border border-gray-300 bg-white px-3 text-sm"
                          placeholder="Search staff by name / phone / email"
                        />
                        {row.open ? (
                          <div className="absolute z-[80] mt-1 max-h-56 w-full overflow-auto rounded-lg border border-gray-200 bg-white shadow-2xl">
                            {filtered.length === 0 ? (
                              <p className="px-3 py-2 text-xs text-gray-500">No available staff</p>
                            ) : (
                              filtered.map((staff) => (
                                <button
                                  key={staff.id}
                                  type="button"
                                  onClick={() => selectRowStaff(editingItem.order_item_id, row.id, staff)}
                                  className="block w-full border-b border-gray-100 px-3 py-2 text-left hover:bg-gray-50"
                                >
                                  <p className="text-xs font-semibold text-gray-900">{staff.name}</p>
                                </button>
                              ))
                            )}
                          </div>
                        ) : null}
                      </div>

                      <div>
                        <label className="mb-1 block text-xs font-semibold text-gray-600">Share %</label>
                        <input
                          type="number"
                          min={0}
                          max={100}
                          value={row.share_percent}
                          readOnly={(autoBalanceByItem[editingItem.order_item_id] ?? true) && index === 0}
                          onChange={(event) => onChangeShare(editingItem.order_item_id, row.id, Math.max(0, Math.min(100, Number(event.target.value || 0))))}
                          className="h-10 w-full rounded-lg border border-gray-300 bg-white px-3 text-sm read-only:bg-gray-100"
                        />
                      </div>

                      <button type="button" onClick={() => setDraftItems((prev) => prev.map((item) => item.order_item_id !== editingItem.order_item_id ? item : { ...item, rows: item.rows.filter((r) => r.id !== row.id) }))} className="mt-6 h-10 rounded-lg border border-red-300 px-3 text-red-700 hover:bg-red-50">
                        <i className="fa-solid fa-trash" />
                      </button>
                    </div>
                  )
                })}
              </div>

              <button type="button" onClick={() => setDraftItems((prev) => prev.map((item) => item.order_item_id !== editingItem.order_item_id ? item : { ...item, rows: [...item.rows, createSplitRow()] }))} className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-2 text-xs font-semibold text-white">
                <i className="fa-solid fa-plus" /> Add Staff
              </button>

              <div className="flex items-center justify-between rounded-lg border border-gray-200 bg-gray-50 px-3 py-2">
                <span className="text-sm text-gray-700">Total %</span>
                <span className="text-sm font-bold text-gray-900">{editingItem.rows.reduce((sum, row) => sum + row.share_percent, 0)}%</span>
              </div>

              <div className="flex gap-3 pt-1">
                <button type="button" onClick={() => setEditingItemId(null)} className="flex-1 rounded-xl border-2 border-gray-300 bg-white px-4 py-2.5 text-sm font-semibold text-gray-700">Cancel</button>
                <button
                  type="button"
                  onClick={() => {
                    const current = draftItems.find((item) => item.order_item_id === editingItem.order_item_id)
                    const validation = current ? validateItem(current) : null
                    if (validation) {
                      setError(validation)
                      return
                    }
                    setError(null)
                    setEditingItemId(null)
                  }}
                  className="flex-1 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-bold text-white"
                >
                  Save
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </>
  )
}
