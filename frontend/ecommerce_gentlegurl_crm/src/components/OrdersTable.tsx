'use client'

import { useEffect, useMemo, useState } from 'react'

import OrderFiltersWrapper from './OrderFiltersWrapper'
import TableEmptyState from './TableEmptyState'
import TableLoadingRow from './TableLoadingRow'
import PaginationControls from './PaginationControls'
import OrderRow, { OrderRowData } from './OrderRow'
import {
  OrderFilterValues,
  emptyOrderFilters,
} from './OrderFilters'
import OrderViewPanel from './OrderViewPanel'
import {
  type OrderApiItem,
  mapOrderApiItemToRow,
  convertOrderDetailToApiItem,
  mapDisplayStatusToApiFilters,
} from './orderUtils'
import { useI18n } from '@/lib/i18n'

interface OrdersTableProps {
  permissions: string[]
  initialStatusFilters?: {
    status?: string[]
    payment_status?: string[]
  }
  allowedStatusOptions?: string[]
}

type Meta = {
  current_page: number
  last_page: number
  per_page: number
  total: number
}

type OrderApiResponse = {
  data?: OrderApiItem[] | {
    current_page?: number
    data?: OrderApiItem[]
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

export default function OrdersTable({
  permissions,
  initialStatusFilters,
  allowedStatusOptions,
}: OrdersTableProps) {
  const { t } = useI18n()
  const [isFilterModalOpen, setIsFilterModalOpen] = useState(false)
  const [inputs, setInputs] = useState<OrderFilterValues>({ ...emptyOrderFilters })
  const [filters, setFilters] = useState<OrderFilterValues>({ ...emptyOrderFilters })
  const [rows, setRows] = useState<OrderRowData[]>([])
  const [pageSize, setPageSize] = useState(15)
  const [currentPage, setCurrentPage] = useState(1)
  const [sortColumn, setSortColumn] = useState<keyof OrderRowData | null>(
    'createdAt',
  )
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc' | null>(
    'desc',
  )
  const [viewingOrderId, setViewingOrderId] = useState<number | null>(null)
  const [refreshTrigger, setRefreshTrigger] = useState(0)

  const canView = permissions.includes('ecommerce.orders.view')
  const showActions = canView

  const [meta, setMeta] = useState<Meta>({
    current_page: 1,
    last_page: 1,
    per_page: 15,
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
    const fetchOrders = async () => {
      setLoading(true)
      try {
        const qs = new URLSearchParams()
        qs.set('page', String(currentPage))
        qs.set('per_page', String(pageSize))
        if (filters.orderNo) qs.set('order_no', filters.orderNo)
        if (filters.customerName) qs.set('customer_name', filters.customerName)
        if (filters.customerEmail) qs.set('customer_email', filters.customerEmail)
        
        // Apply filters: user filters take precedence over initial filters
        if (filters.status) {
          // Map display status to API filter parameters
          const apiFilters = mapDisplayStatusToApiFilters(filters.status)
          if (apiFilters.status) {
            // Pass as array - convert single value to array
            const statusArray = Array.isArray(apiFilters.status) 
              ? apiFilters.status 
              : [apiFilters.status]
            statusArray.forEach(status => qs.append('status[]', status))
          }
          if (apiFilters.payment_status) {
            // Pass as array - convert single value to array
            const paymentStatusArray = Array.isArray(apiFilters.payment_status)
              ? apiFilters.payment_status
              : [apiFilters.payment_status]
            paymentStatusArray.forEach(paymentStatus => qs.append('payment_status[]', paymentStatus))
          }
        } else if (initialStatusFilters) {
          // Use initial filters when no user filter is applied
          if (initialStatusFilters.status && initialStatusFilters.status.length > 0) {
            initialStatusFilters.status.forEach(status => qs.append('status[]', status))
          }
          if (initialStatusFilters.payment_status && initialStatusFilters.payment_status.length > 0) {
            initialStatusFilters.payment_status.forEach(paymentStatus => qs.append('payment_status[]', paymentStatus))
          }
        }

        const res = await fetch(`/api/proxy/ecommerce/orders?${qs.toString()}`, {
          cache: 'no-store',
          signal: controller.signal,
        })

        if (!res.ok) {
          setRows([])
          setMeta((prev) => ({ ...prev, total: 0 }))
          return
        }

        const response: OrderApiResponse = await res
          .json()
          .catch(() => ({} as OrderApiResponse))
        if (response?.success === false && response?.message === 'Unauthorized') {
          window.location.replace('/dashboard')
          return
        }

        // Handle nested data structure: { data: { data: [...], current_page: 1, ... } }
        let orderItems: OrderApiItem[] = []
        let paginationData: Partial<Meta> = {}

        if (response?.data) {
          if (Array.isArray(response.data)) {
            // Direct array format
            orderItems = response.data
          } else if (typeof response.data === 'object' && 'data' in response.data) {
            // Nested format: { data: { data: [...], current_page: 1, ... } }
            const nestedData = response.data as {
              data?: OrderApiItem[]
              current_page?: number
              last_page?: number
              per_page?: number
              total?: number
            }
            orderItems = Array.isArray(nestedData.data) ? nestedData.data : []
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

        const list: OrderRowData[] = orderItems.map((item) => mapOrderApiItemToRow(item))

        // No need for client-side status filtering since we're filtering via API
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

    fetchOrders()
    return () => controller.abort()
  }, [filters, currentPage, pageSize, refreshTrigger])

  const handleSort = (column: keyof OrderRowData) => {
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

    const compare = (a: OrderRowData, b: OrderRowData) => {
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

  const handleFilterChange = (values: OrderFilterValues) => {
    setInputs(values)
  }

  const handleFilterSubmit = (values: OrderFilterValues) => {
    setFilters(values)
    setInputs(values)
    setCurrentPage(1)
  }

  const handleFilterReset = () => {
    setInputs({ ...emptyOrderFilters })
    setFilters({ ...emptyOrderFilters })
    setCurrentPage(1)
  }

  const handleBadgeRemove = (field: keyof OrderFilterValues) => {
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

  const handleManualRefresh = () => {
    setRefreshTrigger((prev) => prev + 1)
  }

  const handleOrderUpdated = (updatedOrder?: {
    id: number
    order_no?: string
    order_number?: string
    status?: string
    payment_status?: string
    grand_total?: string | number
    refund_total?: string | number
    shipping_method?: string
    created_at?: string
    updated_at?: string
    customer?: {
      id?: number
      name?: string
      email?: string
    }
  }) => {
    if (!updatedOrder) {
      // If no order data provided, do a full refresh
      setRefreshTrigger((prev) => prev + 1)
      return
    }

    // Convert OrderDetailData to OrderApiItem and update the specific order in the table
    const apiItem = convertOrderDetailToApiItem(updatedOrder)
    setRows((prevRows) => {
      const updatedRows = prevRows.map((row) => {
        if (row.id === updatedOrder.id) {
          // Map the updated order API item to row data
          return mapOrderApiItemToRow(apiItem)
        }
        return row
      })
      return updatedRows
    })
  }

  const colCount = showActions ? 6 : 5

  const totalPages = meta.last_page || 1

  const activeFilters = useMemo(() => {
    return (Object.entries(filters) as [keyof OrderFilterValues, string][]) 
      .filter(([, value]) => Boolean(value))
  }, [filters])

  const filterLabels: Record<keyof OrderFilterValues, string> = {
    orderNo: 'Order Number',
    customerName: 'Customer Name',
    customerEmail: 'Customer Email',
    status: 'Status',
  }

  const renderFilterValue = (key: keyof OrderFilterValues, value: string) => {
    return value
  }

  return (
    <div>
      {isFilterModalOpen && (
        <OrderFiltersWrapper
          inputs={inputs}
          onChange={handleFilterChange}
          onSubmit={handleFilterSubmit}
          onReset={handleFilterReset}
          onClose={() => setIsFilterModalOpen(false)}
          disabled={loading}
          allowedStatusOptions={allowedStatusOptions}
        />
      )}

      <div className="flex justify-between items-center mb-6 flex-wrap gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <button
            className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded text-sm flex items-center gap-2 disabled:opacity-50"
            onClick={() => setIsFilterModalOpen(true)}
            disabled={loading}
          >
            <i className="fa-solid fa-filter" />
            {t('common.filter')}
          </button>
          <button
            className="bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded text-sm flex items-center gap-2 disabled:opacity-50"
            onClick={handleManualRefresh}
            disabled={loading}
            title="Refresh orders"
          >
            <i className={`fa-solid ${loading ? 'fa-spinner fa-spin' : 'fa-arrow-rotate-right'}`} />
            Refresh
          </button>
        </div>

        <div className="flex items-center gap-3">
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
            {[15, 50, 100, 150, 200].map((size) => (
              <option key={size} value={size}>
                {size}
              </option>
            ))}
          </select>
        </div>
      </div>

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
                  { key: 'orderNo', label: 'Order Number' },
                  { key: 'customerName', label: 'Customer' },
                  { key: 'status', label: 'Status' },
                  { key: 'grandTotal', label: 'Total' },
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
              sortedRows.map((order) => (
                <OrderRow
                  key={order.id}
                  order={order}
                  showActions={showActions}
                  canView={canView}
                  onView={() => {
                    if (canView) {
                      setViewingOrderId(order.id)
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

      {viewingOrderId !== null && (
        <OrderViewPanel
          orderId={viewingOrderId}
          onClose={() => setViewingOrderId(null)}
          onOrderUpdated={handleOrderUpdated}
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
