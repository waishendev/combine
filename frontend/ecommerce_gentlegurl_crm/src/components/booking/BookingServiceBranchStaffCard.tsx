'use client'

import { useState } from 'react'

import BookingServiceAllowedStaffPicker, {
  type BookingStaffOption,
} from '@/components/booking/BookingServiceAllowedStaffPicker'

type Props = {
  branchName: string
  staffOptions: BookingStaffOption[]
  value: number[]
  onChange: (ids: number[]) => void
  disabled?: boolean
  loading?: boolean
  defaultOpen?: boolean
}

export default function BookingServiceBranchStaffCard({
  branchName,
  staffOptions,
  value,
  onChange,
  disabled = false,
  loading = false,
  defaultOpen = true,
}: Props) {
  const [open, setOpen] = useState(defaultOpen)

  return (
    <div className="overflow-hidden rounded-lg border border-gray-200 bg-gray-50/80">
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left hover:bg-gray-100/80"
        aria-expanded={open}
      >
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-gray-900">{branchName}</p>
          <p className="mt-0.5 text-xs text-gray-500">
            {value.length === 0
              ? 'No staff selected'
              : `${value.length} staff selected`}
          </p>
        </div>
        <i
          className={`fa-solid fa-chevron-${open ? 'up' : 'down'} shrink-0 text-xs text-gray-400`}
          aria-hidden
        />
      </button>

      {open ? (
        <div className="space-y-3 border-t border-gray-200 px-4 py-3">
          <BookingServiceAllowedStaffPicker
            compact
            staffOptions={staffOptions}
            value={value}
            onChange={onChange}
            disabled={disabled}
            loading={loading}
          />
        </div>
      ) : null}
    </div>
  )
}
