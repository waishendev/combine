'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useMemo, useState } from 'react'

import TableEmptyState from './TableEmptyState'
import TableLoadingRow from './TableLoadingRow'
import PaginationControls from './PaginationControls'
import ProductRow, { type ProductRowData } from './ProductRow'
import { ProductFilterValues, emptyProductFilters } from './ProductFilters'
import ProductFiltersWrapper from './ProductFiltersWrapper'
import { mapProductApiItemToRow, type ProductApiItem } from './productUtils'
import { useI18n } from '@/lib/i18n'

interface ProductTableProps {
  permissions: string[]
  basePath?: string
  rewardOnlyFilter?: boolean | null
  showCategories?: boolean
}

type Meta = {
  current_page: number
  last_page: number
  per_page: number
  total: number
}

type ProductApiResponse = {
  data?: ProductApiItem[] | {
    current_page?: number
    data?: ProductApiItem[]
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

export default function ProductTable({
  permissions,
  basePath = '/product',
  rewardOnlyFilter = null,
  showCategories = true,
}: ProductTableProps) {
  const { t } = useI18n()
  const [isFilterModalOpen, setIsFilterModalOpen] = useState(false)
  const [inputs, setInputs] = useState<ProductFilterValues>({ ...emptyProductFilters })
  const [filters, setFilters] = useState<ProductFilterValues>({ ...emptyProductFilters })
  const [rows, setRows] = useState<ProductRowData[]>([])
  const [pageSize, setPageSize] = useState(50)
  const [currentPage, setCurrentPage] = useState(1)
  const [sortColumn, setSortColumn] = useState<keyof ProductRowData | null>('name')
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc' | null>('asc')
  const [meta, setMeta] = useState<Meta>({
    current_page: 1,
    last_page: 1,
    per_page: 50,
    total: 0,
  })
  const [loading, setLoading] = useState(true)

  const router = useRouter()
  const canCreate = permissions.includes('ecommerce.products.create')
  const canUpdate = permissions.includes('ecommerce.products.update')
  const canDelete = permissions.includes('ecommerce.products.delete')
  const showActions = canUpdate || canDelete

  useEffect(() => {
    const controller = new AbortController()
    const fetchProducts = async () => {
      setLoading(true)
      try {
        const qs = new URLSearchParams()
        qs.set('page', String(currentPage))
        qs.set('per_page', String(pageSize))
        if (filters.search) qs.set('name', filters.search)
        if (filters.sku) qs.set('sku', filters.sku)
        if (filters.status) {
          qs.set('is_active', filters.status === 'active' ? 'true' : 'false')
        }
        if (rewardOnlyFilter !== null) {
          qs.set('is_reward_only', rewardOnlyFilter ? 'true' : 'false')
        }

        const res = await fetch(`/api/proxy/ecommerce/products?${qs.toString()}`, {
          cache: 'no-store',
          signal: controller.signal,
        })

        if (!res.ok) {
          setRows([])
          setMeta((prev) => ({ ...prev, total: 0 }))
          return
        }

        const response: ProductApiResponse = await res.json().catch(() => ({} as ProductApiResponse))
        if (response?.success === false && response?.message === 'Unauthorized') {
          window.location.replace('/dashboard')
          return
        }

        let productItems: ProductApiItem[] = []
        let paginationData: Partial<Meta> = {}

        if (response?.data) {
          if (Array.isArray(response.data)) {
            productItems = response.data
          } else if (typeof response.data === 'object' && 'data' in response.data) {
            const nestedData = response.data as {
              data?: ProductApiItem[]
              current_page?: number
              last_page?: number
              per_page?: number
              total?: number
            }
            productItems = Array.isArray(nestedData.data) ? nestedData.data : []
            paginationData = {
              current_page: nestedData.current_page,
              last_page: nestedData.last_page,
              per_page: nestedData.per_page,
              total: nestedData.total,
            }
          }
        }

        if (response?.meta) {
          paginationData = { ...paginationData, ...response.meta }
        }

        const list = productItems.map((item) => mapProductApiItemToRow(item))

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

    fetchProducts()
    return () => controller.abort()
  }, [filters, currentPage, pageSize, rewardOnlyFilter])

  const handleSort = (column: keyof ProductRowData) => {
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

    const compare = (a: ProductRowData, b: ProductRowData) => {
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

  const handleFilterChange = (values: ProductFilterValues) => {
    setInputs(values)
  }

  const handleFilterSubmit = (values: ProductFilterValues) => {
    setFilters(values)
    setInputs(values)
    setCurrentPage(1)
  }

  const handleFilterReset = () => {
    setInputs({ ...emptyProductFilters })
    setFilters({ ...emptyProductFilters })
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

  const columns = [
    { key: 'name', label: 'Product' },
    { key: 'sku', label: 'SKU' },
    ...(showCategories ? [{ key: 'categories', label: 'Categories' } as const] : []),
    { key: 'price', label: 'Price' },
    { key: 'stock', label: 'Stock' },
    { key: 'isActive', label: t('common.status') },
  ] as const
  const colCount = columns.length + (showActions ? 1 : 0)

  const totalPages = meta.last_page || 1

  const handleDelete = async (product: ProductRowData) => {
    const confirmed = window.confirm(`Delete ${product.name}?`)
    if (!confirmed) return

    try {
      const res = await fetch(`/api/proxy/ecommerce/products/${product.id}`, {
        method: 'DELETE',
      })

      if (!res.ok) {
        return
      }

      setRows((prev) => prev.filter((item) => item.id !== product.id))
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
    } catch (error) {
      console.error(error)
    }
  }

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

  return (
    <div>
      {isFilterModalOpen && (
        <ProductFiltersWrapper
          inputs={inputs}
          onChange={handleFilterChange}
          onSubmit={handleFilterSubmit}
          onReset={handleFilterReset}
          onClose={() => setIsFilterModalOpen(false)}
          disabled={loading}
        />
      )}

      <div className="flex justify-between items-center mb-6 flex-wrap gap-2">
        <div className="flex flex-wrap items-center gap-2">
          {canCreate && (
            <Link
              className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded text-sm flex items-center gap-2"
              href={`${basePath}/create`}
            >
              <i className="fa-solid fa-plus" />
              {t('common.create')}
            </Link>
          )}

          <button
            className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded text-sm flex items-center gap-2 disabled:opacity-50"
            onClick={() => setIsFilterModalOpen(true)}
            disabled={loading}
          >
            <i className="fa-solid fa-filter" />
            {t('common.filter')}
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
            {[50, 100, 150, 200].map((size) => (
              <option key={size} value={size}>
                {size}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="bg-white shadow rounded-lg overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200 text-sm">
          <thead className="bg-slate-300/70">
            <tr>
              {columns.map(({ key, label }) => (
                <th
                  key={key}
                  className="px-4 py-2 font-semibold text-left text-gray-600 uppercase tracking-wider"
                >
                  <button
                    type="button"
                    className="flex items-center gap-1"
                    onClick={() => handleSort(key as keyof ProductRowData)}
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
                sortedRows.map((product) => (
                  <ProductRow
                  key={product.id}
                  product={product}
                  hideCategories={!showCategories}
                  showActions={showActions}
                  canUpdate={canUpdate}
                  canDelete={canDelete}
                  onEdit={() => {
                    if (canUpdate) {
                      router.push(`${basePath}/${product.id}/edit`)
                    }
                  }}
                  onDelete={() => {
                    if (canDelete) {
                      handleDelete(product)
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
