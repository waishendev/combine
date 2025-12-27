'use client'

import { ChangeEvent, FormEvent } from 'react'

import { useI18n } from '@/lib/i18n'

export interface RoleFilterValues {
  name: string
  isActive: '' | 'active' | 'inactive'
}

export const roleFiltersFormId = 'role-filters-form'

export const emptyRoleFilters: RoleFilterValues = {
  name: '',
  isActive: '',
}

interface RoleFiltersProps {
  values: RoleFilterValues
  onChange: (values: RoleFilterValues) => void
  onSubmit: (values: RoleFilterValues) => void
  onReset: () => void
}

export default function RoleFilters({
  values,
  onChange,
  onSubmit,
  onReset,
}: RoleFiltersProps) {
  const { t } = useI18n()

  const handleChange = (
    event: ChangeEvent<HTMLInputElement | HTMLSelectElement>,
  ) => {
    const { name, value } = event.target
    onChange({ ...values, [name]: value })
  }

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    onSubmit(values)
  }

  const handleReset = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    onChange({ ...emptyRoleFilters })
    onReset()
  }

  return (
    <form id={roleFiltersFormId} onSubmit={handleSubmit} onReset={handleReset}>
      <div className="space-y-4">
        <div>
          <label
            htmlFor="name"
            className="mb-1 block text-sm font-medium text-gray-700"
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
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-blue-500"
          />
        </div>

        <div>
          <label
            htmlFor="isActive"
            className="mb-1 block text-sm font-medium text-gray-700"
          >
            {t('common.status')}
          </label>
          <select
            id="isActive"
            name="isActive"
            value={values.isActive}
            onChange={handleChange}
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-blue-500"
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
