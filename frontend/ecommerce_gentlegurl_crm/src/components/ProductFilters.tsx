'use client'

import { ChangeEvent, FormEvent } from 'react'

import { useI18n } from '@/lib/i18n'

export interface ProductFilterValues {
  search: string
  sku: string
  status: '' | 'active' | 'inactive'
}

export const productFiltersFormId = 'product-filters-form'

export const emptyProductFilters: ProductFilterValues = {
  search: '',
  sku: '',
  status: '',
}

interface Props {
  values: ProductFilterValues
  onChange: (values: ProductFilterValues) => void
  onSubmit: (values: ProductFilterValues) => void
  onReset: () => void
}

export default function ProductFilters({ values, onChange, onSubmit, onReset }: Props) {
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
    onChange({ ...emptyProductFilters })
    onReset()
  }

  return (
    <form id={productFiltersFormId} onSubmit={handleSubmit} onReset={handleReset}>
      <div className="space-y-4">
        <div>
          <label
            htmlFor="search"
            className="block text-sm font-medium text-gray-700 mb-1"
          >
            Name
          </label>
          <input
            id="search"
            name="search"
            type="text"
            value={values.search}
            onChange={handleChange}
            placeholder="Search products"
            className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-blue-500 focus:border-blue-500"
          />
        </div>

        <div>
          <label
            htmlFor="sku"
            className="block text-sm font-medium text-gray-700 mb-1"
          >
            SKU
          </label>
          <input
            id="sku"
            name="sku"
            type="text"
            value={values.sku}
            onChange={handleChange}
            placeholder="SKU or code"
            className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-blue-500 focus:border-blue-500"
          />
        </div>

        <div>
          <label
            htmlFor="status"
            className="block text-sm font-medium text-gray-700 mb-1"
          >
            {t('common.status')}
          </label>
          <select
            id="status"
            name="status"
            value={values.status}
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
