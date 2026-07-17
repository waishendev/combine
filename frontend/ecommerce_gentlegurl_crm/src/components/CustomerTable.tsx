'use client'

import Link from 'next/link'
import { useEffect, useMemo, useRef, useState } from 'react'

import CustomerFiltersWrapper from './CustomerFiltersWrapper'
import TableEmptyState from './TableEmptyState'
import TableLoadingRow from './TableLoadingRow'
import PaginationControls from './PaginationControls'
import CustomerRow, { CustomerRowData } from './CustomerRow'
import {
  CustomerFilterValues,
  emptyCustomerFilters,
  sanitizeCustomerFilters,
} from './CustomerFilters'
import CustomerCreateModal from './CustomerCreateModal'
import CustomerEditModal from './CustomerEditModal'
import CustomerDeleteModal from './CustomerDeleteModal'
import CustomerViewPanel from './CustomerViewPanel'
import CustomerAssignVoucherModal from './CustomerAssignVoucherModal'
import CustomerAdjustPointsModal from './CustomerAdjustPointsModal'
import CrmFormModalShell from './CrmFormModalShell'
import {
  type CustomerApiItem,
  mapCustomerApiItemToRow,
} from './customerUtils'
import { useI18n } from '@/lib/i18n'

interface CustomerTableProps {
  permissions: string[]
}

type Meta = {
  current_page: number
  last_page: number
  per_page: number
  total: number
}

type CustomerApiResponse = {
  data?: CustomerApiItem[] | {
    current_page?: number
    data?: CustomerApiItem[]
    last_page?: number
    per_page?: number
    total?: number
    from?: number
    to?: number
    [key: string]: unknown
  }
  meta?: Partial<Meta>
  success?: boolean
  message?: string
}


type ImportSummary = {
  totalRows: number
  created: number
  updated?: number
  skipped: number
  failed: number
  failedRows?: Array<{ row: number; reason: string }>
}

