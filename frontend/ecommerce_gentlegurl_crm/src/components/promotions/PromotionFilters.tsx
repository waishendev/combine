'use client'

import { ChangeEvent, FormEvent } from 'react'
import { useI18n } from '@/lib/i18n'

export interface PromotionFilterValues {
  name: string
  isActive: '' | 'active' | 'inactive'
}

export const promotionFiltersFormId = 'promotion-filters-form'

export const emptyPromotionFilters: PromotionFilterValues = {
  name: '',
  isActive: '',
}

interface PromotionFiltersProps {
  values: PromotionFilterValues
  onChange: (values: PromotionFilterValues) => void
  onSubmit: (values: PromotionFilterValues) => void
  onReset: () => void
}

export default function PromotionFilters({
  values,
  onChange,
  onSubmit,
  onReset,
}: PromotionFiltersProps) {
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
    onChange({ ...emptyPromotionFilters })
    onReset()
  }

  return (
    <form
      id={promotionFiltersFormId}
      onSubmit={handleSubmit}
      onReset={handleReset}
    >
      <div className="space-y-4">
        <div>
          <label
            htmlFor="promotion-filter-name"
            className="block text-sm font-medium text-gray-700 mb-1"
          >
            {t('common.name')}
          </label>
          <input
            id="promotion-filter-name"
            name="name"
            type="text"
            value={values.name}
            onChange={handleChange}
            placeholder="Promotion name"
            className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-blue-500 focus:border-blue-500"
          />
        </div>

        <div>
          <label
            htmlFor="promotion-filter-isActive"
            className="block text-sm font-medium text-gray-700 mb-1"
          >
            {t('common.status')}
          </label>
          <select
            id="promotion-filter-isActive"
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
