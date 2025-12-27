'use client'

import { ChangeEvent, FormEvent } from 'react'
import { useI18n } from '@/lib/i18n'

export interface OrderFilterValues {
  orderNo: string
  customerName: string
  customerEmail: string
  status: string
}

export const orderFiltersFormId = 'order-filters-form'

export const emptyOrderFilters: OrderFilterValues = {
  orderNo: '',
  customerName: '',
  customerEmail: '',
  status: '',
}

interface OrderFiltersProps {
  values: OrderFilterValues
  onChange: (values: OrderFilterValues) => void
  onSubmit: (values: OrderFilterValues) => void
  onReset: () => void
  allowedStatusOptions?: string[]
}

export default function OrderFilters({
  values,
  onChange,
  onSubmit,
  onReset,
  allowedStatusOptions,
}: OrderFiltersProps) {
  const { t } = useI18n()

  // Define all available status options
  const allStatusOptions = [
    { value: '', label: 'All' },
    { value: 'Awaiting Payment', label: 'Awaiting Payment' },
    { value: 'Waiting for Verification', label: 'Waiting for Verification' },
    { value: 'Payment Proof Rejected', label: 'Payment Proof Rejected' },
    { value: 'Payment Failed', label: 'Payment Failed' },
    { value: 'Cancelled', label: 'Cancelled' },
    { value: 'Refunded', label: 'Refunded' },
    { value: 'Payment Confirmed', label: 'Payment Confirmed' },
    { value: 'Preparing', label: 'Preparing' },
    { value: 'Ready for Pickup', label: 'Ready for Pickup' },
    { value: 'Shipped', label: 'Shipped' },
    { value: 'Completed', label: 'Completed' },
  ]

  // Filter status options if allowedStatusOptions is provided
  const statusOptions = allowedStatusOptions
    ? allStatusOptions.filter(option => 
        option.value === '' || allowedStatusOptions.includes(option.value)
      )
    : allStatusOptions

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
    onChange({ ...emptyOrderFilters })
    onReset()
  }

  return (
    <form id={orderFiltersFormId} onSubmit={handleSubmit} onReset={handleReset}>
      <div className="space-y-4">
        <div>
          <label
            htmlFor="orderNo"
            className="block text-sm font-medium text-gray-700 mb-1"
          >
            Order Number
          </label>
          <input
            id="orderNo"
            name="orderNo"
            type="text"
            value={values.orderNo}
            onChange={handleChange}
            placeholder="Enter order number"
            className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-blue-500 focus:border-blue-500"
          />
        </div>

        <div>
          <label
            htmlFor="customerName"
            className="block text-sm font-medium text-gray-700 mb-1"
          >
            Customer Name
          </label>
          <input
            id="customerName"
            name="customerName"
            type="text"
            value={values.customerName}
            onChange={handleChange}
            placeholder="Enter customer name"
            className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-blue-500 focus:border-blue-500"
          />
        </div>

        <div>
          <label
            htmlFor="customerEmail"
            className="block text-sm font-medium text-gray-700 mb-1"
          >
            Customer Email
          </label>
          <input
            id="customerEmail"
            name="customerEmail"
            type="text"
            value={values.customerEmail}
            onChange={handleChange}
            placeholder="Enter customer email"
            className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-blue-500 focus:border-blue-500"
          />
        </div>

        <div>
          <label
            htmlFor="status"
            className="block text-sm font-medium text-gray-700 mb-1"
          >
            Status
          </label>
          <select
            id="status"
            name="status"
            value={values.status}
            onChange={handleChange}
            className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-blue-500 focus:border-blue-500"
          >
            {statusOptions.map(option => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

      </div>
    </form>
  )
}

