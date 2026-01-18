'use client'

import StatusBadge from './StatusBadge'
import { useI18n } from '@/lib/i18n'

export interface VoucherRowData {
  id: number
  code: string
  type: string
  value: string
  maxUses: string
  maxUsesPerCustomer: string
  minOrderAmount: string
  scopeType: string
  startAt: string
  endAt: string
  isActive: boolean
}

interface VoucherRowProps {
  voucher: VoucherRowData
  showActions?: boolean
  canView?: boolean
  canUpdate?: boolean
  canDelete?: boolean
  hideMaxUsesPerCustomer?: boolean
  onView?: (voucher: VoucherRowData) => void
  onEdit?: (voucher: VoucherRowData) => void
  onDelete?: (voucher: VoucherRowData) => void
}

export default function VoucherRow({
  voucher,
  showActions = false,
  canView = false,
  canUpdate = false,
  canDelete = false,
  hideMaxUsesPerCustomer = false,
  onView,
  onEdit,
  onDelete,
}: VoucherRowProps) {
  const { t } = useI18n()
  const scopeLabels: Record<string, string> = {
    all: 'Storewide',
    products: 'Specific Products',
    categories: 'Specific Categories',
  }
  const scopeLabel = scopeLabels[voucher.scopeType] ?? 'Storewide'
  return (
    <tr className="text-sm">
      <td className="px-4 py-2 border border-gray-200">{voucher.code}</td>
      <td className="px-4 py-2 border border-gray-200">{voucher.value}</td>
      <td className="px-4 py-2 border border-gray-200">{voucher.minOrderAmount}</td>
      <td className="px-4 py-2 border border-gray-200">
        <span className="inline-flex rounded-full bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-700">
          {scopeLabel}
        </span>
      </td>
      <td className="px-4 py-2 border border-gray-200">{voucher.maxUses}</td>
      {!hideMaxUsesPerCustomer && (
        <td className="px-4 py-2 border border-gray-200">{voucher.maxUsesPerCustomer}</td>
      )}
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
            {canView && (
              <button
                type="button"
                className="inline-flex h-8 w-8 items-center justify-center rounded bg-slate-600 text-white hover:bg-slate-700"
                onClick={() => onView?.(voucher)}
                aria-label={t('common.view')}
                title={t('common.view')}
              >
                <i className="fa-solid fa-eye" />
              </button>
            )}
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
