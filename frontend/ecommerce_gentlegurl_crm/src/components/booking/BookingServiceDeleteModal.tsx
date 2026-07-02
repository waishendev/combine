'use client'

import { useEffect, useState } from 'react'

import type { BookingServiceRowData } from './BookingServiceRow'
import type { LinkedBookingProductSummary } from './BookingServiceProductLinkPanel'
import { useI18n } from '@/lib/i18n'

interface BookingServiceDeleteModalProps {
  service: BookingServiceRowData
  onClose: () => void
  onDeleted: (serviceId: number) => void
}

export default function BookingServiceDeleteModal({
  service,
  onClose,
  onDeleted,
}: BookingServiceDeleteModalProps) {
  const { t } = useI18n()
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [deleteLinkedProduct, setDeleteLinkedProduct] = useState(false)
  const [linkedProduct, setLinkedProduct] = useState<LinkedBookingProductSummary | null>(null)
  const [loadingLink, setLoadingLink] = useState(true)

  useEffect(() => {
    let ignore = false
    const controller = new AbortController()

    const loadLinkedProduct = async () => {
      setLoadingLink(true)
      try {
        const res = await fetch(`/api/proxy/admin/booking/services/${service.id}`, {
          cache: 'no-store',
          signal: controller.signal,
          headers: { Accept: 'application/json' },
        })
        const data = await res.json().catch(() => null)
        if (ignore || !res.ok) return

        const linked = (data as { data?: { linked_booking_product?: LinkedBookingProductSummary | null } } | null)?.data
          ?.linked_booking_product
        if (linked && typeof linked === 'object' && Number(linked.id) > 0) {
          setLinkedProduct({
            id: Number(linked.id),
            name: String(linked.name ?? ''),
            cn_name: linked.cn_name ?? null,
            price: linked.price != null ? Number(linked.price) : undefined,
            is_active: linked.is_active !== false,
          })
          setDeleteLinkedProduct(true)
        } else {
          setLinkedProduct(null)
          setDeleteLinkedProduct(false)
        }
      } catch {
        if (!ignore) {
          setLinkedProduct(null)
          setDeleteLinkedProduct(false)
        }
      } finally {
        if (!ignore) setLoadingLink(false)
      }
    }

    void loadLinkedProduct()
    return () => {
      ignore = true
      controller.abort()
    }
  }, [service.id])

  const handleDelete = async () => {
    setSubmitting(true)
    setError(null)

    try {
      const params = new URLSearchParams()
      if (deleteLinkedProduct && linkedProduct) {
        params.set('delete_linked_product', '1')
      }

      const url =
        params.size > 0
          ? `/api/proxy/admin/booking/services/${service.id}?${params.toString()}`
          : `/api/proxy/admin/booking/services/${service.id}`

      const res = await fetch(url, {
        method: 'DELETE',
        headers: {
          Accept: 'application/json',
        },
      })

      const data = await res.json().catch(() => null)
      if (data && typeof data === 'object') {
        if (data?.success === false && data?.message === 'Unauthorized') {
          window.location.replace('/dashboard')
          return
        }
      }

      if (!res.ok) {
        if (data && typeof data === 'object') {
          if ('message' in data && typeof data.message === 'string') {
            setError(data.message)
            return
          }
          if ('errors' in data && typeof data.errors === 'object') {
            const errors = data.errors as Record<string, unknown>
            const firstKey = Object.keys(errors)[0]
            if (firstKey) {
              const firstValue = errors[firstKey]
              if (Array.isArray(firstValue) && typeof firstValue[0] === 'string') {
                setError(firstValue[0])
                return
              }
              if (typeof firstValue === 'string') {
                setError(firstValue)
                return
              }
            }
          }
        }
        setError('Failed to delete booking service')
        return
      }

      onDeleted(service.id)
    } catch (err) {
      console.error(err)
      setError('Failed to delete booking service')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div
        className="absolute inset-0 bg-black/50"
        onClick={() => {
          if (!submitting) onClose()
        }}
      />
      <div className="relative w-full max-w-md mx-auto bg-white rounded-lg shadow-lg">
        <div className="flex items-center justify-between border-b border-gray-300 px-5 py-4">
          <h2 className="text-lg font-semibold">Delete Booking Service</h2>
          <button
            onClick={() => {
              if (!submitting) onClose()
            }}
            className="text-gray-500 hover:text-gray-700 text-2xl leading-none"
            aria-label={t('common.close')}
            type="button"
          >
            <i className="fa-solid fa-xmark" />
          </button>
        </div>

        <div className="px-5 py-4 space-y-4">
          <p className="text-sm text-gray-700">Are you sure you want to delete this booking service? This action cannot be undone.</p>
          <div className="rounded-md bg-yellow-100 px-4 py-3">
            <p className="text-sm font-semibold text-yellow-800">{service.name}</p>
            {service.description && (
              <p className="text-xs text-yellow-800">{service.description}</p>
            )}
          </div>

          {!loadingLink && linkedProduct ? (
            <label className="flex items-start gap-2 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900">
              <input
                type="checkbox"
                checked={deleteLinkedProduct}
                onChange={(event) => setDeleteLinkedProduct(event.target.checked)}
                disabled={submitting}
                className="mt-1"
              />
              <span>
                <span className="font-medium">Also delete linked booking product</span>
                <span className="mt-1 block text-xs">
                  {linkedProduct.name}
                  {linkedProduct.cn_name ? ` (${linkedProduct.cn_name})` : ''}
                </span>
              </span>
            </label>
          ) : null}

          {error && (
            <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700" role="alert">
              {error}
            </div>
          )}

          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              className="px-4 py-2 text-sm text-gray-700 border border-gray-300 rounded-md hover:bg-gray-100 disabled:opacity-50"
              onClick={() => {
                if (!submitting) onClose()
              }}
              disabled={submitting}
            >
              {t('common.cancel')}
            </button>
            <button
              type="button"
              className="px-4 py-2 text-sm text-white bg-red-600 rounded-md hover:bg-red-700 disabled:opacity-50"
              onClick={handleDelete}
              disabled={submitting || loadingLink}
            >
              {submitting ? 'Deleting...' : t('common.delete')}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
