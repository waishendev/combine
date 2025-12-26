'use client'

import { ChangeEvent, FormEvent } from 'react'
import { useI18n } from '@/lib/i18n'

export interface PermissionFilterValues {
  name: string
  slug: string
  groupId: string
}

export const permissionFiltersFormId = 'permission-filters-form'

export const emptyPermissionFilters: PermissionFilterValues = {
  name: '',
  slug: '',
  groupId: '',
}

export interface PermissionGroupOption {
  id: number | string | null
  name: string | null
}

interface PermissionFiltersProps {
  values: PermissionFilterValues
  onChange: (values: PermissionFilterValues) => void
  onSubmit: (values: PermissionFilterValues) => void
  onReset: () => void
  groups: PermissionGroupOption[]
  groupsLoading: boolean
}

export default function PermissionFilters({
  values,
  onChange,
  onSubmit,
  onReset,
  groups,
  groupsLoading,
}: PermissionFiltersProps) {
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
    onChange({ ...emptyPermissionFilters })
    onReset()
  }

  return (
    <form id={permissionFiltersFormId} onSubmit={handleSubmit} onReset={handleReset}>
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
            placeholder="Name"
            className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-blue-500 focus:border-blue-500"
          />
        </div>

        <div>
          <label
            htmlFor="slug"
            className="block text-sm font-medium text-gray-700 mb-1"
          >
            Slug
          </label>
          <input
            id="slug"
            name="slug"
            type="text"
            value={values.slug}
            onChange={handleChange}
            placeholder="Slug"
            className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-blue-500 focus:border-blue-500"
          />
        </div>

        <div>
          <label
            htmlFor="groupId"
            className="block text-sm font-medium text-gray-700 mb-1"
          >
            Group
          </label>
          <select
            id="groupId"
            name="groupId"
            value={values.groupId}
            onChange={handleChange}
            className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-blue-500 focus:border-blue-500"
            disabled={groupsLoading}
          >
            <option value="">{t('common.all')}</option>
            {groups.map((group) => (
              <option key={String(group.id)} value={String(group.id ?? '')}>
                {group.name ?? group.id}
              </option>
            ))}
          </select>
        </div>
      </div>
    </form>
  )
}

