'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'

import PaginationControls from './PaginationControls'
import TableEmptyState from './TableEmptyState'
import TableLoadingRow from './TableLoadingRow'
import RewardProductDeleteModal from './RewardProductDeleteModal'
import StatusBadge from './StatusBadge'
import { useI18n } from '@/lib/i18n'

type RewardProductRow = {
  id: number
  title: string
  pointsRequired: number
  isActive: boolean
  productId: number
  productName: string
  productStock: number
}

type Meta = {
  current_page: number
  last_page: number
  per_page: number
  total: number
}

type RewardApiItem = {
  id: number | string
  title?: string | null
  points_required?: number | string | null
  is_active?: boolean | number | string | null
  product_id?: number | string | null
  product?: {
    id?: number | string | null
    name?: string | null
    stock?: number | string | null
  } | null
}

type RewardApiResponse = {
  data?: RewardApiItem[] | {
    current_page?: number
    data?: RewardApiItem[]
    last_page?: number
    per_page?: number
    total?: number
  }
  meta?: Partial<Meta>
  success?: boolean
  message?: string
}

interface RewardProductTableProps {
  permissions: string[]
}

const toNumber = (value: number | string | null | undefined): number => {
  if (value == null) return 0
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}

const toBoolean = (value: unknown): boolean =>
  value === true || value === 'true' || value === 1 || value === '1'

