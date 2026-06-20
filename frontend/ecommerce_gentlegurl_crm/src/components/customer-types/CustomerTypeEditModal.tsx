'use client'

import { FormEvent, useEffect, useState } from 'react'

import CrmFormModalShell from '@/components/CrmFormModalShell'
import type { CustomerTypeRowData } from './customerTypeUtils'
import { mapCustomerTypeApiItemToRow, type CustomerTypeApiItem } from './customerTypeUtils'

interface CustomerTypeEditModalProps {
  customerTypeId: number
  onClose: () => void
  onSuccess: (row: CustomerTypeRowData) => void
}

export default function CustomerTypeEditModal({ customerTypeId, onClose, onSuccess }: CustomerTypeEditModalProps) {
  const [name, setName] = useState('')
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const controller = new AbortController()

    const load = async () => {
      setLoading(true)
      setError(null)
      try {
        const res = await fetch(`/api/proxy/customer-types/${customerTypeId}`, {
          cache: 'no-store',
          signal: controller.signal,
          headers: { Accept: 'application/json' },
        })

        const data = await res.json().catch(() => null)
        if (!res.ok) {
          const message =
            data && typeof data === 'object' && typeof (data as { message?: unknown }).message === 'string'
              ? String((data as { message: string }).message)
              : 'Failed to load customer type'
          setError(message)
          return
        }

        const payload = data?.data as CustomerTypeApiItem | undefined
        setName(typeof payload?.name === 'string' ? payload.name : '')
      } catch (err) {
        if (!(err instanceof DOMException && err.name === 'AbortError')) {
          setError('Failed to load customer type')
        }
      } finally {
        setLoading(false)
      }
    }

    void load()
    return () => controller.abort()
  }, [customerTypeId])

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
      const res = await fetch(`/api/proxy/customer-types/${customerTypeId}`, {
        method: 'PUT',
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
            : 'Failed to update customer type'
        setError(message)
        return
      }

      const payload = data?.data as CustomerTypeApiItem | undefined
      const row = payload
        ? mapCustomerTypeApiItemToRow(payload)
        : {
            id: customerTypeId,
            name: trimmedName,
            createdAt: '',
            updatedAt: new Date().toISOString(),
          }

      onSuccess(row)
    } catch {
      setError('Failed to update customer type')
    } finally {
      setSubmitting(false)
    }
  }

  const disableForm = loading || submitting

  return (
    <CrmFormModalShell
      title="Edit Customer Type"
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
            form="customer-type-edit-form"
            className="rounded-md bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700 disabled:opacity-50"
            disabled={disableForm}
          >
            {submitting ? 'Saving...' : 'Save'}
          </button>
        </>
      }
    >
      <form id="customer-type-edit-form" onSubmit={handleSubmit} className="space-y-4 px-5 py-4">
        {loading ? (
          <div className="py-8 text-center text-sm text-gray-500">Loading...</div>
        ) : (
          <div>
            <label htmlFor="edit-customer-type-name" className="mb-1 block text-sm font-medium text-gray-700">
              Type Name <span className="text-red-500">*</span>
            </label>
            <input
              id="edit-customer-type-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-blue-500"
              placeholder="e.g. product"
              disabled={disableForm}
            />
          </div>
        )}

        {error && <div className="text-sm text-red-600">{error}</div>}
      </form>
    </CrmFormModalShell>
  )
}
