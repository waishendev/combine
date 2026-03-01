'use client'

import { ChangeEvent, FormEvent } from 'react'
import { useI18n } from '@/lib/i18n'

export interface StaffFilterValues {
  search: string
  isActive: '' | 'active' | 'inactive'
}

export const staffFiltersFormId = 'staff-filters-form'

export const emptyStaffFilters: StaffFilterValues = {
  search: '',
  isActive: '',
}

interface StaffFiltersProps {
  values: StaffFilterValues
  onChange: (values: StaffFilterValues) => void
  onSubmit: (values: StaffFilterValues) => void
  onReset: () => void
}

export default function StaffFilters({
  values,
  onChange,
  onSubmit,
  onReset,
}: StaffFiltersProps) {
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
    onChange({ ...emptyStaffFilters })
    onReset()
  }

  return (
    <form id={staffFiltersFormId} onSubmit={handleSubmit} onReset={handleReset}>
      <div className="space-y-4">
        <div>
          <label
            htmlFor="search"
            className="block text-sm font-medium text-gray-700 mb-1"
          >
            Search (Name/Code/Email)
          </label>
          <input
            id="search"
            name="search"
            type="text"
            value={values.search}
            onChange={handleChange}
            placeholder="Search name/code/email"
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
