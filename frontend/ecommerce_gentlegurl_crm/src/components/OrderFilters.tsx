'use client'

import { ChangeEvent, FormEvent } from 'react'
import { useI18n } from '@/lib/i18n'

export interface OrderFilterValues {
  orderNo: string
  customerName: string
  customerEmail: string
  status: string
  paymentStatus: string
}

export const orderFiltersFormId = 'order-filters-form'

export const emptyOrderFilters: OrderFilterValues = {
  orderNo: '',
  customerName: '',
  customerEmail: '',
  status: '',
  paymentStatus: '',
}

interface OrderFiltersProps {
  values: OrderFilterValues
  onChange: (values: OrderFilterValues) => void
  onSubmit: (values: OrderFilterValues) => void
  onReset: () => void
}

export default function OrderFilters({
  values,
  onChange,
  onSubmit,
  onReset,
}: OrderFiltersProps) {
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
            <option value="">All</option>
            <option value="Awaiting Payment">Awaiting Payment</option>
            <option value="Waiting for Verification">Waiting for Verification</option>
            <option value="Payment Proof Rejected">Payment Proof Rejected</option>
            <option value="Payment Failed">Payment Failed</option>
            <option value="Cancelled">Cancelled</option>
            <option value="Payment Confirmed">Payment Confirmed</option>
            <option value="Preparing">Preparing</option>
            <option value="Ready for Pickup">Ready for Pickup</option>
            <option value="Shipped">Shipped</option>
            <option value="Completed">Completed</option>
          </select>
        </div>

        <div>
          <label
            htmlFor="paymentStatus"
            className="block text-sm font-medium text-gray-700 mb-1"
          >
            Payment Status
          </label>
          <select
            id="paymentStatus"
            name="paymentStatus"
            value={values.paymentStatus}
            onChange={handleChange}
            className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="">All</option>
            <option value="unpaid">Unpaid</option>
            <option value="paid">Paid</option>
            <option value="failed">Failed</option>
            <option value="refunded">Refunded</option>
          </select>
        </div>
      </div>
    </form>
  )
}

