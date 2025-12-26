'use client'

import { ChangeEvent, FormEvent } from 'react'
import { useI18n } from '@/lib/i18n'

export interface AdminFilterValues {
  username: string
  email: string
  isActive: '' | 'active' | 'inactive'
  roleId: string
}

export const adminFiltersFormId = 'admin-filters-form'

export const emptyAdminFilters: AdminFilterValues = {
  username: '',
  email: '',
  isActive: '',
  roleId: '',
}

export interface AdminRoleOption {
  id: number | string | null
  name: string | null
}

interface AdminFiltersProps {
  values: AdminFilterValues
  onChange: (values: AdminFilterValues) => void
  onSubmit: (values: AdminFilterValues) => void
  onReset: () => void
  roles: AdminRoleOption[]
  rolesLoading: boolean
}

export default function AdminFilters({
  values,
  onChange,
  onSubmit,
  onReset,
  roles,
  rolesLoading,
}: AdminFiltersProps) {
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
    onChange({ ...emptyAdminFilters })
    onReset()
  }

  return (
    <form id={adminFiltersFormId} onSubmit={handleSubmit} onReset={handleReset}>
      <div className="space-y-4">
        <div>
          <label
            htmlFor="username"
            className="block text-sm font-medium text-gray-700 mb-1"
          >
            {t('common.username')}
          </label>
          <input
            id="username"
            name="username"
            type="text"
            value={values.username}
            onChange={handleChange}
            placeholder={t('common.username')}
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
            htmlFor="roleId"
            className="block text-sm font-medium text-gray-700 mb-1"
          >
            {t('common.role')}
          </label>
          <select
            id="roleId"
            name="roleId"
            value={values.roleId}
            onChange={handleChange}
            className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-blue-500 focus:border-blue-500"
            disabled={rolesLoading}
          >
            <option value="">{t('common.all')}</option>
            {roles.map((role) => (
              <option key={String(role.id)} value={String(role.id ?? '')}>
                {role.name ?? role.id}
              </option>
            ))}
          </select>
        </div>
      </div>
    </form>
  )
}