export default function RewardProductTable({ permissions }: RewardProductTableProps) {
  const { t } = useI18n()
  const router = useRouter()
  const [rows, setRows] = useState<RewardProductRow[]>([])
  const [loading, setLoading] = useState(true)
  const [pageSize, setPageSize] = useState(15)
  const [currentPage, setCurrentPage] = useState(1)
  const [meta, setMeta] = useState<Meta>({
    current_page: 1,
    last_page: 1,
    per_page: 15,
    total: 0,
  })
  const [deleteTarget, setDeleteTarget] = useState<RewardProductRow | null>(null)

  const canCreate = permissions.includes('ecommerce.products.create')
  const canUpdate = permissions.includes('ecommerce.products.update')
  const canDelete = permissions.includes('ecommerce.products.delete')
  const showActions = canUpdate || canDelete

  useEffect(() => {
    const controller = new AbortController()

    const fetchRewards = async () => {
      setLoading(true)
      try {
        const qs = new URLSearchParams()
        qs.set('page', String(currentPage))
        qs.set('per_page', String(pageSize))
        qs.set('type', 'product')

        const res = await fetch(`/api/proxy/ecommerce/loyalty/rewards?${qs.toString()}`, {
          cache: 'no-store',
          signal: controller.signal,
        })

        if (!res.ok) {
          setRows([])
          setMeta((prev) => ({ ...prev, total: 0 }))
          return
        }

        const response: RewardApiResponse = await res.json().catch(() => ({} as RewardApiResponse))
        if (response?.success === false && response?.message === 'Unauthorized') {
          window.location.replace('/dashboard')
          return
        }

        let rewardItems: RewardApiItem[] = []
        let paginationData: Partial<Meta> = {}

        if (response?.data) {
          if (Array.isArray(response.data)) {
            rewardItems = response.data
          } else if (typeof response.data === 'object' && 'data' in response.data) {
            const nestedData = response.data as {
              data?: RewardApiItem[]
              current_page?: number
              last_page?: number
              per_page?: number
              total?: number
            }
            rewardItems = Array.isArray(nestedData.data) ? nestedData.data : []
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

        const list: RewardProductRow[] = rewardItems
          .map((item) => {
            const productId = toNumber(item.product_id)
            if (!productId) return null
            return {
              id: toNumber(item.id),
              title: item.title ?? '-',
              pointsRequired: toNumber(item.points_required),
              isActive: toBoolean(item.is_active),
              productId,
              productName: item.product?.name ?? `Product #${productId}`,
              productStock: toNumber(item.product?.stock),
            }
          })
          .filter(Boolean) as RewardProductRow[]

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

    fetchRewards()
    return () => controller.abort()
  }, [currentPage, pageSize])

  const handlePageSizeChange = (size: number) => {
    setPageSize(size)
    setCurrentPage(1)
  }

  const tableColumns = showActions ? 6 : 5

  return (
    <div>
      {deleteTarget && (
        <RewardProductDeleteModal
          title={deleteTarget.title}
          rewardId={deleteTarget.id}
          productId={deleteTarget.productId}
          onClose={() => setDeleteTarget(null)}
          onDeleted={() => {
            setDeleteTarget(null)
            setRows((prev) => prev.filter((item) => item.id !== deleteTarget.id))
          }}
        />
      )}

      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <div className="flex flex-wrap items-center gap-2">
          {canCreate && (
            <Link
              href="/rewards/products/create"
              className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded text-sm flex items-center gap-2"
            >
              <i className="fa-solid fa-plus" />
              Create Reward Product
            </Link>
          )}
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
            {[15, 25, 50, 100].map((size) => (
              <option key={size} value={size}>
                {size}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="bg-white shadow rounded-lg overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200 text-sm">
          <thead className="bg-slate-300/70">
            <tr>
              {(
                [
                  { key: 'title', label: 'Title' },
                  { key: 'productName', label: 'Product' },
                  { key: 'pointsRequired', label: 'Points' },
                  { key: 'isActive', label: t('common.status') },
                  { key: 'productStock', label: 'Stock' },
                ] as const
              ).map(({ key, label }) => (
                <th
                  key={key}
                  className="px-4 py-2 font-semibold text-left text-gray-600 tracking-wider"
                >
                  <span>{label}</span>
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
            {loading && <TableLoadingRow colSpan={tableColumns} />}
            {!loading && rows.length === 0 && (
              <TableEmptyState
                colSpan={tableColumns}
                message="No reward products found."
                actionLabel={canCreate ? 'Create Reward Product' : undefined}
                onAction={canCreate ? () => router.push('/rewards/products/create') : undefined}
              />
            )}
            {!loading &&
              rows.map((reward) => (
                <tr key={reward.id} className="text-sm">
                  <td className="px-4 py-2 border border-gray-200">{reward.title}</td>
                  <td className="px-4 py-2 border border-gray-200">{reward.productName}</td>
                  <td className="px-4 py-2 border border-gray-200">
                    {reward.pointsRequired}
                  </td>
                  <td className="px-4 py-2 border border-gray-200">
                    <StatusBadge
                      status={reward.isActive ? 'active' : 'inactive'}
                      label={reward.isActive ? t('common.active') : t('common.inactive')}
                    />
                  </td>
                  <td className="px-4 py-2 border border-gray-200">{reward.productStock}</td>
                  {showActions && (
                    <td className="px-4 py-2 border border-gray-200">
                      <div className="flex items-center gap-2">
                        {canUpdate && (
                          <Link
                            href={`/rewards/products/${reward.productId}/edit`}
                            className="inline-flex h-8 w-8 items-center justify-center rounded bg-blue-600 text-white hover:bg-blue-700"
                            aria-label={t('common.edit')}
                            title={t('common.edit')}
                          >
                            <i className="fa-solid fa-pen-to-square" />
                          </Link>
                        )}
                        {canDelete && (
                          <button
                            type="button"
                            className="inline-flex h-8 w-8 items-center justify-center rounded bg-red-600 text-white hover:bg-red-700"
                            onClick={() => setDeleteTarget(reward)}
                            aria-label={t('common.delete')}
                            title={t('common.delete')}
                          >
                            <i className="fa-solid fa-trash" />
                          </button>
                        )}
                      </div>
                    </td>
                  )}
                </tr>
              ))}
          </tbody>
        </table>
      </div>

      <PaginationControls
        currentPage={meta.current_page}
        totalPages={meta.last_page}
        pageSize={meta.per_page}
        onPageChange={setCurrentPage}
        disabled={loading}
      />
    </div>
  )
}