export default function CustomerTable({
  permissions,
}: CustomerTableProps) {
  const { t } = useI18n()
  const [isFilterModalOpen, setIsFilterModalOpen] = useState(false)
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)
  const [inputs, setInputs] = useState<CustomerFilterValues>({ ...emptyCustomerFilters })
  const [filters, setFilters] = useState<CustomerFilterValues>({ ...emptyCustomerFilters })
  const [rows, setRows] = useState<CustomerRowData[]>([])
  const [pageSize, setPageSize] = useState(50)
  const [currentPage, setCurrentPage] = useState(1)
  const [sortColumn, setSortColumn] = useState<keyof CustomerRowData | null>(null)
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc' | null>(null)
  const [editingCustomer, setEditingCustomer] = useState<CustomerApiItem | null>(null)
  const [editLoadingId, setEditLoadingId] = useState<number | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<CustomerRowData | null>(null)
  const [viewingCustomerId, setViewingCustomerId] = useState<number | null>(null)
  const [assigningCustomer, setAssigningCustomer] = useState<CustomerRowData | null>(null)
  const [depositWaiverTarget, setDepositWaiverTarget] = useState<CustomerRowData | null>(null)
  const [depositWaiverRemark, setDepositWaiverRemark] = useState('')
  const [isSavingDepositWaiver, setIsSavingDepositWaiver] = useState(false)
  const [adjustPointsTarget, setAdjustPointsTarget] = useState<CustomerRowData | null>(null)
  const [adjustPointsAction, setAdjustPointsAction] = useState<'add' | 'reduce'>('add')
  const [balanceTarget, setBalanceTarget] = useState<CustomerRowData | null>(null)
  const [balanceDirection, setBalanceDirection] = useState<'credit' | 'debit'>('credit')
  const [balanceAmount, setBalanceAmount] = useState('')
  const [balanceRemark, setBalanceRemark] = useState('')
  const [balanceReference, setBalanceReference] = useState('')
  const [balanceDetail, setBalanceDetail] = useState<{ total_deposited?: string; total_withdrawn?: string; recent_transactions?: Array<Record<string, unknown>>; pending_topups?: Array<Record<string, unknown>> } | null>(null)
  const [balanceBusy, setBalanceBusy] = useState(false)
  const [toastMessage, setToastMessage] = useState<string | null>(null)
  const [refreshToken, setRefreshToken] = useState(0)
  const [isExporting, setIsExporting] = useState(false)
  const [isImporting, setIsImporting] = useState(false)
  const [importSummary, setImportSummary] = useState<ImportSummary | null>(null)
  const [importFailedRows, setImportFailedRows] = useState<Array<{ row: number; reason: string }>>([])
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  const canCreate = permissions.includes('customers.create')
  const canUpdate = permissions.includes('customers.update')
  const canDelete = permissions.includes('customers.delete')
  const canView = permissions.includes('customers.view')
  const canViewPointsLogs = permissions.includes('customers.points_adjustment_logs.view')
  const canManageBalance = permissions.includes('customer_wallet.adjust')
  const canViewWallet = permissions.includes('customer_wallet.view')
  const canAssignVoucher = permissions.includes('ecommerce.vouchers.assign')
  const showActions = canUpdate || canDelete || canView || canAssignVoucher || canViewWallet

  const [meta, setMeta] = useState<Meta>({
    current_page: 1,
    last_page: 1,
    per_page: 50,
    total: 0,
  })
  const [loading, setLoading] = useState(true)

  function DualSortIcons({
    active,
    dir,
    className = 'ml-1',
  }: {
    active: boolean
    dir: 'asc' | 'desc' | null
    className?: string
  }) {
    const activeColor = '#122350ff'
    const inactiveColor = '#afb2b8ff'
    const up = active && dir === 'asc' ? activeColor : inactiveColor
    const down = active && dir === 'desc' ? activeColor : inactiveColor

    return (
      <svg
        className={`${className} inline-block align-middle`}
        width="15"
        height="15"
        viewBox="0 0 10 12"
        aria-hidden="true"
        focusable="false"
      >
        <path d="M5 1 L9 5 H1 Z" fill={up} />
        <path d="M5 11 L1 7 H9 Z" fill={down} />
      </svg>
    )
  }

  useEffect(() => {
    const controller = new AbortController()
    const fetchCustomers = async () => {
      setLoading(true)
      try {
        const qs = new URLSearchParams()
        qs.set('page', String(currentPage))
        qs.set('per_page', String(pageSize))
        if (filters.name) qs.set('name', filters.name)
        if (filters.email) qs.set('email', filters.email)
        if (filters.phone) qs.set('phone', filters.phone)
        if (filters.tier) qs.set('tier', filters.tier)
        if (filters.isActive) {
          qs.set('is_active', filters.isActive === 'active' ? 'true' : 'false')
        }

        const res = await fetch(`/api/proxy/customers?${qs.toString()}`, {
          cache: 'no-store',
          signal: controller.signal,
        })

        if (!res.ok) {
          setRows([])
          setMeta((prev) => ({ ...prev, total: 0 }))
          return
        }

        const response: CustomerApiResponse = await res
          .json()
          .catch(() => ({} as CustomerApiResponse))
        if (response?.success === false && response?.message === 'Unauthorized') {
          window.location.replace('/dashboard')
          return
        }

        // Handle nested data structure: { data: { data: [...], current_page: 1, ... } }
        let customerItems: CustomerApiItem[] = []
        let paginationData: Partial<Meta> = {}

        if (response?.data) {
          if (Array.isArray(response.data)) {
            // Direct array format
            customerItems = response.data
          } else if (typeof response.data === 'object' && 'data' in response.data) {
            // Nested format: { data: { data: [...], current_page: 1, ... } }
            const nestedData = response.data as {
              data?: CustomerApiItem[]
              current_page?: number
              last_page?: number
              per_page?: number
              total?: number
            }
            customerItems = Array.isArray(nestedData.data) ? nestedData.data : []
            paginationData = {
              current_page: nestedData.current_page,
              last_page: nestedData.last_page,
              per_page: nestedData.per_page,
              total: nestedData.total,
            }
          }
        }

        // Fallback to meta if available
        if (response?.meta) {
          paginationData = { ...paginationData, ...response.meta }
        }

        const list: CustomerRowData[] = customerItems.map((item) => mapCustomerApiItemToRow(item))

        setRows(list)
        setMeta({
          current_page: Number(paginationData.current_page ?? currentPage) || 1,
          last_page: Number(paginationData.last_page ?? 1) || 1,
          per_page: Number(paginationData.per_page ?? pageSize) || pageSize,
          total: Number(paginationData.total ?? list.length) || list.length,
        })
      } catch (error) {
        if (!(error instanceof DOMException && error.name === 'AbortError')) {
          setRows([])
          setMeta((prev) => ({ ...prev, total: 0 }))
        }
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false)
        }
      }
    }

    fetchCustomers()
    return () => controller.abort()
  }, [filters, currentPage, pageSize, refreshToken])

  const handleSort = (column: keyof CustomerRowData) => {
    if (sortColumn === column) {
      if (sortDirection === 'asc') {
        setSortDirection('desc')
      } else if (sortDirection === 'desc') {
        setSortColumn(null)
        setSortDirection(null)
      } else {
        setSortDirection('asc')
      }
      return
    }

    setSortColumn(column)
    setSortDirection('asc')
  }

  const sortedRows = useMemo(() => {
    if (!sortColumn || !sortDirection) return rows

    const compare = (a: CustomerRowData, b: CustomerRowData) => {
      const valueA = a[sortColumn]
      const valueB = b[sortColumn]

      const normalize = (value: unknown) => {
        if (value == null) return ''
        if (typeof value === 'string') return value.toLowerCase()
        if (typeof value === 'number') return value
        if (typeof value === 'boolean') return value ? 1 : 0
        return value
      }

      const normalizedA = normalize(valueA)
      const normalizedB = normalize(valueB)

      if (typeof normalizedA === 'number' && typeof normalizedB === 'number') {
        return normalizedA - normalizedB
      }

      return String(normalizedA).localeCompare(String(normalizedB))
    }

    const sorted = [...rows].sort(compare)
    return sortDirection === 'asc' ? sorted : sorted.reverse()
  }, [rows, sortColumn, sortDirection])

  const handleFilterChange = (values: CustomerFilterValues) => {
    setInputs(values)
  }

  const handleFilterSubmit = (values: CustomerFilterValues) => {
    const next = sanitizeCustomerFilters(values)
    setFilters(next)
    setInputs(next)
    setCurrentPage(1)
  }

  const handleFilterReset = () => {
    setInputs({ ...emptyCustomerFilters })
    setFilters({ ...emptyCustomerFilters })
    setCurrentPage(1)
  }

  const handleBadgeRemove = (field: keyof CustomerFilterValues) => {
    const next = { ...filters, [field]: '' }
    setFilters(next)
    setInputs(next)
    setCurrentPage(1)
  }

  const handlePageChange = (page: number) => {
    if (page < 1 || page > (meta.last_page || 1)) return
    setCurrentPage(page)
  }

  const handlePageSizeChange = (size: number) => {
    setPageSize(size)
    setCurrentPage(1)
  }


  const handleExportCsv = async () => {
    setIsExporting(true)
    try {
      const res = await fetch('/api/proxy/customers/export', {
        cache: 'no-store',
      })

      if (!res.ok) {
        throw new Error('Export CSV failed.')
      }

      const blob = await res.blob()
      const disposition = res.headers.get('content-disposition')
      const fileNameMatch = disposition?.match(/filename="?([^";]+)"?/) ?? null
      const fileName = fileNameMatch?.[1] ?? `customers_export_${new Date().toISOString().replace(/[:.]/g, '-')}.csv`
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = fileName
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)
    } catch (error) {
      console.error(error)
      window.alert('Export CSV failed. Please retry.')
    } finally {
      setIsExporting(false)
    }
  }

  const handleImportCsvFile = async (file: File) => {
    setIsImporting(true)
    setImportSummary(null)
    setImportFailedRows([])

    try {
      const formData = new FormData()
      formData.append('file', file)

      const res = await fetch('/api/proxy/customers/import', {
        method: 'POST',
        body: formData,
      })

      const json = await res.json().catch(() => null)
      if (!res.ok) {
        const message =
          json && typeof json === 'object' && 'message' in json && typeof json.message === 'string'
            ? json.message
            : 'Import CSV failed. Please retry.'
        throw new Error(message)
      }

      const summaryPayload =
        json && typeof json === 'object' && 'data' in json && json.data && typeof json.data === 'object'
          ? (json.data as ImportSummary)
          : null

      if (!summaryPayload) {
        throw new Error('Import summary is missing from API response.')
      }

      setImportSummary(summaryPayload)
      setImportFailedRows(Array.isArray(summaryPayload.failedRows) ? summaryPayload.failedRows : [])
      setRefreshToken((prev) => prev + 1)
    } catch (error) {
      console.error(error)
      window.alert(error instanceof Error ? error.message : 'Import CSV failed. Please retry.')
    } finally {
      setIsImporting(false)
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    }
  }

  const colCount = showActions ? 10 : 9

  const totalPages = meta.last_page || 1

  const activeFilters = useMemo(() => {
    return (Object.entries(filters) as [keyof CustomerFilterValues, string][]) 
      .filter(([, value]) => Boolean(value))
  }, [filters])

  const filterLabels: Record<keyof CustomerFilterValues, string> = {
    name: t('common.name'),
    email: t('common.email'),
    phone: 'Phone',
    isActive: t('common.status'),
    tier: 'Tier',
  }

  const renderFilterValue = (key: keyof CustomerFilterValues, value: string) => {
    if (key === 'isActive') {
      return value === 'active' ? t('common.active') : t('common.inactive')
    }
    return value
  }

  const handleEditCustomer = async (customerId: number) => {
    setEditLoadingId(customerId)
    try {
      const res = await fetch(`/api/proxy/customers/${customerId}`, {
        cache: 'no-store',
        headers: {
          Accept: 'application/json',
          'Accept-Language': 'en',
        },
      })

      const data = await res.json().catch(() => null)
      if (data && typeof data === 'object' && data?.success === false && data?.message === 'Unauthorized') {
        window.location.replace('/dashboard')
        return
      }

      if (!res.ok) {
        const message =
          data && typeof data === 'object' && 'message' in data && typeof data.message === 'string'
            ? data.message
            : 'Failed to load customer details.'
        window.alert(message)
        return
      }

      const customer = data?.data as CustomerApiItem | undefined
      if (!customer || typeof customer !== 'object') {
        window.alert('Failed to load customer details.')
        return
      }

      setEditingCustomer(customer)
    } catch (error) {
      console.error(error)
      window.alert('Failed to load customer details.')
    } finally {
      setEditLoadingId(null)
    }
  }

  const handleCustomerCreated = (customer: CustomerRowData) => {
    setRows((prev) => {
      if (currentPage !== 1) return prev
      const filtered = prev.filter((item) => item.id !== customer.id)
      const next = [customer, ...filtered]
      return next.length > pageSize ? next.slice(0, pageSize) : next
    })

    setMeta((prevMeta) => {
      const perPage = prevMeta.per_page || pageSize || 1
      const total = (prevMeta.total || 0) + 1
      const last_page = Math.max(
        prevMeta.last_page || 1,
        Math.ceil(total / perPage),
      )

      return {
        ...prevMeta,
        total,
        last_page,
      }
    })
  }

  const handleCustomerUpdated = (customer: CustomerRowData) => {
    setRows((prev) => {
      const index = prev.findIndex((item) => item.id === customer.id)
      if (index === -1) return prev
      const existing = prev[index]
      const next = [...prev]
      next[index] = {
        ...existing,
        ...customer,
        availablePoints: customer.availablePoints ?? existing.availablePoints,
        allowBookingWithoutDeposit:
          customer.allowBookingWithoutDeposit ?? existing.allowBookingWithoutDeposit,
      }
      return next
    })
  }

  const handleCustomerDeleted = (customerId: number) => {
    setRows((prev) => prev.filter((item) => item.id !== customerId))

    setMeta((prevMeta) => {
      const perPage = prevMeta.per_page || pageSize || 1
      const total = Math.max((prevMeta.total || 0) - 1, 0)
      const last_page = Math.max(1, Math.ceil(total / perPage))
      const nextMeta: Meta = {
        ...prevMeta,
        total,
        last_page,
        current_page: Math.min(prevMeta.current_page || 1, last_page),
      }

      if ((prevMeta.current_page || 1) > last_page) {
        setCurrentPage(last_page)
      }

      return nextMeta
    })
  }

  const handleToggleDepositWaiver = async () => {
    if (!depositWaiverTarget) return
    setIsSavingDepositWaiver(true)
    try {
      const nextValue = !Boolean(depositWaiverTarget.allowBookingWithoutDeposit)
      const response = await fetch(`/api/proxy/customers/${depositWaiverTarget.id}/deposit-waiver`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          allow_booking_without_deposit: nextValue,
          remark: depositWaiverRemark.trim() || null,
        }),
      })

      const json = await response.json().catch(() => null)
      if (!response.ok) {
        const message = json && typeof json?.message === 'string' ? json.message : 'Unable to update deposit waiver setting.'
        throw new Error(message)
      }

      setRows((prev) =>
        prev.map((row) =>
          row.id === depositWaiverTarget.id
            ? { ...row, allowBookingWithoutDeposit: nextValue }
            : row,
        ),
      )
      setToastMessage(nextValue ? 'No deposit booking enabled.' : 'No deposit booking disabled.')
      setTimeout(() => setToastMessage(null), 2500)
      setDepositWaiverTarget(null)
      setDepositWaiverRemark('')
    } catch (error) {
      window.alert(error instanceof Error ? error.message : 'Unable to update deposit waiver setting.')
    } finally {
      setIsSavingDepositWaiver(false)
    }
  }

  const loadBalanceDetail = async (customer: CustomerRowData) => {
    setBalanceBusy(true)
    try {
      const res = await fetch(`/api/proxy/admin/customers/${customer.id}/wallet`, { cache: 'no-store', headers: { Accept: 'application/json' } })
      const json = await res.json().catch(() => null)
      if (res.ok) {
        setBalanceDetail(json?.data ?? null)
      } else {
        setBalanceDetail(null)
      }
    } finally {
      setBalanceBusy(false)
    }
  }

  const refreshBalanceAfterAction = async (customerId: number, nextBalance?: number) => {
    if (typeof nextBalance === 'number' && Number.isFinite(nextBalance)) {
      setRows((prev) => prev.map((row) => row.id === customerId ? { ...row, walletBalance: nextBalance } : row))
    }
    const customer = rows.find((row) => row.id === customerId)
    if (customer) await loadBalanceDetail({ ...customer, walletBalance: nextBalance ?? customer.walletBalance })
  }

  const handlePointsAdjusted = (customerId: number, availablePoints: number) => {
    setRows((prev) =>
      prev.map((row) =>
        row.id === customerId ? { ...row, availablePoints } : row,
      ),
    )
    setToastMessage('Member points updated successfully.')
    setTimeout(() => setToastMessage(null), 2500)
  }

  return (
    <div>
      {toastMessage && (
        <div className="fixed right-6 top-6 z-50 rounded-lg bg-emerald-600 px-4 py-3 text-sm font-medium text-white shadow-lg">
          {toastMessage}
        </div>
      )}
      {isFilterModalOpen && (
        <CustomerFiltersWrapper
          inputs={inputs}
          onChange={handleFilterChange}
          onSubmit={handleFilterSubmit}
          onReset={handleFilterReset}
          onClose={() => setIsFilterModalOpen(false)}
          disabled={loading}
        />
      )}


      {balanceTarget && (
        <CrmFormModalShell title="Manage Balance" onClose={() => { setBalanceTarget(null); setBalanceDetail(null) }} size="xl">
          <div className="space-y-5 text-sm">
            <div className="grid gap-3 md:grid-cols-4">
              <div className="rounded-lg bg-slate-50 p-3 md:col-span-2">
                <div className="font-semibold">{balanceTarget.name}</div>
                <div className="text-gray-600">{balanceTarget.email} · {balanceTarget.phone}</div>
              </div>
              <div className="rounded-lg bg-emerald-50 p-3"><div className="text-xs uppercase text-emerald-700">Current Balance</div><div className="text-xl font-bold text-emerald-800">RM {(balanceTarget.walletBalance ?? 0).toFixed(2)}</div></div>
              <div className="rounded-lg bg-blue-50 p-3"><div className="text-xs uppercase text-blue-700">Total Deposited</div><div className="text-xl font-bold text-blue-800">RM {Number(balanceDetail?.total_deposited ?? 0).toFixed(2)}</div><div className="mt-1 text-xs uppercase text-rose-700">Total Withdrawn: RM {Number(balanceDetail?.total_withdrawn ?? 0).toFixed(2)}</div></div>
            </div>
            {canManageBalance ? (
              <>
                <div className="flex gap-2">
                  <button type="button" onClick={() => setBalanceDirection('credit')} className={`rounded px-4 py-2 font-semibold ${balanceDirection === 'credit' ? 'bg-emerald-600 text-white' : 'bg-gray-100'}`}>Deposit</button>
                  <button type="button" onClick={() => setBalanceDirection('debit')} className={`rounded px-4 py-2 font-semibold ${balanceDirection === 'debit' ? 'bg-rose-600 text-white' : 'bg-gray-100'}`}>Withdraw</button>
                </div>
                <div className="grid gap-3 md:grid-cols-3">
                  <input value={balanceAmount} onChange={(event) => setBalanceAmount(event.target.value)} placeholder="Amount" className="w-full rounded border px-3 py-2" />
                  <input value={balanceReference} onChange={(event) => setBalanceReference(event.target.value)} placeholder="Reference optional" className="w-full rounded border px-3 py-2" />
                  <textarea value={balanceRemark} onChange={(event) => setBalanceRemark(event.target.value)} placeholder="Reason / Remark required" className="w-full rounded border px-3 py-2 md:col-span-3" />
                </div>
                <div className="rounded bg-amber-50 p-3 text-amber-900">Current Balance RM {(balanceTarget.walletBalance ?? 0).toFixed(2)} · {balanceDirection === 'credit' ? 'Deposit +' : 'Withdraw -'}RM {Number(balanceAmount || 0).toFixed(2)} · New Balance RM {((balanceTarget.walletBalance ?? 0) + (balanceDirection === 'credit' ? Number(balanceAmount || 0) : -Number(balanceAmount || 0))).toFixed(2)}</div>
                <button type="button" disabled={balanceBusy} className={`w-full rounded px-4 py-2 font-semibold text-white disabled:opacity-50 ${balanceDirection === 'credit' ? 'bg-emerald-600' : 'bg-rose-600'}`} onClick={async () => {
                  if (balanceDirection === 'debit' && Number(balanceAmount || 0) > (balanceTarget.walletBalance ?? 0)) { window.alert('Withdraw amount cannot exceed current balance.'); return }
                  setBalanceBusy(true)
                  try {
                    const res = await fetch(`/api/proxy/admin/customers/${balanceTarget.id}/wallet/adjustments`, { method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' }, body: JSON.stringify({ direction: balanceDirection, amount: balanceAmount, remark: balanceRemark, reference_no: balanceReference || undefined }) })
                    const json = await res.json().catch(() => null)
                    if (!res.ok) { window.alert(json?.message ?? `${balanceDirection === 'credit' ? 'Deposit' : 'Withdraw'} failed.`); return }
                    const next = Number(json?.data?.wallet_balance ?? 0)
                    await refreshBalanceAfterAction(balanceTarget.id, next)
                    setBalanceAmount(''); setBalanceRemark(''); setBalanceReference(''); setToastMessage(balanceDirection === 'credit' ? 'Deposit completed.' : 'Withdraw completed.'); setTimeout(() => setToastMessage(null), 2500)
                  } finally { setBalanceBusy(false) }
                }}>{balanceDirection === 'credit' ? 'Confirm Deposit' : 'Confirm Withdraw'}</button>
              </>
            ) : <p className="rounded border border-dashed border-slate-300 p-4 text-gray-500">You can view this wallet, but you do not have permission to Deposit or Withdraw.</p>}

            <div>
              <h3 className="mb-2 font-semibold">Pending Top Ups</h3>
              {(balanceDetail?.pending_topups ?? []).length === 0 ? <p className="rounded border border-dashed p-4 text-gray-500">No pending top-ups for this customer.</p> : <div className="space-y-2">{(balanceDetail?.pending_topups ?? []).map((tx) => <div key={String(tx.id)} className="rounded border p-3"><div className="flex flex-wrap items-center justify-between gap-2"><div><div className="font-semibold">{String(tx.transaction_no)} · RM {Number(tx.amount ?? 0).toFixed(2)}</div><div className="text-xs text-gray-500">{String(tx.workspace_type ?? '-')} · {String(tx.payment_method_label ?? '-')} · {String(tx.created_at ?? '-')}</div>{typeof tx.metadata === 'object' && tx.metadata && 'payment_proof_url' in tx.metadata ? <a className="text-xs text-blue-600 underline" href={String((tx.metadata as { payment_proof_url?: unknown }).payment_proof_url)} target="_blank">View payment proof</a> : null}</div><div className="flex gap-2"><button type="button" className="rounded bg-emerald-600 px-3 py-1 text-xs font-semibold text-white" onClick={async () => { const res = await fetch(`/api/proxy/admin/customers/${balanceTarget.id}/wallet/transactions/${tx.id}/approve`, { method: 'POST', headers: { Accept: 'application/json' } }); const json = await res.json().catch(() => null); if (!res.ok) { window.alert(json?.message ?? 'Approve failed.'); return } await refreshBalanceAfterAction(balanceTarget.id, Number(json?.data?.wallet_balance ?? balanceTarget.walletBalance ?? 0)) }}>Approve</button><button type="button" className="rounded bg-rose-600 px-3 py-1 text-xs font-semibold text-white" onClick={async () => { const reason = window.prompt('Reject reason?'); if (!reason) return; const res = await fetch(`/api/proxy/admin/customers/${balanceTarget.id}/wallet/transactions/${tx.id}/reject`, { method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' }, body: JSON.stringify({ remark: reason }) }); const json = await res.json().catch(() => null); if (!res.ok) { window.alert(json?.message ?? 'Reject failed.'); return } await refreshBalanceAfterAction(balanceTarget.id) }}>Reject</button></div></div></div>)}</div>}
            </div>

            <div>
              <h3 className="mb-2 font-semibold">Wallet Transactions</h3>
              <div className="overflow-x-auto"><table className="min-w-full text-xs"><thead><tr className="bg-slate-100 text-left"><th className="p-2">Date/time</th><th>Transaction No</th><th>Type</th><th>Deposit</th><th>Withdraw</th><th>Balance After</th><th>Created By</th><th>Reason</th><th>Reference</th><th>Status</th><th>Receipt</th><th>Actions</th></tr></thead><tbody>{(balanceDetail?.recent_transactions ?? []).map((tx) => <tr key={String(tx.id)} className="border-t"><td className="p-2">{String(tx.created_at ?? '-')}</td><td>{String(tx.transaction_no ?? '-')}</td><td>{String(tx.type ?? '-')}</td><td className="text-emerald-700">{tx.direction === 'credit' ? `RM ${Number(tx.amount ?? 0).toFixed(2)}` : '-'}</td><td className="text-rose-700">{tx.direction === 'debit' ? `RM ${Number(tx.amount ?? 0).toFixed(2)}` : '-'}</td><td>RM {Number(tx.balance_after ?? 0).toFixed(2)}</td><td>{typeof tx.creator === 'object' && tx.creator && 'name' in tx.creator ? String((tx.creator as { name?: unknown }).name) : '-'}</td><td>{String(tx.remark ?? '-')}</td><td>{String(tx.reference_no ?? '-')}</td><td>{String(tx.status ?? '-')}</td><td>{String(tx.status) === 'completed' ? 'Receipt' : 'Details'}</td><td>{permissions.includes('customer_wallet.reverse_transaction') && String(tx.status) === 'completed' ? <button type="button" className="text-rose-600 underline" onClick={async () => { const reason = window.prompt('Reversal reason?'); if (!reason) return; const res = await fetch(`/api/proxy/admin/customers/${balanceTarget.id}/wallet/transactions/${tx.id}/reverse`, { method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' }, body: JSON.stringify({ remark: reason }) }); const json = await res.json().catch(() => null); if (!res.ok) { window.alert(json?.message ?? 'Reverse failed.'); return } await refreshBalanceAfterAction(balanceTarget.id, Number(json?.data?.wallet_balance ?? balanceTarget.walletBalance ?? 0)) }}>Reverse</button> : '-'}</td></tr>)}</tbody></table></div>
            </div>
          </div>
        </CrmFormModalShell>
      )}

      {isCreateModalOpen && (
        <CustomerCreateModal
          onClose={() => setIsCreateModalOpen(false)}
          onSuccess={(customer) => {
            setIsCreateModalOpen(false)
            handleCustomerCreated(customer)
          }}
        />
      )}

      <div className="flex justify-between items-center mb-6 flex-wrap gap-2">
        <div className="flex flex-wrap items-center gap-2">
          {canCreate && (
            <button
              className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded text-sm flex items-center gap-2"
              onClick={() => setIsCreateModalOpen(true)}
              type="button"
            >
              <i className="fa-solid fa-user-plus" />
              {t('customer.createAction')}
            </button>
          )}

          <button
            className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded text-sm flex items-center gap-2 disabled:opacity-50"
            onClick={() => setIsFilterModalOpen(true)}
            disabled={loading}
          >
            <i className="fa-solid fa-filter" />
            {t('common.filter')}
          </button>

          {canViewPointsLogs && (
            <Link
              href="/customers/points-adjustment-logs"
              className="bg-slate-600 hover:bg-slate-700 text-white px-4 py-2 rounded text-sm flex items-center gap-2"
            >
              <i className="fa-solid fa-clock-rotate-left" />
              Points Logs
            </Link>
          )}
        </div>

        <div className="flex items-center gap-3">
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,text/csv"
            className="hidden"
            onChange={(event) => {
              const file = event.target.files?.[0]
              if (file) {
                void handleImportCsvFile(file)
              }
            }}
          />
          <button
            type="button"
            className="bg-violet-500 hover:bg-violet-600 text-white px-4 py-2 rounded text-sm disabled:opacity-50"
            onClick={handleExportCsv}
            disabled={loading || isExporting || isImporting}
          >
            {isExporting ? 'Exporting...' : 'Export CSV'}
          </button>
          <button
            type="button"
            className="bg-amber-500 hover:bg-amber-600 text-white px-4 py-2 rounded text-sm disabled:opacity-50"
            onClick={() => fileInputRef.current?.click()}
            disabled={loading || isExporting || isImporting}
          >
            {isImporting ? 'Importing...' : 'Import CSV'}
          </button>
          <label htmlFor="pageSize" className="text-sm text-gray-700">
            {t('common.show')}
          </label>
          <select
            id="pageSize"
            value={pageSize}
            onChange={(e) => handlePageSizeChange(Number(e.target.value))}
            className="border border-gray-300 rounded px-2 py-1 text-sm disabled:opacity-50"
            disabled={loading}
          >
            {[50, 100, 150, 200].map((size) => (
              <option key={size} value={size}>
                {size}
              </option>
            ))}
          </select>
        </div>
      </div>


      {(isImporting || importSummary) && (
        <div className="mb-4 rounded border border-slate-200 bg-slate-50 p-3 text-sm">
          <div>
            Import status: processing file on server...
          </div>
          {importSummary && (
            <div className="mt-2 grid grid-cols-2 md:grid-cols-5 gap-2">
              <div>Total rows: {importSummary.totalRows}</div>
              <div>Created: {importSummary.created}</div>
              <div>Updated: {importSummary.updated ?? 0}</div>
              <div>Skipped: {importSummary.skipped}</div>
              <div>Failed: {importSummary.failed}</div>
            </div>
          )}
          {importFailedRows.length > 0 && (
            <div className="mt-2 max-h-40 overflow-auto text-xs text-red-600">
              {importFailedRows.slice(0, 20).map((item) => (
                <div key={`${item.row}-${item.reason}`}>Row {item.row}: {item.reason}</div>
              ))}
              {importFailedRows.length > 20 && <div>...and {importFailedRows.length - 20} more</div>}
            </div>
          )}
        </div>
      )}

      {activeFilters.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 mb-4">
          {activeFilters.map(([key, value]) => (
            <span
              key={key}
              className="inline-flex items-center gap-2 bg-blue-50 text-blue-700 px-3 py-1 rounded-full text-xs"
            >
              <span className="font-medium">{filterLabels[key]}</span>
              <span>{renderFilterValue(key, value)}</span>
              <button
                type="button"
                className="text-blue-600 hover:text-blue-800"
                onClick={() => handleBadgeRemove(key)}
                aria-label={`${t('common.removeFilter')} ${filterLabels[key]}`}
              >
                <i className="fa-solid fa-xmark" />
              </button>
            </span>
          ))}
        </div>
      )}

      <div className="bg-white shadow rounded-lg overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200 text-sm">
          <thead className="bg-slate-300/70">
            <tr>
              {(
                [
                  { key: 'name', label: t('common.name') },
                  { key: 'email', label: t('common.email') },
                  { key: 'phone', label: 'Phone' },
                  { key: 'tier', label: 'Tier' },
                  { key: 'availablePoints', label: 'Member Points' },
                  { key: 'walletBalance', label: 'Balance' },
                  { key: 'isActive', label: t('common.status') },
                  { key: 'allowBookingWithoutDeposit', label: 'Required Deposit' },
                  { key: 'createdAt', label: t('common.createdAt') },
                ] as const
              ).map(({ key, label }) => (
                <th
                  key={key}
                  className="px-4 py-2 font-semibold text-left text-gray-600 uppercase tracking-wider"
                >
                  <button
                    type="button"
                    className="flex items-center gap-1"
                    onClick={() => handleSort(key)}
                  >
                    <span>{label}</span>
                    <DualSortIcons
                      active={sortColumn === key && sortDirection !== null}
                      dir={sortColumn === key ? sortDirection : null}
                    />
                  </button>
                </th>
              ))}
              {showActions && (
                <th className="px-4 py-2 font-semibold text-left text-gray-600 tracking-wider">
                  {t('common.actions')}
                </th>
              )}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <TableLoadingRow colSpan={colCount} />
            ) : rows.length > 0 ? (
              sortedRows.map((customer) => (
                <CustomerRow
                  key={customer.id}
                  customer={customer}
                  showActions={showActions}
                  canAssignVoucher={canAssignVoucher}
                  canUpdate={canUpdate}
                  canDelete={canDelete}
                  canView={canView}
                  canManageBalance={canManageBalance || canViewWallet}
                  onManageBalance={() => {
                    setBalanceTarget(customer)
                    void loadBalanceDetail(customer)
                    setBalanceAmount('')
                    setBalanceRemark('')
                    setBalanceReference('')
                  }}
                  onAssignVoucher={() => {
                    if (canAssignVoucher) {
                      setAssigningCustomer(customer)
                    }
                  }}
                  onEdit={() => {
                    if (canUpdate) {
                      void handleEditCustomer(customer.id)
                    }
                  }}
                  editLoading={editLoadingId === customer.id}
                  onDelete={() => {
                    if (canDelete) {
                      setDeleteTarget(customer)
                    }
                  }}
                  onView={() => {
                    if (canView) {
                      setViewingCustomerId(customer.id)
                    }
                  }}
                  onToggleDepositWaiver={() => {
                    if (canUpdate) {
                      setDepositWaiverTarget(customer)
                      setDepositWaiverRemark('')
                    }
                  }}
                  onAddPoints={() => {
                    if (canUpdate) {
                      setAdjustPointsTarget(customer)
                      setAdjustPointsAction('add')
                    }
                  }}
                  onReducePoints={() => {
                    if (canUpdate) {
                      setAdjustPointsTarget(customer)
                      setAdjustPointsAction('reduce')
                    }
                  }}
                />
              ))
            ) : (
              <TableEmptyState colSpan={colCount} />
            )}
          </tbody>
        </table>
      </div>

      {editingCustomer !== null && (
        <CustomerEditModal
          customerId={Number(editingCustomer.id)}
          initialCustomer={editingCustomer}
          onClose={() => setEditingCustomer(null)}
          onSuccess={(customer) => {
            setEditingCustomer(null)
            handleCustomerUpdated(customer)
          }}
        />
      )}

      {deleteTarget && (
        <CustomerDeleteModal
          customer={deleteTarget}
          onClose={() => setDeleteTarget(null)}
          onDeleted={(customerId) => {
            setDeleteTarget(null)
            handleCustomerDeleted(customerId)
          }}
        />
      )}

      {viewingCustomerId !== null && (
        <CustomerViewPanel
          customerId={viewingCustomerId}
          onClose={() => setViewingCustomerId(null)}
        />
      )}

      {assigningCustomer && (
        <CustomerAssignVoucherModal
          customer={assigningCustomer}
          onClose={() => setAssigningCustomer(null)}
          onAssigned={() => {
            setAssigningCustomer(null)
            setToastMessage('Voucher assigned successfully.')
            setRefreshToken((prev) => prev + 1)
            setTimeout(() => setToastMessage(null), 2000)
          }}
        />
      )}

      {depositWaiverTarget && (
        <CrmFormModalShell
          title={
            depositWaiverTarget.allowBookingWithoutDeposit
              ? 'Disable No Deposit Booking'
              : 'Enable No Deposit Booking'
          }
          onClose={() => {
            if (!isSavingDepositWaiver) {
              setDepositWaiverTarget(null)
              setDepositWaiverRemark('')
            }
          }}
          closeDisabled={isSavingDepositWaiver}
          footer={
            <>
              <button
                type="button"
                className="rounded border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                onClick={() => {
                  setDepositWaiverTarget(null)
                  setDepositWaiverRemark('')
                }}
                disabled={isSavingDepositWaiver}
              >
                Cancel
              </button>
              <button
                type="button"
                className="rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
                onClick={() => void handleToggleDepositWaiver()}
                disabled={isSavingDepositWaiver}
              >
                {isSavingDepositWaiver ? 'Saving...' : 'Confirm'}
              </button>
            </>
          }
        >
          <div className="space-y-4 px-5 py-4">
            <p className="text-sm text-gray-600">
              Customer: <span className="font-medium text-gray-900">{depositWaiverTarget.name}</span>
            </p>
            <p className="text-sm text-gray-600">
              Current status:{' '}
              <span
                className={`font-semibold ${depositWaiverTarget.allowBookingWithoutDeposit ? 'text-emerald-600' : 'text-gray-700'}`}
              >
                {depositWaiverTarget.allowBookingWithoutDeposit ? 'Enabled' : 'Disabled'}
              </span>
            </p>

            <div>
              <label className="block text-sm font-medium text-gray-700">Remark (optional)</label>
              <textarea
                value={depositWaiverRemark}
                onChange={(event) => setDepositWaiverRemark(event.target.value)}
                rows={3}
                className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm outline-none ring-blue-500 focus:ring"
                placeholder="e.g. VIP customer approved by manager"
              />
            </div>
          </div>
        </CrmFormModalShell>
      )}

      {adjustPointsTarget && (
        <CustomerAdjustPointsModal
          customer={adjustPointsTarget}
          action={adjustPointsAction}
          onClose={() => setAdjustPointsTarget(null)}
          onSuccess={(availablePoints) => {
            handlePointsAdjusted(adjustPointsTarget.id, availablePoints)
            setAdjustPointsTarget(null)
          }}
        />
      )}

      <PaginationControls
        currentPage={currentPage}
        totalPages={totalPages}
        pageSize={pageSize}
        onPageChange={handlePageChange}
        disabled={loading}
      />
    </div>
  )
}
