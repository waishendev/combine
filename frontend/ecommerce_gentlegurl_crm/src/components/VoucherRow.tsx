'use client'

import StatusBadge from './StatusBadge'
import { useI18n } from '@/lib/i18n'

export interface VoucherRowData {
  id: number
  code: string
  type: string
  amount: string
  maxUses: string
  maxUsesPerCustomer: string
  minOrderAmount: string
  startAt: string
  endAt: string
  isActive: boolean
}

interface VoucherRowProps {
  voucher: VoucherRowData
  showActions?: boolean
  canUpdate?: boolean
  canDelete?: boolean
  onEdit?: (voucher: VoucherRowData) => void
  onDelete?: (voucher: VoucherRowData) => void
}

export default function VoucherRow({
  voucher,
  showActions = false,
  canUpdate = false,
  canDelete = false,
  onEdit,
  onDelete,
}: VoucherRowProps) {
  const { t } = useI18n()
  return (
    <tr className="text-sm">
      <td className="px-4 py-2 border border-gray-200">{voucher.code}</td>
      <td className="px-4 py-2 border border-gray-200">{voucher.amount}</td>
      <td className="px-4 py-2 border border-gray-200">{voucher.minOrderAmount}</td>
      <td className="px-4 py-2 border border-gray-200">{voucher.maxUses}</td>
      <td className="px-4 py-2 border border-gray-200">{voucher.maxUsesPerCustomer}</td>
      <td className="px-4 py-2 border border-gray-200">{voucher.startAt || '-'}</td>
      <td className="px-4 py-2 border border-gray-200">{voucher.endAt || '-'}</td>
      <td className="px-4 py-2 border border-gray-200">
        <StatusBadge
          status={voucher.isActive ? 'active' : 'inactive'}
          label={voucher.isActive ? t('common.active') : t('common.inactive')}
        />
      </td>
      {showActions && (
        <td className="px-4 py-2 border border-gray-200">
          <div className="flex items-center gap-2">
            {canUpdate && (
              <button
                type="button"
                className="inline-flex h-8 w-8 items-center justify-center rounded bg-blue-600 text-white hover:bg-blue-700"
                onClick={() => onEdit?.(voucher)}
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
                onClick={() => onDelete?.(voucher)}
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
