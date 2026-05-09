'use client'

import { ChangeEvent, FormEvent } from 'react'

import { useI18n } from '@/lib/i18n'

export interface ProductFilterValues {
  name: string
  sku: string
  status: '' | 'active' | 'inactive'
  category_id: string
}

export const productFiltersFormId = 'product-filters-form'

export const emptyProductFilters: ProductFilterValues = {
  name: '',
  sku: '',
  status: '',
  category_id: '',
}

interface Props {
  values: ProductFilterValues
  categories: Array<{ id: number; name: string }>
  onChange: (values: ProductFilterValues) => void
  onSubmit: (values: ProductFilterValues) => void
  onReset: () => void
}

export default function ProductFilters({ values, categories, onChange, onSubmit, onReset }: Props) {
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
            htmlFor="product-filter-name"
            className="block text-sm font-medium text-gray-700 mb-1"
          >
            Name
          </label>
          <input
            id="product-filter-name"
            name="name"
            type="text"
            value={values.name}
            onChange={handleChange}
            placeholder="Filter by product name"
            className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-blue-500 focus:border-blue-500"
          />
          <p className="mt-1 text-xs text-gray-500">Partial match on product name.</p>
        </div>

        <div>
          <label
            htmlFor="product-filter-sku"
            className="block text-sm font-medium text-gray-700 mb-1"
          >
            SKU
          </label>
          <input
            id="product-filter-sku"
            name="sku"
            type="text"
            value={values.sku}
            onChange={handleChange}
            placeholder="Filter by SKU"
            className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-blue-500 focus:border-blue-500"
          />
          <p className="mt-1 text-xs text-gray-500">
            Partial match on main SKU or variant SKU.
          </p>
        </div>

        <div>
          <label
            htmlFor="category_id"
            className="block text-sm font-medium text-gray-700 mb-1"
          >
            Category
          </label>
          <select
            id="category_id"
            name="category_id"
            value={values.category_id}
            onChange={handleChange}
            className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="">{t('common.all')}</option>
            {categories.map((category) => (
              <option key={category.id} value={String(category.id)}>
                {category.name}
              </option>
            ))}
          </select>
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
