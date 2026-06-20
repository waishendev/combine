'use client'

import { FormEvent, useState } from 'react'

import CrmFormModalShell from '@/components/CrmFormModalShell'
import type { CustomerTypeRowData } from './customerTypeUtils'
import { mapCustomerTypeApiItemToRow, type CustomerTypeApiItem } from './customerTypeUtils'

interface CustomerTypeCreateModalProps {
  onClose: () => void
  onSuccess: (row: CustomerTypeRowData) => void
}

export default function CustomerTypeCreateModal({ onClose, onSuccess }: CustomerTypeCreateModalProps) {
  const [name, setName] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const trimmedName = name.trim()
    if (!trimmedName) {
      setError('Type name is required')
      return
    }

    setSubmitting(true)
    setError(null)

    try {
      const res = await fetch('/api/proxy/customer-types', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({ name: trimmedName }),
      })

      const data = await res.json().catch(() => null)
      if (!res.ok) {
        const message =
          data && typeof data === 'object' && typeof (data as { message?: unknown }).message === 'string'
            ? String((data as { message: string }).message)
            : 'Failed to create customer type'
        setError(message)
        return
      }

      const payload = data?.data as CustomerTypeApiItem | undefined
      const row = payload
        ? mapCustomerTypeApiItemToRow(payload)
        : {
            id: 0,
            name: trimmedName,
            createdAt: '',
            updatedAt: '',
          }

      onSuccess(row)
    } catch {
      setError('Failed to create customer type')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <CrmFormModalShell
      title="Create Customer Type"
      onClose={onClose}
      closeDisabled={submitting}
      footer={
        <>
          <button
            type="button"
            className="rounded-md border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 disabled:opacity-50"
            onClick={() => !submitting && onClose()}
            disabled={submitting}
          >
            Cancel
          </button>
          <button
            type="submit"
            form="customer-type-create-form"
            className="rounded-md bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700 disabled:opacity-50"
            disabled={submitting}
          >
            {submitting ? 'Creating...' : 'Create'}
          </button>
        </>
      }
    >
      <form id="customer-type-create-form" onSubmit={handleSubmit} className="space-y-4 px-5 py-4">
        <div>
          <label htmlFor="create-customer-type-name" className="mb-1 block text-sm font-medium text-gray-700">
            Type Name <span className="text-red-500">*</span>
          </label>
          <input
            id="create-customer-type-name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-blue-500"
            placeholder="e.g. product"
            disabled={submitting}
          />
        </div>

        {error && <div className="text-sm text-red-600">{error}</div>}
      </form>
    </CrmFormModalShell>
  )
}
