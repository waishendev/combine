'use client'

import { useEffect, useMemo, useState } from 'react'

type StaffOption = { id: number; name: string }
type PaymentMethodKey = 'cash' | 'qrpay' | 'credit_card'
type PaymentBreakdownRow = { method?: string | null; payment_method?: string | null; amount?: number | string | null }

type VoidScope = 'order_only' | 'order_and_appointment'

type VoidPreview = {
  order_id: number
  order_number: string
  is_deposit_only_order: boolean
  has_active_settlement: boolean
  requires_void_scope_choice: boolean
  other_active_deposit_order_count: number
  other_active_non_deposit_order_count: number
  default_void_scope: VoidScope
  linked_bookings: Array<{
    booking_id: number
    booking_code: string
    status: string
    other_active_order_count: number
    other_active_deposit_order_count?: number
    other_active_non_deposit_order_count?: number
  }>
  message?: string | null
}

type SplitRow = {
  id: string
  staff_id: number | null
  share_percent: number
  search: string
  open: boolean
}

type ItemSplitDraft = {
  draft_key: string
  order_item_id: number
  item_type: string
  line_ref_id: string | null
  name: string
  qty: number
  unit_amount: number
  line_total: number
  rows: SplitRow[]
}

type OfflineOrderActionsProps = {
  orderId: number
  channel: string
  billDate?: string | null
  currentPaymentMethod?: string | null
  orderAmount?: number
  paymentBreakdown?: PaymentBreakdownRow[] | null
  staffActionLabel?: 'sales_person' | 'worker'
  hideStaffAction?: boolean
  /** When false, hides Edit Sales Person / Edit Worker (e.g. sales report without ecommerce.orders.update). */
  canEditStaffSplit?: boolean
  /** When false, hides Void Order (needs ecommerce.orders.update | pos.checkout | pos.appointments.manage). */
  canVoid?: boolean
  onDone: () => void
}

const PAYMENT_METHODS: Array<{ method: PaymentMethodKey; label: string }> = [
  { method: 'cash', label: 'Cash' },
  { method: 'qrpay', label: 'QRPay' },
  { method: 'credit_card', label: 'Credit Card' },
]

const emptyPaymentAmounts = (): Record<PaymentMethodKey, string> => ({ cash: '', qrpay: '', credit_card: '' })

const normalizePaymentEditorMethod = (value?: string | null): PaymentMethodKey | null => {
  const key = String(value ?? '').trim().toLowerCase()
  if (key === 'cash') return 'cash'
  if (key === 'qrpay' || key === 'qr_pay' || key === 'qr pay') return 'qrpay'
  if (['credit_card', 'billplz_credit_card', 'billplz_card', 'card', 'credit-card', 'credit card'].includes(key)) return 'credit_card'
  return null
}

const money = (amount: number) => amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })

/** Prefer field validation messages over a generic "Validation failed" top-level message. */
function apiActionErrorMessage(json: unknown, fallback = 'Action failed.'): string {
  if (!json || typeof json !== 'object') return fallback
  const body = json as { message?: unknown; errors?: unknown }
  if (body.errors && typeof body.errors === 'object' && body.errors !== null) {
    const parts: string[] = []
    for (const value of Object.values(body.errors as Record<string, unknown>)) {
      if (Array.isArray(value)) {
        for (const item of value) {
          if (typeof item === 'string' && item.trim()) parts.push(item.trim())
        }
      } else if (typeof value === 'string' && value.trim()) {
        parts.push(value.trim())
      }
    }
    if (parts.length > 0) return parts.join(' ')
  }
  if (typeof body.message === 'string' && body.message.trim()) return body.message.trim()
  return fallback
}

function toDatetimeLocalValue(value?: string | null): string {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  const pad = (part: number) => String(part).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}

const createSplitRow = (seed?: Partial<SplitRow>): SplitRow => ({
  id: `${Date.now()}-${Math.random()}`,
  staff_id: seed?.staff_id ?? null,
  share_percent: seed?.share_percent ?? 0,
  search: seed?.search ?? '',
  open: seed?.open ?? false,
})

