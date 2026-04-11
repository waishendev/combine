'use client'

import {
  formatPromotionDateTime,
  type PromotionRowData,
} from './promotionUtils'
import { useI18n } from '@/lib/i18n'

interface PromotionRowProps {
  promotion: PromotionRowData
  showActions: boolean
  canUpdate: boolean
  canDelete: boolean
  canView: boolean
  onView: () => void
  onEdit: () => void
  onDelete: () => void
}

export default function PromotionRow({
  promotion,
  showActions,
  canUpdate,
  canDelete,
  canView,
  onView,
  onEdit,
  onDelete,
}: PromotionRowProps) {
  const { t } = useI18n()

  return (
    <tr className="hover:bg-gray-50">
      <td className="px-4 py-2 text-sm text-left text-gray-900 font-medium">
        {promotion.name}
      </td>
      <td className="px-4 py-2 text-sm text-left text-gray-700">
        {promotion.tierDiscountPreview || '—'}
      </td>
      <td className="px-4 py-2 text-sm text-left text-gray-700">
        {promotion.triggerType}
      </td>
      <td className="px-4 py-2 text-sm text-left">
        <span
          className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
            promotion.isActive
              ? 'bg-emerald-100 text-emerald-700'
              : 'bg-gray-100 text-gray-600'
          }`}
        >
          {promotion.isActive ? t('common.active') : t('common.inactive')}
        </span>
      </td>
      <td className="px-4 py-2 text-sm text-gray-700 text-left">
        {promotion.productCount}
      </td>
      <td className="px-4 py-2 text-sm text-gray-700 text-left">
        {promotion.tierCount}
      </td>
      <td className="px-4 py-2 text-sm text-gray-700 text-left">
        {formatPromotionDateTime(promotion.createdAt)}
      </td>
      {showActions && (
        <td className="px-4 py-2 text-sm text-left">
          <div className="flex items-center justify-start gap-2">
            {canView && (
              <button
                type="button"
                className="inline-flex h-8 w-8 items-center justify-center rounded bg-slate-600 text-white hover:bg-slate-700"
                onClick={onView}
                aria-label={t('customer.viewAction')}
                title={t('customer.viewAction')}
              >
                <i className="fa-solid fa-eye" />
              </button>
            )}
            {canUpdate && (
              <button
                type="button"
                className="inline-flex h-8 w-8 items-center justify-center rounded bg-blue-600 text-white hover:bg-blue-700"
                onClick={onEdit}
                aria-label={t('admin.editAction')}
                title={t('admin.editAction')}
              >
                <i className="fa-solid fa-pen-to-square" />
              </button>
            )}
            {canDelete && (
              <button
                type="button"
                className="inline-flex h-8 w-8 items-center justify-center rounded bg-red-600 text-white hover:bg-red-700"
                onClick={onDelete}
                aria-label={t('admin.deleteAction')}
                title={t('admin.deleteAction')}
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
