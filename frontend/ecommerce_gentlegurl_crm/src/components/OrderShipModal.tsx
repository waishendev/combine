'use client'

import { FormEvent, useState } from 'react'
import { useI18n } from '@/lib/i18n'

interface OrderShipModalProps {
  orderId: number
  onClose: () => void
  onSuccess: () => void
}

export default function OrderShipModal({
  orderId,
  onClose,
  onSuccess,
}: OrderShipModalProps) {
  const { t } = useI18n()
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [shippingCourier, setShippingCourier] = useState('')
  const [shippingTrackingNo, setShippingTrackingNo] = useState('')
  const [shippedAt, setShippedAt] = useState('')

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setSubmitting(true)
    setError(null)

    if (!shippingCourier.trim()) {
      setError('Shipping courier is required')
      setSubmitting(false)
      return
    }

    if (!shippingTrackingNo.trim()) {
      setError('Tracking number is required')
      setSubmitting(false)
      return
    }

    try {
      const payload: Record<string, unknown> = {
        status: 'shipped',
      }

      payload.shipping_courier = shippingCourier.trim()
      payload.shipping_tracking_no = shippingTrackingNo.trim()
      if (shippedAt.trim()) {
        payload.shipped_at = shippedAt.trim()
      } else {
        payload.shipped_at = new Date().toISOString()
      }

      const res = await fetch(`/api/proxy/ecommerce/orders/${orderId}`, {
        method: 'PUT',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
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
        setError('Failed to update shipping information')
        return
      }

      onSuccess()
      onClose()
    } catch (err) {
      console.error(err)
      setError('Failed to update shipping information')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/50"
        onClick={() => {
          if (!submitting) onClose()
        }}
      />
      <div className="relative w-full max-w-md mx-auto max-h-[calc(100vh-2rem)] overflow-y-auto bg-white rounded-lg shadow-lg">
        <div className="flex items-center justify-between border-b border-gray-300 px-5 py-4">
          <h2 className="text-lg font-semibold">Mark as Shipped</h2>
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

        <form onSubmit={handleSubmit} className="px-5 py-4 space-y-4">
          <div>
            <label htmlFor="shippingCourier" className="block text-sm font-medium text-gray-700 mb-1">
              Shipping Courier <span className="text-red-500">*</span>
            </label>
            <input
              id="shippingCourier"
              type="text"
              value={shippingCourier}
              onChange={(e) => setShippingCourier(e.target.value)}
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-blue-500 focus:border-blue-500"
              placeholder="e.g., DHL, FedEx, etc."
            />
          </div>

          <div>
            <label htmlFor="shippingTrackingNo" className="block text-sm font-medium text-gray-700 mb-1">
              Tracking Number <span className="text-red-500">*</span>
            </label>
            <input
              id="shippingTrackingNo"
              type="text"
              value={shippingTrackingNo}
              onChange={(e) => setShippingTrackingNo(e.target.value)}
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-blue-500 focus:border-blue-500"
              placeholder="Enter tracking number"
            />
          </div>

          <div>
            <label htmlFor="shippedAt" className="block text-sm font-medium text-gray-700 mb-1">
              Shipped At
            </label>
            <input
              id="shippedAt"
              type="datetime-local"
              value={shippedAt}
              onChange={(e) => setShippedAt(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

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
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 text-sm text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50"
              disabled={submitting}
            >
              {submitting ? 'Updating...' : 'Mark as Shipped'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