const normalizeType = (value?: string | null) => String(value ?? '').trim().toLowerCase()
const isFinalSettlementType = (value?: string | null) => {
  const t = normalizeType(value)
  return t === 'final_settlement' || t === 'booking_settlement' || t === 'settlement_services' || t === 'settlement_service'
}
const staffSplitItemKindLabel = (value?: string | null) => {
  const t = normalizeType(value)
  if (t === 'booking_product_base' || t === 'booking_product') return 'Booking Product'
  if (t === 'booking_product_option') return 'Add-on'
  if (t === 'booking_addon' || t === 'addon') return 'Add-on'
  if (isFinalSettlementType(t)) return 'Final Settlement'
  if (t === 'service_package') return 'Service Package'
  return null
}

export default function OfflineOrderActions({ orderId, channel, billDate, currentPaymentMethod, orderAmount, paymentBreakdown, staffActionLabel = 'sales_person', hideStaffAction = false, canEditStaffSplit, canVoid = true, onDone }: OfflineOrderActionsProps) {
  const [menuOpen, setMenuOpen] = useState(false)
  const [modal, setModal] = useState<'sales_person' | 'payment_method' | 'bill_date' | 'void' | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [toast, setToast] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  const [staffOptions, setStaffOptions] = useState<StaffOption[]>([])
  const [draftItems, setDraftItems] = useState<ItemSplitDraft[]>([])
  const [editingDraftKey, setEditingDraftKey] = useState<string | null>(null)
  const [paymentAmounts, setPaymentAmounts] = useState<Record<PaymentMethodKey, string>>(emptyPaymentAmounts)
  const [billDateInput, setBillDateInput] = useState('')
  const [remark, setRemark] = useState('')
  const [voidPreview, setVoidPreview] = useState<VoidPreview | null>(null)
  const [voidScope, setVoidScope] = useState<VoidScope>('order_and_appointment')
  const [voidPreviewLoading, setVoidPreviewLoading] = useState(false)
  const [autoBalanceByItem, setAutoBalanceByItem] = useState<Record<string, boolean>>({})


  const orderTotalCents = useMemo(() => Math.round(Number(orderAmount || 0) * 100), [orderAmount])
  const paymentRows = useMemo(() => PAYMENT_METHODS
    .map(({ method }) => ({ method, amount: Number(paymentAmounts[method] || 0) }))
    .filter((row) => Number.isFinite(row.amount) && row.amount > 0), [paymentAmounts])
  const assignedCents = useMemo(() => paymentRows.reduce((sum, row) => sum + Math.round(row.amount * 100), 0), [paymentRows])
  const assignedAmount = assignedCents / 100
  const balanceCents = orderTotalCents - assignedCents
  const paymentTotalMatches = balanceCents === 0 && paymentRows.length > 0

  const buildInitialPaymentAmounts = () => {
    const next = emptyPaymentAmounts()
    const rows = Array.isArray(paymentBreakdown) ? paymentBreakdown : []
    let hasBreakdown = false

    for (const row of rows) {
      const method = normalizePaymentEditorMethod(row.method ?? row.payment_method)
      const amount = Number(row.amount ?? 0)
      if (!method || !Number.isFinite(amount) || amount <= 0) continue
      next[method] = String(((Number(next[method] || 0) * 100) + Math.round(amount * 100)) / 100)
      hasBreakdown = true
    }

    if (!hasBreakdown) {
      const fallbackMethod = normalizePaymentEditorMethod(currentPaymentMethod)
      if (fallbackMethod && orderTotalCents > 0) {
        next[fallbackMethod] = (orderTotalCents / 100).toFixed(2)
      }
    }

    return next
  }

  const openPaymentModal = () => {
    setPaymentAmounts(buildInitialPaymentAmounts())
    setRemark('')
    setError(null)
    setModal('payment_method')
    setMenuOpen(false)
  }

  const openBillDateModal = () => {
    setBillDateInput(toDatetimeLocalValue(billDate))
    setRemark('')
    setError(null)
    setModal('bill_date')
    setMenuOpen(false)
  }

  const openVoidModal = () => {
    setRemark('')
    setError(null)
    setVoidPreview(null)
    setVoidScope('order_and_appointment')
    setModal('void')
    setMenuOpen(false)
    void loadVoidPreview()
  }

  const loadVoidPreview = async () => {
    setVoidPreviewLoading(true)
    try {
      const res = await fetch(`/api/proxy/ecommerce/orders/${orderId}/offline-actions/void-preview`, { cache: 'no-store' })
      const json = await res.json().catch(() => ({}))
      if (!res.ok || json?.success === false) {
        setError(typeof json?.message === 'string' ? json.message : 'Unable to load void options.')
        return
      }

      const preview = json?.data as VoidPreview | undefined
      if (!preview) {
        setError('Unable to load void options.')
        return
      }

      setVoidPreview(preview)
      setVoidScope(preview.default_void_scope ?? 'order_and_appointment')
    } catch {
      setError('Unable to load void options.')
    } finally {
      setVoidPreviewLoading(false)
    }
  }

  useEffect(() => {
    if (!toast) return
    const timer = setTimeout(() => setToast(null), 2800)
    return () => clearTimeout(timer)
  }, [toast])

  useEffect(() => {
    if (modal !== 'sales_person') return
    if (canEditStaffSplit === false) {
      setDraftItems([])
      setError('You do not have permission to edit staff split.')
      return
    }
    void loadSalesDraft()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [modal, orderId, staffActionLabel, canEditStaffSplit])

  const loadSalesDraft = async () => {
    setError(null)
    const staffEndpoint = staffActionLabel === 'worker'
      ? `/api/proxy/ecommerce/orders/${orderId}/offline-actions/booking-worker`
      : `/api/proxy/ecommerce/orders/${orderId}/offline-actions/sales-person`
    const [staffRes, draftRes] = await Promise.all([
      fetch('/api/proxy/staffs?page=1&per_page=200', { cache: 'no-store' }),
      fetch(staffEndpoint, { cache: 'no-store' }),
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

    if (!draftRes.ok) {
      const draftJson = await draftRes.json().catch(() => ({}))
      setDraftItems([])
      if (draftRes.status === 403) {
        setError('You do not have permission to edit staff split. Required permission: ecommerce.orders.update')
      } else {
        setError(typeof draftJson?.message === 'string' ? draftJson.message : 'Unable to load order items.')
      }
      return
    }

    const draftJson = await draftRes.json().catch(() => ({}))
    const items: unknown[] = Array.isArray(draftJson?.data?.items) ? draftJson.data.items : []
      type DraftApiItem = {
        draft_key?: string
        order_item_id?: number
        item_type?: string
        type?: string
        line_ref_id?: string | null
        name?: string
        qty?: number
        unit_amount?: number
        line_total?: number
        splits?: Array<{ staff_id?: number; share_percent?: number; staff_name?: string }>
      }

      const mapped = items.map((item: unknown) => {
        const row = item as DraftApiItem
        const orderItemId = Number(row.order_item_id)
        const itemType = row.item_type ?? row.type ?? 'product'
        const lineRefId = row.line_ref_id != null && String(row.line_ref_id).trim() !== ''
          ? String(row.line_ref_id)
          : null
        const draftKey = String(row.draft_key ?? (lineRefId ? `${orderItemId}:${itemType}:${lineRefId}` : orderItemId))
        const splitRows = Array.isArray(row.splits) && row.splits.length > 0
          ? row.splits.map((split) => createSplitRow({
              staff_id: Number(split.staff_id),
              share_percent: Number(split.share_percent),
              search: split.staff_name ?? '',
            }))
          : []

        return {
          draft_key: draftKey,
          order_item_id: orderItemId,
          item_type: itemType,
          line_ref_id: lineRefId,
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
          acc[item.draft_key] = true
          return acc
        }, {} as Record<string, boolean>),
      )
  }

  const isOffline = useMemo(() => channel.trim().toLowerCase() === 'offline', [channel])
  if (!isOffline) return null
  const canShowStaffAction = !hideStaffAction && canEditStaffSplit !== false
  const staffActionButtonLabel = staffActionLabel === 'worker' ? 'Edit Worker' : 'Edit Sales Person'
  const staffActionModalTitle = staffActionLabel === 'worker' ? 'Edit Worker' : 'Edit Item Staff Split'

  const closeModal = () => {
    setModal(null)
    setEditingDraftKey(null)
    setRemark('')
    setError(null)
    setSubmitting(false)
    setVoidPreview(null)
    setVoidScope('order_and_appointment')
    setVoidPreviewLoading(false)
  }

  const validateItem = (item: ItemSplitDraft): string | null => {
    if (item.rows.length === 0) return null
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
        if (canEditStaffSplit === false) {
          setError('You do not have permission to edit staff split.')
          setSubmitting(false)
          return
        }
        for (const item of draftItems) {
          const validationError = validateItem(item)
          if (validationError) {
            setError(validationError)
            setSubmitting(false)
            return
          }
        }

        endpoint = staffActionLabel === 'worker'
          ? `/api/proxy/ecommerce/orders/${orderId}/offline-actions/booking-worker`
          : `/api/proxy/ecommerce/orders/${orderId}/offline-actions/sales-person`
        payload = {
          item_splits: draftItems.map((item) => ({
            order_item_id: item.order_item_id,
            item_type: item.item_type,
            line_ref_id: item.line_ref_id,
            splits: item.rows.map((row) => ({ staff_id: row.staff_id, share_percent: row.share_percent })),
          })),
          remark: remark.trim() || null,
        }
      } else if (modal === 'payment_method') {
        if (!paymentTotalMatches) {
          setError(balanceCents > 0 ? `Remaining RM ${money(balanceCents / 100)}` : `Overpaid RM ${money(Math.abs(balanceCents) / 100)}`)
          setSubmitting(false)
          return
        }
        endpoint = `/api/proxy/ecommerce/orders/${orderId}/offline-actions/payment-method`
        payload = { payments: paymentRows, remark: remark.trim() || null, remarks: remark.trim() || null }
      } else if (modal === 'bill_date') {
        if (!billDateInput.trim()) {
          setError('Bill date is required.')
          setSubmitting(false)
          return
        }
        const parsed = new Date(billDateInput)
        if (Number.isNaN(parsed.getTime())) {
          setError('Invalid bill date.')
          setSubmitting(false)
          return
        }
        endpoint = `/api/proxy/ecommerce/orders/${orderId}/offline-actions/bill-date`
        payload = { bill_date: parsed.toISOString(), remark: remark.trim() || null }
      } else {
        if (!remark.trim()) {
          setError('Remarks are required to void this order.')
          setSubmitting(false)
          return
        }
        endpoint = `/api/proxy/ecommerce/orders/${orderId}/offline-actions/void`
        payload = {
          remark: remark.trim(),
          void_scope: voidPreview?.requires_void_scope_choice ? voidScope : undefined,
        }
      }

      const res = await fetch(endpoint, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      const json = await res.json().catch(() => ({}))
      if (!res.ok || json?.success === false) {
        setError(apiActionErrorMessage(json))
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

  const onChangeShare = (draftKey: string, rowId: string, nextShare: number) => {
    setDraftItems((prev) => prev.map((item) => {
      if (item.draft_key !== draftKey) return item
      const autoBalance = autoBalanceByItem[draftKey] ?? true
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

  const setRowSearch = (draftKey: string, rowId: string, value: string) => {
    setDraftItems((prev) => prev.map((item) => item.draft_key !== draftKey ? item : {
      ...item,
      rows: item.rows.map((row) => row.id === rowId ? { ...row, search: value, open: true } : row),
    }))
  }

  const selectRowStaff = (draftKey: string, rowId: string, staff: StaffOption) => {
    setDraftItems((prev) => prev.map((item) => item.draft_key !== draftKey ? item : {
      ...item,
      rows: item.rows.map((row) => row.id === rowId ? { ...row, staff_id: staff.id, search: staff.name, open: false } : row),
    }))
  }

  const editingItem = draftItems.find((item) => item.draft_key === editingDraftKey) ?? null

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
            {canShowStaffAction ? (
              <button type="button" className="block w-full px-3 py-2 text-left text-xs hover:bg-slate-100" onClick={() => { setModal('sales_person'); setMenuOpen(false) }}>{staffActionButtonLabel}</button>
            ) : null}
            <button type="button" className="block w-full px-3 py-2 text-left text-xs hover:bg-slate-100" onClick={openPaymentModal}>Edit Payment Method</button>
            <button type="button" className="block w-full px-3 py-2 text-left text-xs hover:bg-slate-100" onClick={openBillDateModal}>Edit Bill Date</button>
            {canVoid ? (
              <button type="button" className="block w-full px-3 py-2 text-left text-xs text-red-600 hover:bg-red-50" onClick={openVoidModal}>Void Order</button>
            ) : null}
          </div>
        ) : null}
      </div>

      {modal ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center" role="dialog" aria-modal="true">
          <div className="absolute inset-0 bg-black/50" onClick={closeModal} />
          <div className="relative max-h-[90vh] w-full max-w-5xl overflow-auto rounded-lg bg-white shadow-lg" onClick={(e) => e.stopPropagation()}>
            <div className="border-b px-5 py-3 text-left">
              <h3 className="text-base font-semibold">
                {modal === 'sales_person'
                  ? staffActionModalTitle
                  : modal === 'payment_method'
                    ? 'Edit Payment Method'
                    : modal === 'bill_date'
                      ? 'Edit Bill Date'
                      : 'Void Order'}
              </h3>
              {modal === 'void' ? (
                <p className="mt-1 text-xs text-slate-500">This action cannot be undone. A remark is required.</p>
              ) : null}
            </div>

            <div className="space-y-3 px-5 py-4 text-left text-sm">
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
                    const kindLabel = staffSplitItemKindLabel(item.item_type)
                    const rowActionLabel = isFinalSettlementType(item.item_type)
                      ? item.rows.length > 0 ? 'Edit Worker' : 'Assign Worker'
                      : item.rows.length > 0 ? 'Edit Staff' : 'Assign Staff'
                    return (
                      <div key={item.draft_key} className="grid grid-cols-4 gap-4 border-t border-slate-200 px-4 py-4">
                        <div>
                          <p className="font-semibold text-slate-900">{item.name}</p>
                          <p className="text-xs text-slate-500">
                            {kindLabel ? `${kindLabel} · ` : ''}Qty: {item.qty}
                          </p>
                        </div>
                        <div>
                          <p className="text-sm text-slate-700">{detail}</p>
                          <button type="button" className="mt-2 inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-3 py-2 text-xs font-semibold text-white" onClick={() => setEditingDraftKey(item.draft_key)}>
                            <i className="fa-solid fa-plus" /> {rowActionLabel}
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
                <div className="space-y-4 rounded-xl border border-slate-200 bg-slate-50 p-4">
                  <div className="flex items-center justify-between rounded-lg bg-white px-3 py-2">
                    <span className="text-sm font-semibold text-slate-700">Order total / net amount</span>
                    <span className="text-base font-bold text-slate-900">RM {money(orderTotalCents / 100)}</span>
                  </div>

                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                    {PAYMENT_METHODS.map(({ method, label }) => (
                      <div key={method}>
                        <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-600">{label} Amount</label>
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={paymentAmounts[method]}
                          onChange={(event) => {
                            setError(null)
                            setPaymentAmounts((prev) => ({ ...prev, [method]: event.target.value }))
                          }}
                          className="h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-900 focus:border-blue-500 focus:outline-none"
                          placeholder="0.00"
                        />
                      </div>
                    ))}
                  </div>

                  <div className="grid grid-cols-1 gap-2 rounded-lg bg-white px-3 py-2 text-xs font-semibold text-slate-700 sm:grid-cols-3">
                    <span>Total assigned: RM {money(assignedAmount)}</span>
                    <span className={balanceCents === 0 ? 'text-emerald-700' : balanceCents > 0 ? 'text-amber-700' : 'text-rose-700'}>
                      {balanceCents === 0 ? 'Balanced' : balanceCents > 0 ? `Remaining RM ${money(balanceCents / 100)}` : `Overpaid RM ${money(Math.abs(balanceCents) / 100)}`}
                    </span>
                    <span>Payment rows: {paymentRows.length}</span>
                  </div>
                </div>
              ) : null}

              {modal === 'bill_date' ? (
                <div className="space-y-3">
                  <p className="text-xs text-slate-600">
                    Updates the bill date used in daily sales reports. The order may move to another day after saving.
                  </p>
                  <label className="block text-xs font-semibold text-slate-700">
                    Bill date &amp; time
                    <input
                      type="datetime-local"
                      value={billDateInput}
                      onChange={(e) => setBillDateInput(e.target.value)}
                      className="mt-1 w-full rounded border border-slate-300 px-3 py-2 text-sm"
                    />
                  </label>
                </div>
              ) : null}

              {modal === 'void' ? (
                <div className="space-y-3">
                  {voidPreviewLoading ? (
                    <p className="rounded border border-slate-200 bg-slate-50 px-4 py-2.5 text-left text-sm text-slate-600">Loading void options…</p>
                  ) : null}

                  {voidPreview?.requires_void_scope_choice ? (
                    <div className="space-y-3 rounded border border-amber-200 bg-amber-50 px-4 py-3 text-left text-amber-900">
                      <div className="space-y-1">
                        <p className="text-sm font-semibold">This order is linked to an appointment</p>
                        <p className="text-xs text-amber-800/90">
                          Select how this void should be applied.
                        </p>
                      </div>
                      {voidPreview.linked_bookings.length > 0 ? (
                        <p className="text-xs text-amber-800/80">
                          Booking: {voidPreview.linked_bookings.map((row) => row.booking_code).join(', ')}
                          {voidPreview.other_active_deposit_order_count > 0
                            ? ` · ${voidPreview.other_active_deposit_order_count} other deposit receipt(s)`
                            : ''}
                          {voidPreview.other_active_non_deposit_order_count > 0
                            ? ` · ${voidPreview.other_active_non_deposit_order_count} other settlement receipt(s)`
                            : ''}
                        </p>
                      ) : null}
                      <div className="space-y-2">
                        <label className="flex w-full cursor-pointer items-start gap-3 rounded border border-amber-300 bg-white px-3 py-2.5 text-left">
                          <input
                            type="radio"
                            name="void_scope"
                            checked={voidScope === 'order_only'}
                            onChange={() => setVoidScope('order_only')}
                            className="mt-1 shrink-0"
                          />
                          <span className="min-w-0 text-left">
                            <span className="block text-sm font-semibold text-slate-900">Void this order only</span>
                            <span className="mt-0.5 block text-xs leading-relaxed text-slate-600">
                              {voidPreview.is_deposit_only_order && voidPreview.other_active_deposit_order_count > 0
                                ? 'Cancel this deposit receipt only. The appointment remains active; other deposits are not affected.'
                                : 'Cancel this order only. The appointment remains active.'}
                            </span>
                          </span>
                        </label>
                        <label className="flex w-full cursor-pointer items-start gap-3 rounded border border-red-300 bg-white px-3 py-2.5 text-left">
                          <input
                            type="radio"
                            name="void_scope"
                            checked={voidScope === 'order_and_appointment'}
                            onChange={() => setVoidScope('order_and_appointment')}
                            className="mt-1 shrink-0"
                          />
                          <span className="min-w-0 text-left">
                            <span className="block text-sm font-semibold text-slate-900">Void entire appointment</span>
                            <span className="mt-0.5 block text-xs leading-relaxed text-slate-600">
                              Cancel all linked orders (deposits and settlement) and mark the appointment as Voided.
                            </span>
                          </span>
                        </label>
                      </div>
                    </div>
                  ) : (
                    <p className="rounded border border-red-200 bg-red-50 px-4 py-3 text-left text-sm leading-relaxed text-red-700">
                      {voidPreview?.has_active_settlement
                        ? 'This appointment already has a settlement recorded. To proceed, the entire appointment must be voided. All linked deposit receipts and settlement orders will be voided, and the appointment status will be updated to Voided.'
                        : `This will void the offline order${voidPreview?.linked_bookings?.length ? ' and the linked appointment' : ''} and cancel the related payment records.`}
                    </p>
                  )}
                </div>
              ) : null}

              <textarea value={remark} onChange={(e) => setRemark(e.target.value)} rows={3} className="w-full rounded border border-slate-300 px-3 py-2 text-left" placeholder={modal === 'void' ? 'Reason for void (required)' : 'Remarks (optional)'} />

              {error ? <p className="text-xs text-red-600">{error}</p> : null}
            </div>

            <div className="flex items-center justify-end gap-2 border-t px-5 py-3">
              <button type="button" onClick={closeModal} className="rounded border border-slate-300 px-3 py-2 text-xs">Cancel</button>
              <button
                type="button"
                onClick={() => void submit()}
                disabled={
                  submitting
                  || (modal === 'void' && voidPreviewLoading)
                  || (modal === 'payment_method' && !paymentTotalMatches)
                  || (modal === 'bill_date' && !billDateInput.trim())
                  || (modal === 'sales_person' && (canEditStaffSplit === false || draftItems.length === 0))
                }
                className={`rounded px-3 py-2 text-xs text-white ${modal === 'void' ? 'bg-red-600 hover:bg-red-700' : 'bg-blue-600 hover:bg-blue-700'} disabled:opacity-60`}
              >
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
              <div>
                <h5 className="text-lg font-bold text-gray-900">Item Staff Split</h5>
                <p className="text-xs text-gray-500">
                  {staffSplitItemKindLabel(editingItem.item_type) ? `${staffSplitItemKindLabel(editingItem.item_type)} · ` : ''}
                  {editingItem.name}
                </p>
              </div>
              <button type="button" onClick={() => setEditingDraftKey(null)} className="text-2xl leading-none text-gray-500">×</button>
            </div>

            <div className="space-y-3 p-5">
              <label className="inline-flex items-center gap-2 text-sm font-medium text-gray-700">
                <input type="checkbox" checked={autoBalanceByItem[editingItem.draft_key] ?? true} onChange={(event) => setAutoBalanceByItem((prev) => ({ ...prev, [editingItem.draft_key]: event.target.checked }))} className="h-4 w-4" />
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
                          onFocus={() => setDraftItems((prev) => prev.map((item) => item.draft_key !== editingItem.draft_key ? item : { ...item, rows: item.rows.map((r) => r.id === row.id ? { ...r, open: true } : r) }))}
                          onChange={(e) => setRowSearch(editingItem.draft_key, row.id, e.target.value)}
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
                                  onClick={() => selectRowStaff(editingItem.draft_key, row.id, staff)}
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
                          readOnly={(autoBalanceByItem[editingItem.draft_key] ?? true) && index === 0}
                          onChange={(event) => onChangeShare(editingItem.draft_key, row.id, Math.max(0, Math.min(100, Number(event.target.value || 0))))}
                          className="h-10 w-full rounded-lg border border-gray-300 bg-white px-3 text-sm read-only:bg-gray-100"
                        />
                      </div>

                      <button type="button" onClick={() => setDraftItems((prev) => prev.map((item) => item.draft_key !== editingItem.draft_key ? item : { ...item, rows: item.rows.filter((r) => r.id !== row.id) }))} className="mt-6 h-10 rounded-lg border border-red-300 px-3 text-red-700 hover:bg-red-50">
                        <i className="fa-solid fa-trash" />
                      </button>
                    </div>
                  )
                })}
              </div>

              <button type="button" onClick={() => setDraftItems((prev) => prev.map((item) => item.draft_key !== editingItem.draft_key ? item : { ...item, rows: [...item.rows, createSplitRow()] }))} className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-2 text-xs font-semibold text-white">
                <i className="fa-solid fa-plus" /> Add Staff
              </button>

              <div className="flex items-center justify-between rounded-lg border border-gray-200 bg-gray-50 px-3 py-2">
                <span className="text-sm text-gray-700">Total %</span>
                <span className="text-sm font-bold text-gray-900">{editingItem.rows.reduce((sum, row) => sum + row.share_percent, 0)}%</span>
              </div>

              <div className="flex gap-3 pt-1">
                <button type="button" onClick={() => setEditingDraftKey(null)} className="flex-1 rounded-xl border-2 border-gray-300 bg-white px-4 py-2.5 text-sm font-semibold text-gray-700">Cancel</button>
                <button
                  type="button"
                  onClick={() => {
                    const current = draftItems.find((item) => item.draft_key === editingItem.draft_key)
                    const validation = current ? validateItem(current) : null
                    if (validation) {
                      setError(validation)
                      return
                    }
                    setError(null)
                    setEditingDraftKey(null)
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
