'use client'

import { ChangeEvent, FormEvent, useState } from 'react'

import type { ServicesMenuRowData } from './ServicesMenuRow'
import {
  mapServicesMenuApiItemToRow,
  type ServicesMenuApiItem,
} from './servicesMenuUtils'
import { useI18n } from '@/lib/i18n'

interface ServicesMenuCreateModalProps {
  onClose: () => void
  onSuccess: (servicesMenu: ServicesMenuRowData) => void
}

interface FormState {
  name: string
  slug: string
}

const initialFormState: FormState = {
  name: '',
  slug: '',
}

export default function ServicesMenuCreateModal({
  onClose,
  onSuccess,
}: ServicesMenuCreateModalProps) {
  const { t } = useI18n()
  const [form, setForm] = useState<FormState>({ ...initialFormState })
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleChange = (
    event: ChangeEvent<HTMLInputElement | HTMLSelectElement>,
  ) => {
    const { name, value } = event.target
    setForm((prev) => ({ ...prev, [name]: value }))
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    const trimmedName = form.name.trim()
    const trimmedSlug = form.slug.trim()

    if (!trimmedName || !trimmedSlug) {
      setError(t('common.allFieldsRequired'))
      return
    }

    setSubmitting(true)
    setError(null)

    try {
      const res = await fetch('/api/proxy/ecommerce/services-menu-items', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({
          name: trimmedName,
          slug: trimmedSlug,
          is_active: true,
        }),
      })

      const data = await res.json().catch(() => null)

      if (!res.ok) {
        let message = t('common.createError')
        if (data && typeof data === 'object') {
          if (typeof (data as { message?: unknown }).message === 'string') {
            message = (data as { message: string }).message
          } else if (data && 'errors' in data) {
            const errors = (data as { errors?: unknown }).errors
            if (errors && typeof errors === 'object') {
              const firstKey = Object.keys(errors)[0]
              const firstValue = firstKey
                ? (errors as Record<string, unknown>)[firstKey]
                : null
              if (Array.isArray(firstValue) && typeof firstValue[0] === 'string') {
                message = firstValue[0]
              }
            }
          }
        }
        throw new Error(message)
      }

      const payload = data && typeof data === 'object'
        ? ((data as { data?: ServicesMenuApiItem | null }).data ?? null)
        : null

      const servicesMenuRow: ServicesMenuRowData = payload
        ? mapServicesMenuApiItemToRow(payload)
        : {
            id: 0,
            name: trimmedName,
            slug: trimmedSlug,
            sortOrder: null,
            isActive: true,
            createdAt: '',
            updatedAt: '',
          }

      onSuccess(servicesMenuRow)
      onClose()
    } catch (err) {
      const message = err instanceof Error ? err.message : t('common.createError')
      setError(message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-lg rounded-lg bg-white p-6 shadow-lg"
      >
        <div className="mb-4 flex items-start justify-between">
          <h2 className="text-lg font-semibold">Create Services Menu</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded p-1 text-gray-500 hover:bg-gray-100 hover:text-gray-700"
            aria-label="Close"
          >
            <i className="fa-solid fa-xmark" />
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              Name
            </label>
            <input
              name="name"
              value={form.name}
              onChange={handleChange}
              className="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              placeholder="e.g. Nail Services"
              required
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              Slug
            </label>
            <input
              name="slug"
              value={form.slug}
              onChange={handleChange}
              className="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              placeholder="e.g. nail-services"
              required
            />
          </div>
        </div>

        {error && (
          <div className="mt-4 rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">
            {error}
          </div>
        )}

        <div className="mt-6 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
            disabled={submitting}
          >
            Cancel
          </button>
          <button
            type="submit"
            className="rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60"
            disabled={submitting}
          >
            {submitting ? 'Saving...' : 'Save'}
          </button>
        </div>
      </form>
    </div>
  )
}
