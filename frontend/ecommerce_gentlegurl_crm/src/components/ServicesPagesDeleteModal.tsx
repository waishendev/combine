'use client'

import { useState } from 'react'

type ServicesMenuItem = {
  id: number
  name: string
  slug: string
}

interface ServicesPagesDeleteModalProps {
  servicesMenu: ServicesMenuItem
  onClose: () => void
  onSuccess: (menuId: number) => void
}

type DeleteResponse = {
  success?: boolean
  message?: string | null
}

export default function ServicesPagesDeleteModal({
  servicesMenu,
  onClose,
  onSuccess,
}: ServicesPagesDeleteModalProps) {
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleDelete = async () => {
    setSubmitting(true)
    setError(null)

    try {
      const res = await fetch(`/api/proxy/ecommerce/services-pages/${servicesMenu.id}`, {
        method: 'DELETE',
        headers: {
          Accept: 'application/json',
        },
      })

      const data: DeleteResponse | null = await res.json().catch(() => null)
      if (data && data.success === false && data.message === 'Unauthorized') {
        window.location.replace('/dashboard')
        return
      }

      if (!res.ok) {
        const message = data?.message || 'Failed to delete services page.'
        throw new Error(message)
      }

      onSuccess(servicesMenu.id)
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete services page.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-lg">
        <div className="mb-4 flex items-start justify-between">
          <h2 className="text-lg font-semibold">Delete Services Page</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded p-1 text-gray-500 hover:bg-gray-100 hover:text-gray-700"
            aria-label="Close"
            disabled={submitting}
          >
            <i className="fa-solid fa-xmark" />
          </button>
        </div>

        <p className="text-sm text-gray-700">
          Are you sure you want to delete this services page? This action cannot be undone.
        </p>
        <div className="mt-3 rounded border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-700">
          <div className="font-medium">{servicesMenu.name}</div>
          <div className="text-xs text-gray-500">/{servicesMenu.slug}</div>
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
            type="button"
            onClick={handleDelete}
            className="rounded bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-60"
            disabled={submitting}
          >
            {submitting ? 'Deleting...' : 'Delete'}
          </button>
        </div>
      </div>
    </div>
  )
}
