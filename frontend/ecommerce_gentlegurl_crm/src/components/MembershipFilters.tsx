'use client'

import { ChangeEvent, FormEvent } from 'react'
import { useI18n } from '@/lib/i18n'

export interface MembershipFilterValues {
  tier: string
  displayName: string
  isActive: '' | 'active' | 'inactive'
}

export const membershipFiltersFormId = 'membership-filters-form'

export const emptyMembershipFilters: MembershipFilterValues = {
  tier: '',
  displayName: '',
  isActive: '',
}

interface MembershipFiltersProps {
  values: MembershipFilterValues
  onChange: (values: MembershipFilterValues) => void
  onSubmit: (values: MembershipFilterValues) => void
  onReset: () => void
}

export default function MembershipFilters({
  values,
  onChange,
  onSubmit,
  onReset,
}: MembershipFiltersProps) {
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
    onChange({ ...emptyMembershipFilters })
    onReset()
  }

  return (
    <form id={membershipFiltersFormId} onSubmit={handleSubmit} onReset={handleReset}>
      <div className="space-y-4">
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
            placeholder="Tier"
            className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-blue-500 focus:border-blue-500"
          />
        </div>

        <div>
          <label
            htmlFor="displayName"
            className="block text-sm font-medium text-gray-700 mb-1"
          >
            Display Name
          </label>
          <input
            id="displayName"
            name="displayName"
            type="text"
            value={values.displayName}
            onChange={handleChange}
            placeholder="Display Name"
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

