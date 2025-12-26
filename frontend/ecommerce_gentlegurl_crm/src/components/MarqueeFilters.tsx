'use client'

import { ChangeEvent, FormEvent } from 'react'
import { useI18n } from '@/lib/i18n'

export interface MarqueeFilterValues {
  text: string
  isActive: '' | 'active' | 'inactive'
}

export const marqueeFiltersFormId = 'marquee-filters-form'

export const emptyMarqueeFilters: MarqueeFilterValues = {
  text: '',
  isActive: '',
}

interface MarqueeFiltersProps {
  values: MarqueeFilterValues
  onChange: (values: MarqueeFilterValues) => void
  onSubmit: (values: MarqueeFilterValues) => void
  onReset: () => void
}

export default function MarqueeFilters({
  values,
  onChange,
  onSubmit,
  onReset,
}: MarqueeFiltersProps) {
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
    onChange({ ...emptyMarqueeFilters })
    onReset()
  }

  return (
    <form id={marqueeFiltersFormId} onSubmit={handleSubmit} onReset={handleReset}>
      <div className="space-y-4">
        <div>
          <label
            htmlFor="text"
            className="block text-sm font-medium text-gray-700 mb-1"
          >
            Text
          </label>
          <input
            id="text"
            name="text"
            type="text"
            value={values.text}
            onChange={handleChange}
            placeholder="Search text..."
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

