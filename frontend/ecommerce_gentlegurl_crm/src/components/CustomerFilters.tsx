'use client'

import { ChangeEvent, FormEvent } from 'react'
import { useI18n } from '@/lib/i18n'

export interface CustomerFilterValues {
  name: string
  email: string
  phone: string
  isActive: '' | 'active' | 'inactive'
  tier: string
}

export const customerFiltersFormId = 'customer-filters-form'

export const emptyCustomerFilters: CustomerFilterValues = {
  name: '',
  email: '',
  phone: '',
  isActive: '',
  tier: '',
}

interface CustomerFiltersProps {
  values: CustomerFilterValues
  onChange: (values: CustomerFilterValues) => void
  onSubmit: (values: CustomerFilterValues) => void
  onReset: () => void
}

export default function CustomerFilters({
  values,
  onChange,
  onSubmit,
  onReset,
}: CustomerFiltersProps) {
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
    onChange({ ...emptyCustomerFilters })
    onReset()
  }

  return (
    <form id={customerFiltersFormId} onSubmit={handleSubmit} onReset={handleReset}>
      <div className="space-y-4">
        <div>
          <label
            htmlFor="name"
            className="block text-sm font-medium text-gray-700 mb-1"
          >
            {t('common.name')}
          </label>
          <input
            id="name"
            name="name"
            type="text"
            value={values.name}
            onChange={handleChange}
            placeholder={t('common.name')}
            className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-blue-500 focus:border-blue-500"
          />
        </div>

        <div>
          <label
            htmlFor="email"
            className="block text-sm font-medium text-gray-700 mb-1"
          >
            {t('common.email')}
          </label>
          <input
            id="email"
            name="email"
            type="text"
            value={values.email}
            onChange={handleChange}
            placeholder={t('common.emailPlaceholder')}
            className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-blue-500 focus:border-blue-500"
          />
        </div>

        <div>
          <label
            htmlFor="phone"
            className="block text-sm font-medium text-gray-700 mb-1"
          >
            Phone
          </label>
          <input
            id="phone"
            name="phone"
            type="text"
            value={values.phone}
            onChange={handleChange}
            placeholder="Enter phone"
            className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-blue-500 focus:border-blue-500"
          />
        </div>

        <div>
          <label
            htmlFor="tier"
            className="block text-sm font-medium text-gray-700 mb-1"
          >
            Tier
          </label>
          <input
            id="tier"
            name="tier"
            type="text"
            value={values.tier}
            onChange={handleChange}
            placeholder="Enter tier"
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

