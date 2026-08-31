'use client'

import StatusBadge from './StatusBadge'
import { useI18n } from '@/lib/i18n'
import type { GatewayGroup, WorkspaceType } from './billplzPaymentOptionUtils'

export interface BillplzPaymentOptionRowData {
  id: number
  type: WorkspaceType
  gateway_group: GatewayGroup
  code: string
  name: string
  logo_url: string | null
  description: string | null
  isActive: boolean
  isDefault: boolean
  sort_order: number | null
  createdAt: string
  updatedAt: string
}

interface BillplzPaymentOptionRowProps {
  option: BillplzPaymentOptionRowData
  showActions?: boolean
  canUpdate?: boolean
  canDelete?: boolean
  canMove?: boolean
  isFirst?: boolean
  isLast?: boolean
  onEdit?: (option: BillplzPaymentOptionRowData) => void
  onDelete?: (option: BillplzPaymentOptionRowData) => void
  onMoveUp?: (option: BillplzPaymentOptionRowData) => void
  onMoveDown?: (option: BillplzPaymentOptionRowData) => void
}

const groupLabel: Record<GatewayGroup, string> = {
  online_banking: 'Online Banking',
  credit_card: 'Credit Card',
}

export default function BillplzPaymentOptionRow({
  option,
  showActions = false,
  canUpdate = false,
  canDelete = false,
  canMove = false,
  isFirst = false,
  isLast = false,
  onEdit,
  onDelete,
  onMoveUp,
  onMoveDown,
}: BillplzPaymentOptionRowProps) {
  const { t } = useI18n()

  return (
    <tr className="text-sm">
      <td className="px-4 py-2 border border-gray-200">
        {option.logo_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={option.logo_url} alt="" className="h-9 w-9 object-contain" />
        ) : (
          <span className="text-xs text-gray-400">—</span>
        )}
      </td>
      <td className="px-4 py-2 border border-gray-200">{groupLabel[option.gateway_group]}</td>
      <td className="px-4 py-2 border border-gray-200 font-mono text-xs">{option.code}</td>
      <td className="px-4 py-2 border border-gray-200">{option.name}</td>
      <td className="px-4 py-2 border border-gray-200">
        <StatusBadge
          status={option.isActive ? 'active' : 'inactive'}
          label={option.isActive ? t('common.active') : t('common.inactive')}
        />
      </td>
      <td className="px-4 py-2 border border-gray-200">
        {option.isDefault ? (
          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
            Default
          </span>
        ) : (
          '-'
        )}
      </td>
      <td className="px-4 py-2 border border-gray-200">
        {canMove ? (
          <div className="flex items-center gap-3 justify-left">
            <button
              type="button"
              className="inline-flex h-7 w-7 items-center justify-center rounded bg-blue-500 text-white hover:bg-blue-600 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              onClick={() => onMoveUp?.(option)}
              disabled={isFirst}
              aria-label="Move up"
              title="Move up"
            >
              <i className="fa-solid fa-chevron-up text-xs" />
            </button>
            <span className="text-sm font-medium text-gray-700 bg-gray-50 text-center min-w-[2rem]">
              {option.sort_order != null ? option.sort_order : '-'}
            </span>
            <button
              type="button"
              className="inline-flex h-7 w-7 items-center justify-center rounded bg-blue-500 text-white hover:bg-blue-600 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              onClick={() => onMoveDown?.(option)}
              disabled={isLast}
              aria-label="Move down"
              title="Move down"
            >
              <i className="fa-solid fa-chevron-down text-xs" />
            </button>
          </div>
        ) : (
          <span>{option.sort_order != null ? option.sort_order : '-'}</span>
        )}
      </td>
      {showActions && (
        <td className="px-4 py-2 border border-gray-200">
          <div className="flex items-center gap-2">
            {canUpdate && (
              <button
                type="button"
                className="inline-flex h-8 w-8 items-center justify-center rounded bg-blue-600 text-white hover:bg-blue-700"
                onClick={() => onEdit?.(option)}
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
                onClick={() => onDelete?.(option)}
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
