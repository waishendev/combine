'use client'

import StatusBadge from './StatusBadge'
import { useI18n } from '@/lib/i18n'

export interface StoreRowData {
  id: number
  name: string
  code: string
  imageUrl?: string | null
  address_line1: string
  address_line2: string
  city: string
  state: string
  postcode: string
  country: string
  phone: string
  isActive: boolean
}

interface StoreRowProps {
  store: StoreRowData
  showActions?: boolean
  canUpdate?: boolean
  canDelete?: boolean
  onEdit?: (store: StoreRowData) => void
  onDelete?: (store: StoreRowData) => void
}

export default function StoreRow({
  store,
  showActions = false,
  canUpdate = false,
  canDelete = false,
  onEdit,
  onDelete,
}: StoreRowProps) {
  const { t } = useI18n()
  return (
    <tr className="text-sm">
      <td className="px-4 py-2 border border-gray-200">
        <div className="flex items-center gap-3">
          <div className="h-12 w-12 rounded-lg bg-gray-100 flex items-center justify-center overflow-hidden">
            {store.imageUrl ? (
              <img
                src={store.imageUrl}
                alt={store.name}
                className="h-full w-full object-cover"
              />
            ) : (
              <span className="text-sm font-semibold text-gray-500">
                {store.name?.charAt(0) || 'S'}
              </span>
            )}
          </div>
          <div>
            <div className="font-semibold text-gray-900">{store.name}</div>
            <div className="text-xs text-gray-500">{store.code}</div>
          </div>
        </div>
      </td>
      <td className="px-4 py-2 border border-gray-200">
        {store.address_line1}
        {store.address_line2 && `, ${store.address_line2}`}
      </td>
      <td className="px-4 py-2 border border-gray-200">{store.city}</td>
      <td className="px-4 py-2 border border-gray-200">{store.state}</td>
      <td className="px-4 py-2 border border-gray-200">{store.postcode}</td>
      <td className="px-4 py-2 border border-gray-200">{store.country}</td>
      <td className="px-4 py-2 border border-gray-200">{store.phone}</td>
      <td className="px-4 py-2 border border-gray-200">
        <StatusBadge
          status={store.isActive ? 'active' : 'inactive'}
          label={store.isActive ? t('common.active') : t('common.inactive')}
        />
      </td>
      {showActions && (
        <td className="px-4 py-2 border border-gray-200">
          <div className="flex items-center gap-2">
            {canUpdate && (
              <button
                type="button"
                className="inline-flex h-8 w-8 items-center justify-center rounded bg-blue-600 text-white hover:bg-blue-700"
                onClick={() => onEdit?.(store)}
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
                onClick={() => onDelete?.(store)}
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

