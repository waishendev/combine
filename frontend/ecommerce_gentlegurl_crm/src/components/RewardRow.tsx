'use client'

import StatusBadge from './StatusBadge'
import { useI18n } from '@/lib/i18n'

export interface RewardRowData {
  id: number
  title: string
  description: string
  type: string
  pointsRequired: number
  productId: number | null
  voucherId: number | null
  quotaTotal: number | null
  quotaUsed: number | null
  isActive: boolean
  sortOrder: number | null
  productName: string | null
  productSku: string | null
  voucherCode: string | null
}

interface RewardRowProps {
  reward: RewardRowData
  showActions?: boolean
  canUpdate?: boolean
  canDelete?: boolean
  onEdit?: (reward: RewardRowData) => void
  onDelete?: (reward: RewardRowData) => void
}

const formatType = (type: string) => {
  if (!type) return '-'
  return type.charAt(0).toUpperCase() + type.slice(1)
}

const resolveRewardItem = (reward: RewardRowData) => {
  if (reward.type === 'product') {
    if (reward.productName) {
      return reward.productSku
        ? `${reward.productName} (${reward.productSku})`
        : reward.productName
    }
    return reward.productId ? `Product #${reward.productId}` : '-'
  }

  if (reward.type === 'voucher') {
    if (reward.voucherCode) return reward.voucherCode
    return reward.voucherId ? `Voucher #${reward.voucherId}` : '-'
  }

  return '-'
}

export default function RewardRow({
  reward,
  showActions = false,
  canUpdate = false,
  canDelete = false,
  onEdit,
  onDelete,
}: RewardRowProps) {
  const { t } = useI18n()
  const quotaDisplay =
    reward.quotaTotal != null
      ? `${reward.quotaUsed ?? 0} / ${reward.quotaTotal}`
      : '-'

  return (
    <tr className="text-sm">
      <td className="px-4 py-2 border border-gray-200">{reward.title}</td>
      <td className="px-4 py-2 border border-gray-200">{formatType(reward.type)}</td>
      <td className="px-4 py-2 border border-gray-200">{resolveRewardItem(reward)}</td>
      <td className="px-4 py-2 border border-gray-200">{reward.pointsRequired}</td>
      <td className="px-4 py-2 border border-gray-200">{quotaDisplay}</td>
      <td className="px-4 py-2 border border-gray-200">
        <StatusBadge
          status={reward.isActive ? 'active' : 'inactive'}
          label={reward.isActive ? t('common.active') : t('common.inactive')}
        />
      </td>
      <td className="px-4 py-2 border border-gray-200">
        {reward.sortOrder ?? '-'}
      </td>
      {showActions && (
        <td className="px-4 py-2 border border-gray-200">
          <div className="flex items-center gap-2">
            {canUpdate && (
              <button
                type="button"
                className="inline-flex h-8 w-8 items-center justify-center rounded bg-blue-600 text-white hover:bg-blue-700"
                onClick={() => onEdit?.(reward)}
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
                onClick={() => onDelete?.(reward)}
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
  )
}
