'use client'

import StatusBadge from './StatusBadge'
import { useI18n } from '@/lib/i18n'

export interface AnnouncementRowData {
  id: number
  key: string
  title: string
  subtitle: string
  bodyText: string
  imagePath: string
  imageUrl: string
  buttonLabel: string
  buttonLink: string
  isActive: boolean
  startAt: string
  endAt: string
  sortOrder: number
  createdAt: string
  updatedAt: string
  formattedStartAt: string
  formattedEndAt: string
  formattedCreatedAt: string
  formattedUpdatedAt: string
}

interface AnnouncementRowProps {
  announcement: AnnouncementRowData
  showActions?: boolean
  canUpdate?: boolean
  canDelete?: boolean
  onEdit?: (announcement: AnnouncementRowData) => void
  onDelete?: (announcement: AnnouncementRowData) => void
}

export default function AnnouncementRow({
  announcement,
  showActions = false,
  canUpdate = false,
  canDelete = false,
  onEdit,
  onDelete,
}: AnnouncementRowProps) {
  const { t } = useI18n()
  return (
    <tr className="text-sm">
      <td className="px-4 py-2 border border-gray-200">
        {announcement.imageUrl || announcement.imagePath ? (
          <img
            src={announcement.imageUrl || announcement.imagePath}
            alt={announcement.title}
            className="h-16 w-24 rounded object-contain border border-gray-200 bg-white"
          />
        ) : (
          '-'
        )}
      </td>
      <td className="px-4 py-2 border border-gray-200">{announcement.title}</td>
      <td className="px-4 py-2 border border-gray-200">{announcement.subtitle}</td>
      <td className="px-4 py-2 border border-gray-200">
        <div className="max-w-xs truncate" title={announcement.bodyText}>
          {announcement.bodyText}
        </div>
      </td>
      <td className="px-4 py-2 border border-gray-200">
        <StatusBadge
          status={announcement.isActive ? 'active' : 'inactive'}
          label={announcement.isActive ? t('common.active') : t('common.inactive')}
        />
      </td>
      <td className="px-4 py-2 border border-gray-200">
        {announcement.formattedStartAt || '-'}
      </td>
      <td className="px-4 py-2 border border-gray-200">
        {announcement.formattedEndAt || '-'}
      </td>
      <td className="px-4 py-2 border border-gray-200">
        {announcement.formattedCreatedAt || '-'}
      </td>
      {showActions && (
        <td className="px-4 py-2 border border-gray-200">
          <div className="flex items-center gap-2">
            {canUpdate && (
              <button
                type="button"
                className="inline-flex h-8 w-8 items-center justify-center rounded bg-blue-600 text-white hover:bg-blue-700"
                onClick={() => onEdit?.(announcement)}
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
                onClick={() => onDelete?.(announcement)}
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
