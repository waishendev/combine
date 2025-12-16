'use client'

import StatusBadge from './StatusBadge'
import { useI18n } from '@/lib/i18n'

export interface SliderRowData {
  id: number
  title: string
  subtitle: string
  image_path: string
  mobile_image_path: string
  button_label: string
  button_link: string
  start_at: string
  end_at: string
  isActive: boolean
  sort_order: number | null
  createdAt: string
  updatedAt: string
}

interface SliderRowProps {
  slider: SliderRowData
  showActions?: boolean
  canUpdate?: boolean
  canDelete?: boolean
  canMove?: boolean
  isFirst?: boolean
  isLast?: boolean
  onEdit?: (slider: SliderRowData) => void
  onDelete?: (slider: SliderRowData) => void
  onMoveUp?: (slider: SliderRowData) => void
  onMoveDown?: (slider: SliderRowData) => void
}

export default function SliderRow({
  slider,
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
}: SliderRowProps) {
  const { t } = useI18n()
  
  const formatDate = (dateString: string) => {
    if (!dateString) return '-'
    try {
      const date = new Date(dateString)
      return date.toLocaleDateString()
    } catch {
      return dateString
    }
  }

  return (
    <tr className="text-sm">
      <td className="px-4 py-2 border border-gray-200">{slider.title}</td>
      <td className="px-4 py-2 border border-gray-200">{slider.subtitle}</td>
      <td className="px-4 py-2 border border-gray-200">
        {slider.image_path ? (
          <img 
            src={slider.image_path} 
            alt={slider.title}
            className="h-12 w-auto object-contain"
          />
        ) : (
          '-'
        )}
      </td>
      <td className="px-4 py-2 border border-gray-200">{slider.button_label}</td>
      <td className="px-4 py-2 border border-gray-200">{formatDate(slider.start_at)}</td>
      <td className="px-4 py-2 border border-gray-200">{formatDate(slider.end_at)}</td>
      <td className="px-4 py-2 border border-gray-200">
        <StatusBadge
          status={slider.isActive ? 'active' : 'inactive'}
          label={slider.isActive ? t('common.active') : t('common.inactive')}
        />
      </td>
      <td className="px-4 py-2 border border-gray-200">
        {canMove ? (
          <div className="flex items-center gap-3 justify-center">
            <button
              type="button"
              className="inline-flex h-7 w-7 items-center justify-center rounded bg-blue-500 text-white hover:bg-blue-600 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              onClick={() => onMoveUp?.(slider)}
              disabled={isFirst}
              aria-label="Move up"
              title="Move up"
            >
              <i className="fa-solid fa-chevron-up text-xs" />
            </button>
            <span className="text-sm font-medium text-gray-700 bg-gray-50 text-center min-w-[2rem]">
              {slider.sort_order != null ? slider.sort_order : '-'}
            </span>
            <button
              type="button"
              className="inline-flex h-7 w-7 items-center justify-center rounded bg-blue-500 text-white hover:bg-blue-600 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              onClick={() => onMoveDown?.(slider)}
              disabled={isLast}
              aria-label="Move down"
              title="Move down"
            >
              <i className="fa-solid fa-chevron-down text-xs" />
            </button>
          </div>
        ) : (
          <span>{slider.sort_order != null ? slider.sort_order : '-'}</span>
        )}
      </td>
      <td className="px-4 py-2 border border-gray-200">{formatDate(slider.createdAt)}</td>
      <td className="px-4 py-2 border border-gray-200">{formatDate(slider.updatedAt)}</td>
      {showActions && (
        <td className="px-4 py-2 border border-gray-200">
          <div className="flex items-center gap-2">
            {canUpdate && (
              <button
                type="button"
                className="inline-flex h-8 w-8 items-center justify-center rounded bg-blue-600 text-white hover:bg-blue-700"
                onClick={() => onEdit?.(slider)}
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
                onClick={() => onDelete?.(slider)}
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

