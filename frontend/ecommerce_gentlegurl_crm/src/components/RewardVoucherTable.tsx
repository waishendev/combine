'use client'

import { useEffect, useState } from 'react'

import PaginationControls from './PaginationControls'
import TableEmptyState from './TableEmptyState'
import TableLoadingRow from './TableLoadingRow'
import RewardVoucherCreateModal from './RewardVoucherCreateModal'
import RewardVoucherDeleteModal from './RewardVoucherDeleteModal'
import RewardVoucherEditModal, { type RewardVoucherRow } from './RewardVoucherEditModal'
import StatusBadge from './StatusBadge'
import { useI18n } from '@/lib/i18n'

type Meta = {
  current_page: number
  last_page: number
  per_page: number
  total: number
}

type RewardApiItem = {
  id: number | string
  title?: string | null
  description?: string | null
  points_required?: number | string | null
  quota_total?: number | string | null
  quota_used?: number | string | null
  is_active?: boolean | number | string | null
  voucher_id?: number | string | null
  voucher?: {
    id?: number | string | null
    code?: string | null
    value?: number | string | null
    min_order_amount?: number | string | null
    start_at?: string | null
    end_at?: string | null
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

interface RewardVoucherTableProps {
  permissions: string[]
}

const toNumber = (value: number | string | null | undefined): number => {
  if (value == null) return 0
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}

const formatCurrency = (value: number | string | null | undefined): string => {
  if (value == null) return '-'
  const num = typeof value === 'string' ? parseFloat(value) : value
  return Number.isFinite(num) ? num.toFixed(2) : '-'
}

const toBoolean = (value: unknown): boolean =>
  value === true || value === 'true' || value === 1 || value === '1'

export default function RewardVoucherTable({ permissions }: RewardVoucherTableProps) {
  const { t } = useI18n()
  const [rows, setRows] = useState<RewardVoucherRow[]>([])
  const [loading, setLoading] = useState(true)
  const [pageSize, setPageSize] = useState(15)
  const [currentPage, setCurrentPage] = useState(1)
  const [meta, setMeta] = useState<Meta>({
    current_page: 1,
    last_page: 1,
    per_page: 15,
    total: 0,
  })
  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [editingReward, setEditingReward] = useState<RewardVoucherRow | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<RewardVoucherRow | null>(null)

  const canCreate = permissions.includes('ecommerce.vouchers.create')
  const canUpdate = permissions.includes('ecommerce.vouchers.update')
  const canDelete = permissions.includes('ecommerce.vouchers.delete')
  const showActions = canUpdate || canDelete

  const fetchRewards = async (signal?: AbortSignal) => {
    setLoading(true)
    try {
      const qs = new URLSearchParams()
      qs.set('page', String(currentPage))
      qs.set('per_page', String(pageSize))
      qs.set('type', 'voucher')

      const res = await fetch(`/api/proxy/ecommerce/loyalty/rewards?${qs.toString()}`, {
        cache: 'no-store',
        signal,
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

      const list: RewardVoucherRow[] = rewardItems
        .map((item) => {
          const voucherId = toNumber(item.voucher_id ?? item.voucher?.id)
          if (!voucherId) return null
          return {
            rewardId: toNumber(item.id),
            voucherId,
            title: item.title ?? '-',
            description: item.description ?? '',
            pointsRequired: toNumber(item.points_required),
            quotaUsed: item.quota_used != null ? toNumber(item.quota_used) : null,
            quotaTotal: item.quota_total != null ? toNumber(item.quota_total) : null,
            isActive: toBoolean(item.is_active),
            code: item.voucher?.code ?? '-',
            value: formatCurrency(item.voucher?.value),
            minOrderAmount: formatCurrency(item.voucher?.min_order_amount),
            startAt: item.voucher?.start_at ?? '',
            endAt: item.voucher?.end_at ?? '',
          }
        })
        .filter(Boolean) as RewardVoucherRow[]

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
      if (!signal?.aborted) {
        setLoading(false)
      }
    }
  }

  useEffect(() => {
    const controller = new AbortController()
    fetchRewards(controller.signal)
    return () => controller.abort()
  }, [currentPage, pageSize])

  const handleRefresh = () => {
    fetchRewards()
  }

  const handlePageSizeChange = (size: number) => {
    setPageSize(size)
    setCurrentPage(1)
  }

  const tableColumns = showActions ? 9 : 8

  const renderQuota = (reward: RewardVoucherRow) => {
    if (reward.quotaTotal == null) return '-'
    const used = reward.quotaUsed ?? 0
    return `${used} / ${reward.quotaTotal}`
  }

  return (
    <div>
      {isCreateOpen && (
        <RewardVoucherCreateModal
          onClose={() => setIsCreateOpen(false)}
          onSuccess={() => {
            setIsCreateOpen(false)
            handleRefresh()
          }}
        />
      )}

      {editingReward && (
        <RewardVoucherEditModal
          reward={editingReward}
          onClose={() => setEditingReward(null)}
          onSuccess={() => {
            setEditingReward(null)
            handleRefresh()
          }}
        />
      )}

      {deleteTarget && (
        <RewardVoucherDeleteModal
          title={deleteTarget.title}
          rewardId={deleteTarget.rewardId}
          voucherId={deleteTarget.voucherId}
          onClose={() => setDeleteTarget(null)}
          onDeleted={() => {
            setDeleteTarget(null)
            handleRefresh()
          }}
        />
      )}

      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <div className="flex flex-wrap items-center gap-2">
          {canCreate && (
            <button
              type="button"
              className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded text-sm flex items-center gap-2"
              onClick={() => setIsCreateOpen(true)}
            >
              <i className="fa-solid fa-plus" />
              Create Reward Voucher
            </button>
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
                  { key: 'pointsRequired', label: 'Points' },
                  { key: 'value', label: 'Value' },
                  { key: 'minOrderAmount', label: 'Min Order Amount' },
                  { key: 'quota', label: 'Quota' },
                  { key: 'startAt', label: 'Start Date' },
                  { key: 'endAt', label: 'End Date' },
                  { key: 'isActive', label: t('common.status') },
                ] as const
              ).map(({ key, label }) => (
                <th
                  key={key}
                  className="px-4 py-2 font-semibold text-left text-gray-600 uppercase tracking-wider"
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
                message="No reward vouchers found."
                actionLabel={canCreate ? 'Create Reward Voucher' : undefined}
                onAction={canCreate ? () => setIsCreateOpen(true) : undefined}
              />
            )}
            {!loading &&
              rows.map((reward) => (
                <tr key={reward.rewardId} className="text-sm">
                  <td className="px-4 py-2 border border-gray-200">{reward.title}</td>
                  <td className="px-4 py-2 border border-gray-200">
                    {reward.pointsRequired}
                  </td>
                  <td className="px-4 py-2 border border-gray-200">{reward.value}</td>
                  <td className="px-4 py-2 border border-gray-200">
                    {reward.minOrderAmount}
                  </td>
                  <td className="px-4 py-2 border border-gray-200">{renderQuota(reward)}</td>
                  <td className="px-4 py-2 border border-gray-200">
                    {reward.startAt || '-'}
                  </td>
                  <td className="px-4 py-2 border border-gray-200">
                    {reward.endAt || '-'}
                  </td>
                  <td className="px-4 py-2 border border-gray-200">
                    <StatusBadge
                      status={reward.isActive ? 'active' : 'inactive'}
                      label={reward.isActive ? t('common.active') : t('common.inactive')}
                    />
                  </td>
                  {showActions && (
                    <td className="px-4 py-2 border border-gray-200">
                      <div className="flex items-center gap-2">
                        {canUpdate && (
                          <button
                            type="button"
                            className="inline-flex h-8 w-8 items-center justify-center rounded bg-blue-600 text-white hover:bg-blue-700"
                            onClick={() => setEditingReward(reward)}
                            aria-label={t('common.edit')}
                            title={t('common.edit')}
                          >
                            <i className="fa-solid fa-pen-to-square" />
                          </button>
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
