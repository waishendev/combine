'use client'

import { ChangeEvent, FormEvent } from 'react'
import { useI18n } from '@/lib/i18n'

export interface BookingAppointmentFilterValues {
  date: string
  staffId: string
  status: string
  search: string
}

export const bookingAppointmentFiltersFormId = 'booking-appointment-filters-form'

export const emptyBookingAppointmentFilters: BookingAppointmentFilterValues = {
  date: '',
  staffId: '',
  status: '',
  search: '',
}

type StatusOption =
  | 'CONFIRMED'
  | 'COMPLETED'
  | 'CANCELLED'
  | 'LATE_CANCELLATION'
  | 'NO_SHOW'
  | 'NOTIFIED_CANCELLATION'

const STATUS_OPTIONS: StatusOption[] = [
  'CONFIRMED',
  'COMPLETED',
  'CANCELLED',
  'LATE_CANCELLATION',
  'NO_SHOW',
  'NOTIFIED_CANCELLATION',
]

type StaffOption = { id: number; name: string }

interface BookingAppointmentFiltersProps {
  values: BookingAppointmentFilterValues
  onChange: (values: BookingAppointmentFilterValues) => void
  onSubmit: (values: BookingAppointmentFilterValues) => void
  onReset: () => void
  staffs: StaffOption[]
}

export default function BookingAppointmentFilters({
  values,
  onChange,
  onSubmit,
  onReset,
  staffs,
}: BookingAppointmentFiltersProps) {
  const { t } = useI18n()

  const handleChange = (
    e: ChangeEvent<HTMLInputElement | HTMLSelectElement>,
  ) => {
    const { name, value } = e.target
    onChange({ ...values, [name]: value })
  }

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    onSubmit(values)
  }

  const handleReset = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    onChange({ ...emptyBookingAppointmentFilters })
    onReset()
  }

  return (
    <form id={bookingAppointmentFiltersFormId} onSubmit={handleSubmit} onReset={handleReset}>
      <div className="space-y-4">
        <div>
          <label
            htmlFor="date"
            className="block text-sm font-medium text-gray-700 mb-1"
          >
            Date
          </label>
          <input
            id="date"
            name="date"
            type="date"
            value={values.date}
            onChange={handleChange}
            className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-blue-500 focus:border-blue-500"
          />
        </div>

        <div>
          <label
            htmlFor="staffId"
            className="block text-sm font-medium text-gray-700 mb-1"
          >
            Staff
          </label>
          <select
            id="staffId"
            name="staffId"
            value={values.staffId}
            onChange={handleChange}
            className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="">All Staff</option>
            {staffs.map((staff) => (
              <option key={staff.id} value={staff.id}>
                {staff.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label
            htmlFor="status"
            className="block text-sm font-medium text-gray-700 mb-1"
          >
            Status
          </label>
          <select
            id="status"
            name="status"
            value={values.status}
            onChange={handleChange}
            className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="">All Status</option>
            {STATUS_OPTIONS.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label
            htmlFor="search"
            className="block text-sm font-medium text-gray-700 mb-1"
          >
            Search
          </label>
          <input
            id="search"
            name="search"
            type="text"
            value={values.search}
            onChange={handleChange}
            placeholder="Search keyword"
            className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-blue-500 focus:border-blue-500"
          />
        </div>
      </div>
    </form>
  )
}
