'use client'

import { ChangeEvent, FormEvent } from 'react'
import { useI18n } from '@/lib/i18n'

export interface BlockFilterValues {
  scope: string
  staff_id: string
  from: string
  to: string
}

export const blockFiltersFormId = 'block-filters-form'

export const emptyBlockFilters: BlockFilterValues = {
  scope: '',
  staff_id: '',
  from: '',
  to: '',
}

interface BlockFiltersProps {
  values: BlockFilterValues
  onChange: (values: BlockFilterValues) => void
  onSubmit: (values: BlockFilterValues) => void
  onReset: () => void
  staffs: Array<{ id: number; name: string }>
}

export default function BlockFilters({
  values,
  onChange,
  onSubmit,
  onReset,
  staffs,
}: BlockFiltersProps) {
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
    onChange({ ...emptyBlockFilters })
    onReset()
  }

  return (
    <form id={blockFiltersFormId} onSubmit={handleSubmit} onReset={handleReset}>
      <div className="space-y-4">
        <div>
          <label
            htmlFor="scope"
            className="block text-sm font-medium text-gray-700 mb-1"
          >
            Scope
          </label>
          <select
            id="scope"
            name="scope"
            value={values.scope}
            onChange={handleChange}
            className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="">{t('common.all')}</option>
            <option value="STORE">STORE</option>
            <option value="STAFF">STAFF</option>
          </select>
        </div>

        <div>
          <label
            htmlFor="staff_id"
            className="block text-sm font-medium text-gray-700 mb-1"
          >
            Staff
          </label>
          <select
            id="staff_id"
            name="staff_id"
            value={values.staff_id}
            onChange={handleChange}
            className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-blue-500 focus:border-blue-500"
            disabled={values.scope === 'STORE'}
          >
            <option value="">{t('common.all')}</option>
            {staffs.map((staff) => (
              <option key={staff.id} value={staff.id}>
                {staff.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label
            htmlFor="from"
            className="block text-sm font-medium text-gray-700 mb-1"
          >
            From
          </label>
          <input
            id="from"
            name="from"
            type="datetime-local"
            value={values.from}
            onChange={handleChange}
            className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-blue-500 focus:border-blue-500"
          />
        </div>

        <div>
          <label
            htmlFor="to"
            className="block text-sm font-medium text-gray-700 mb-1"
          >
            To
          </label>
          <input
            id="to"
            name="to"
            type="datetime-local"
            value={values.to}
            onChange={handleChange}
            className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-blue-500 focus:border-blue-500"
          />
        </div>
      </div>
    </form>
  )
}
