'use client'

import { FormEvent, useEffect, useState } from 'react'

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
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={() => !submitting && onClose()} />
      <form onSubmit={handleSubmit} className="relative w-full max-w-lg rounded-lg bg-white shadow-lg">
        <div className="flex items-center justify-between border-b border-gray-300 px-5 py-4">
          <h2 className="text-lg font-semibold">Edit Customer Type</h2>
          <button
            type="button"
            className="text-gray-500 hover:text-gray-700 text-2xl leading-none"
            onClick={() => !submitting && onClose()}
          >
            <i className="fa-solid fa-xmark" />
          </button>
        </div>

        <div className="space-y-4 px-5 py-4">
          {loading ? (
            <div className="py-8 text-center text-sm text-gray-500">Loading...</div>
          ) : (
            <div>
              <label htmlFor="edit-customer-type-name" className="block text-sm font-medium text-gray-700 mb-1">
                Type Name <span className="text-red-500">*</span>
              </label>
              <input
                id="edit-customer-type-name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-blue-500 focus:border-blue-500"
                placeholder="e.g. product"
                disabled={disableForm}
              />
            </div>
          )}

          {error && <div className="text-sm text-red-600">{error}</div>}
        </div>

        <div className="flex items-center justify-end gap-3 border-t border-gray-300 px-5 py-4">
          <button
            type="button"
            className="px-4 py-2 text-sm text-gray-700 border border-gray-300 rounded-md hover:bg-gray-100"
            onClick={() => !submitting && onClose()}
            disabled={submitting}
          >
            Cancel
          </button>
          <button
            type="submit"
            className="px-4 py-2 text-sm text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50"
            disabled={disableForm}
          >
            {submitting ? 'Saving...' : 'Save'}
          </button>
        </div>
      </form>
    </div>
  )
}
