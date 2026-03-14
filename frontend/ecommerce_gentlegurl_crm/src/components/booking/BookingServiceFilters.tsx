'use client'

import { ChangeEvent, FormEvent } from 'react'
import { useI18n } from '@/lib/i18n'

export interface BookingServiceFilterValues {
  name: string
  isActive: '' | 'active' | 'inactive'
}

export const bookingServiceFiltersFormId = 'booking-service-filters-form'

export const emptyBookingServiceFilters: BookingServiceFilterValues = {
  name: '',
  isActive: '',
}

interface BookingServiceFiltersProps {
  values: BookingServiceFilterValues
  onChange: (values: BookingServiceFilterValues) => void
  onSubmit: (values: BookingServiceFilterValues) => void
  onReset: () => void
}

export default function BookingServiceFilters({
  values,
  onChange,
  onSubmit,
  onReset,
}: BookingServiceFiltersProps) {
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
    onChange({ ...emptyBookingServiceFilters })
    onReset()
  }

  return (
    <form id={bookingServiceFiltersFormId} onSubmit={handleSubmit} onReset={handleReset}>
      <div className="space-y-4">
        <div>
          <label
            htmlFor="name"
            className="block text-sm font-medium text-gray-700 mb-1"
          >
            Name
          </label>
          <input
            id="name"
            name="name"
            type="text"
            value={values.name}
            onChange={handleChange}
            placeholder="Service name"
            className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-blue-500 focus:border-blue-500"
          />
        </div>

        <div>
          <label
            htmlFor="isActive"
            className="block text-sm font-medium text-gray-700 mb-1"
          >
            {t('common.status')}
          </label>
          <select
            id="isActive"
            name="isActive"
            value={values.isActive}
            onChange={handleChange}
            className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="">{t('common.all')}</option>
            <option value="active">{t('common.active')}</option>
            <option value="inactive">{t('common.inactive')}</option>
          </select>
        </div>
      </div>
    </form>
  )
}
