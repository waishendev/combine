'use client'

import Link from 'next/link'

import StatusBadge from './StatusBadge'
import { useI18n } from '@/lib/i18n'

export interface CustomerRowData {
  id: number
  name: string
  email: string
  phone: string
  tier: string
  type?: string
  isActive: boolean
  allowBookingWithoutDeposit?: boolean
  createdAt: string
  updatedAt: string
}

interface CustomerRowProps {
  customer: CustomerRowData
  showActions?: boolean
  canAssignVoucher?: boolean
  canUpdate?: boolean
  canDelete?: boolean
  canView?: boolean
  onAssignVoucher?: (customer: CustomerRowData) => void
  onEdit?: (customer: CustomerRowData) => void
  onDelete?: (customer: CustomerRowData) => void
  onView?: (customer: CustomerRowData) => void
  onToggleDepositWaiver?: (customer: CustomerRowData) => void
}

export default function CustomerRow({
  customer,
  showActions = false,
  canAssignVoucher = false,
  canUpdate = false,
  canDelete = false,
  canView = false,
  onAssignVoucher,
  onEdit,
  onDelete,
  onView,
  onToggleDepositWaiver,
}: CustomerRowProps) {
  const { t } = useI18n()
  const requiredDeposit =
    customer.allowBookingWithoutDeposit == null ? null : !customer.allowBookingWithoutDeposit

  return (
    <tr className="text-sm">
      <td className="px-4 py-2 border border-gray-200">{customer.name}</td>
      <td className="px-4 py-2 border border-gray-200">{customer.email}</td>
      <td className="px-4 py-2 border border-gray-200">{customer.phone}</td>
      <td className="px-4 py-2 border border-gray-200">{customer.tier}</td>
      <td className="px-4 py-2 border border-gray-200">
        <StatusBadge
          status={customer.isActive ? 'active' : 'inactive'}
          label={customer.isActive ? t('common.active') : t('common.inactive')}
        />
      </td>
      <td className="px-4 py-2 border border-gray-200 font-medium text-gray-900">
        {requiredDeposit == null ? '-' : requiredDeposit ? 'Yes' : 'No'}
      </td>
      <td className="px-4 py-2 border border-gray-200">{customer.createdAt}</td>
      {(showActions || canView) && (
        <td className="px-4 py-2 border border-gray-200">
          <div className="flex flex-wrap items-center gap-2">
            {canView && (
              <Link
                href={`/customers/${customer.id}/history`}
                className="inline-flex h-8 items-center justify-center rounded bg-slate-700 px-2 text-xs font-semibold text-white hover:bg-slate-800"
                title="View History"
              >
                 <i className="fa-solid fa-eye" />
              </Link>
            )}
            {/* {canView && (
              <button
                type="button"
                className="inline-flex h-8 w-8 items-center justify-center rounded bg-green-600 text-white hover:bg-green-700"
                onClick={() => onView?.(customer)}
                aria-label={t('customer.viewAction')}
                title={t('customer.viewAction')}
              >
                <i className="fa-solid fa-eye" />
              </button>
            )} */}
            {canAssignVoucher && (
              <button
                type="button"
                 className="inline-flex h-8 w-8 items-center justify-center rounded bg-indigo-600 text-white hover:bg-indigo-700"
                onClick={() => onAssignVoucher?.(customer)}
              >
                <i className="fa-solid fa-ticket" />
              </button>
            )}
            {canUpdate && (
              <button
                type="button"
                className={`inline-flex h-8 items-center justify-center rounded px-2 text-xs font-semibold text-white ${
                  customer.allowBookingWithoutDeposit ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-amber-600 hover:bg-amber-700'
                }`}
                onClick={() => onToggleDepositWaiver?.(customer)}
                title={customer.allowBookingWithoutDeposit ? 'Disable No Deposit Booking' : 'Enable No Deposit Booking'}
              >
                {customer.allowBookingWithoutDeposit ? 'Waiver On' : 'Waiver Off'}
              </button>
            )}
            {canUpdate && (
              <button
                type="button"
                className="inline-flex h-8 w-8 items-center justify-center rounded bg-blue-600 text-white hover:bg-blue-700"
                onClick={() => onEdit?.(customer)}
                aria-label={t('customer.editAction')}
                title={t('customer.editAction')}
              >
                <i className="fa-solid fa-pen-to-square" />
              </button>
            )}
            {canDelete && (
              <button
                type="button"
                className="inline-flex h-8 w-8 items-center justify-center rounded bg-red-600 text-white hover:bg-red-700"
                onClick={() => onDelete?.(customer)}
                aria-label={t('customer.deleteAction')}
                title={t('customer.deleteAction')}
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
