'use client'

import { ChangeEvent, FormEvent } from 'react'

export interface BookingLogsFilterValues {
  action: string
}

export const bookingLogsFiltersFormId = 'booking-logs-filters-form'

export const emptyBookingLogsFilters: BookingLogsFilterValues = {
  action: '',
}

interface BookingLogsFiltersProps {
  values: BookingLogsFilterValues
  onChange: (values: BookingLogsFilterValues) => void
  onSubmit: (values: BookingLogsFilterValues) => void
  onReset: () => void
}

export default function BookingLogsFilters({
  values,
  onChange,
  onSubmit,
  onReset,
}: BookingLogsFiltersProps) {
  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target
    onChange({ ...values, [name]: value })
  }

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    onSubmit(values)
  }

  const handleReset = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    onChange({ ...emptyBookingLogsFilters })
    onReset()
  }

  return (
    <form id={bookingLogsFiltersFormId} onSubmit={handleSubmit} onReset={handleReset}>
      <div className="space-y-4">
        <div>
          <label
            htmlFor="action"
            className="block text-sm font-medium text-gray-700 mb-1"
          >
            Filter by Action
          </label>
          <input
            id="action"
            name="action"
            type="text"
            value={values.action}
            onChange={handleChange}
            placeholder="e.g. VOUCHER_GRANTED, BOOKING_CREATED"
            className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-blue-500 focus:border-blue-500"
          />
          <p className="mt-1 text-xs text-gray-500">
            Enter action name to filter logs
          </p>
        </div>
      </div>
    </form>
  )
}
