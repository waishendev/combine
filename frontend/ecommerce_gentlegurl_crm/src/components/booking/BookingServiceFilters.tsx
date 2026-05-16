'use client'

import { ChangeEvent, FormEvent } from 'react'
import { useI18n } from '@/lib/i18n'

export type BookingServiceCategoryOption = {
  id: number
  name: string
  cnName?: string
}

export interface BookingServiceFilterValues {
  name: string
  isActive: '' | 'active' | 'inactive'
  categoryId: string
}

export const bookingServiceFiltersFormId = 'booking-service-filters-form'

/** Sent to API as `category_id=none` — services not linked to any booking category. */
export const BOOKING_SERVICE_CATEGORY_FILTER_NONE = 'none'

export const emptyBookingServiceFilters: BookingServiceFilterValues = {
  name: '',
  isActive: '',
  categoryId: '',
}

interface BookingServiceFiltersProps {
  values: BookingServiceFilterValues
  categories: BookingServiceCategoryOption[]
  onChange: (values: BookingServiceFilterValues) => void
  onSubmit: (values: BookingServiceFilterValues) => void
  onReset: () => void
}

export default function BookingServiceFilters({
  values,
  categories,
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

        <div>
          <label
            htmlFor="categoryId"
            className="block text-sm font-medium text-gray-700 mb-1"
          >
            Category
          </label>
          <select
            id="categoryId"
            name="categoryId"
            value={values.categoryId}
            onChange={handleChange}
            className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="">All categories</option>
            <option value={BOOKING_SERVICE_CATEGORY_FILTER_NONE}>No category</option>
            {categories.map((category) => (
              <option key={category.id} value={String(category.id)}>
                {category.cnName ? `${category.name} (${category.cnName})` : category.name}
              </option>
            ))}
          </select>
          <p className="mt-1 text-xs text-gray-500">
            Matches services assigned in Booking → Categories.
          </p>
        </div>
      </div>
    </form>
  )
}
