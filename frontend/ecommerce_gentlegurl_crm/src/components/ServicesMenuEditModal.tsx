'use client'

import { ChangeEvent, FormEvent, useEffect, useMemo, useState } from 'react'

import type { ServicesMenuRowData } from './ServicesMenuRow'
import {
  mapServicesMenuApiItemToRow,
  type ServicesMenuApiItem,
} from './servicesMenuUtils'
import { useI18n } from '@/lib/i18n'

interface ServicesMenuEditModalProps {
  servicesMenuId: number
  onClose: () => void
  onSuccess: (servicesMenu: ServicesMenuRowData) => void
}

type FormState = {
  name: string
  slug: string
  isActive: boolean
}

export default function ServicesMenuEditModal({
  servicesMenuId,
  onClose,
  onSuccess,
}: ServicesMenuEditModalProps) {
  const { t } = useI18n()
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loadedServicesMenu, setLoadedServicesMenu] = useState<ServicesMenuRowData | null>(null)
  const [form, setForm] = useState<FormState>({ name: '', slug: '', isActive: true })

  const loadServicesMenu = useMemo(
    () => async (signal: AbortSignal) => {
      setLoading(true)
      setError(null)
      try {
        const res = await fetch(`/api/proxy/ecommerce/services-menu-items/${servicesMenuId}`, {
          cache: 'no-store',
          signal,
        })

        if (!res.ok) {
          throw new Error(t('common.loadError'))
        }

        const data = await res.json().catch(() => null)
        const servicesMenu = data?.data as ServicesMenuApiItem | undefined
        if (!servicesMenu) {
          throw new Error(t('common.loadError'))
        }

        const mappedServicesMenu = mapServicesMenuApiItemToRow(servicesMenu)
        setLoadedServicesMenu(mappedServicesMenu)
        setForm({
          name: mappedServicesMenu.name,
          slug: mappedServicesMenu.slug,
          isActive: mappedServicesMenu.isActive,
        })
      } catch (err) {
        if (!(err instanceof DOMException && err.name === 'AbortError')) {
          const message = err instanceof Error ? err.message : t('common.loadError')
          setError(message)
        }
      } finally {
        if (!signal.aborted) {
          setLoading(false)
        }
      }
    },
    [servicesMenuId, t],
  )

  useEffect(() => {
    const controller = new AbortController()
    loadServicesMenu(controller.signal)
    return () => controller.abort()
  }, [loadServicesMenu])

  const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
    const { name, value, type, checked } = event.target
    setForm((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }))
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
      const res = await fetch(`/api/proxy/ecommerce/services-menu-items/${servicesMenuId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({
          name: trimmedName,
          slug: trimmedSlug,
          is_active: form.isActive,
        }),
      })

      const data = await res.json().catch(() => null)

      if (!res.ok) {
        let message = t('common.updateError')
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

      const payloadData = data && typeof data === 'object'
        ? ((data as { data?: ServicesMenuApiItem | null }).data ?? null)
        : null

      const servicesMenuRow: ServicesMenuRowData = payloadData
        ? mapServicesMenuApiItemToRow(payloadData)
        : {
            id: loadedServicesMenu?.id ?? servicesMenuId,
            name: trimmedName,
            slug: trimmedSlug,
            sortOrder: loadedServicesMenu?.sortOrder ?? null,
            isActive: form.isActive,
            createdAt: loadedServicesMenu?.createdAt ?? '',
            updatedAt: loadedServicesMenu?.updatedAt ?? '',
          }

      setLoadedServicesMenu(servicesMenuRow)
      onSuccess(servicesMenuRow)
      onClose()
    } catch (err) {
      const message = err instanceof Error ? err.message : t('common.updateError')
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
          <h2 className="text-lg font-semibold">Edit Services Menu</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded p-1 text-gray-500 hover:bg-gray-100 hover:text-gray-700"
            aria-label="Close"
          >
            <i className="fa-solid fa-xmark" />
          </button>
        </div>

        {loading ? (
          <div className="py-8 text-center text-sm text-gray-500">Loading...</div>
        ) : (
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
                required
              />
            </div>

            <label className="flex items-center gap-2 text-sm text-gray-700">
              <input
                type="checkbox"
                name="isActive"
                checked={form.isActive}
                onChange={handleChange}
                className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              Active
            </label>
          </div>
        )}

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
            disabled={submitting || loading}
          >
            {submitting ? 'Saving...' : 'Save'}
          </button>
        </div>
      </form>
    </div>
  )
}
