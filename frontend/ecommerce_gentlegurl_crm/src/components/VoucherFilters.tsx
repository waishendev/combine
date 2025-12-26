'use client'

import { ChangeEvent, FormEvent } from 'react'
import { useI18n } from '@/lib/i18n'

export interface VoucherFilterValues {
  code: string
  isActive: '' | 'active' | 'inactive'
}

export const voucherFiltersFormId = 'voucher-filters-form'

export const emptyVoucherFilters: VoucherFilterValues = {
  code: '',
  isActive: '',
}

interface VoucherFiltersProps {
  values: VoucherFilterValues
  onChange: (values: VoucherFilterValues) => void
  onSubmit: (values: VoucherFilterValues) => void
  onReset: () => void
}

export default function VoucherFilters({
  values,
  onChange,
  onSubmit,
  onReset,
}: VoucherFiltersProps) {
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
    onChange({ ...emptyVoucherFilters })
    onReset()
  }

  return (
    <form id={voucherFiltersFormId} onSubmit={handleSubmit} onReset={handleReset}>
      <div className="space-y-4">
        <div>
          <label
            htmlFor="code"
            className="block text-sm font-medium text-gray-700 mb-1"
          >
            Code
          </label>
          <input
            id="code"
            name="code"
            type="text"
            value={values.code}
            onChange={handleChange}
            placeholder="Voucher code"
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

