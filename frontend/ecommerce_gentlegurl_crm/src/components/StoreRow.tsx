'use client'

import StatusBadge from './StatusBadge'
import { useI18n } from '@/lib/i18n'

export interface StoreRowData {
  id: number
  name: string
  code: string
  address_line1: string
  address_line2: string
  city: string
  state: string
  postcode: string
  country: string
  phone: string
  isActive: boolean
  createdAt: string
  updatedAt: string
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
      <td className="px-4 py-2 border border-gray-200">{store.name}</td>
      <td className="px-4 py-2 border border-gray-200">{store.code}</td>
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
      <td className="px-4 py-2 border border-gray-200">{store.createdAt}</td>
      <td className="px-4 py-2 border border-gray-200">{store.updatedAt}</td>
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


