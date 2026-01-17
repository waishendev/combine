'use client'

import { ChangeEvent, FormEvent, useEffect, useMemo, useState } from 'react'

import type { CustomerRowData } from './CustomerRow'
import { useI18n } from '@/lib/i18n'

interface AssignableVoucher {
  id: number
  code: string
  type: 'fixed' | 'percent' | string
  value: number | string
  min_order_amount?: number | string | null
  max_discount_amount?: number | string | null
  start_at?: string | null
  end_at?: string | null
  is_active?: boolean
}

interface CustomerAssignVoucherModalProps {
  customer: CustomerRowData
  onClose: () => void
  onAssigned: () => void
}

const toApiDateTime = (value: string) => {
  if (!value) return undefined
  if (value.includes('T')) {
    const [date, time] = value.split('T')
    if (!time) return undefined
    const normalizedTime = time.length === 5 ? `${time}:00` : time
    return `${date} ${normalizedTime}`
  }
  return value
}

const formatCurrency = (value?: number | string | null) => {
  if (value === null || value === undefined) return 'RM 0.00'
  const numberValue = Number(value)
  if (Number.isNaN(numberValue)) return String(value)
  return `RM ${numberValue.toFixed(2)}`
}

const formatDateLabel = (value?: string | null) => {
  if (!value) return 'No expiry'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'No expiry'
  return date.toLocaleDateString('en-MY', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}

export default function CustomerAssignVoucherModal({
  customer,
  onClose,
  onAssigned,
}: CustomerAssignVoucherModalProps) {
  const { t } = useI18n()
  const [search, setSearch] = useState('')
  const [vouchers, setVouchers] = useState<AssignableVoucher[]>([])
  const [loading, setLoading] = useState(false)
  const [selectedVoucherId, setSelectedVoucherId] = useState<number | null>(null)
  const [quantity, setQuantity] = useState(1)
  const [note, setNote] = useState('')
  const [startAt, setStartAt] = useState('')
  const [endAt, setEndAt] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const controller = new AbortController()
    setLoading(true)

    const timeout = setTimeout(async () => {
      try {
        const params = new URLSearchParams()
        params.set('status', 'active')
        if (search.trim()) params.set('search', search.trim())

        const res = await fetch(`/api/proxy/ecommerce/vouchers/assignable?${params.toString()}`,
          {
            cache: 'no-store',
            signal: controller.signal,
          },
        )

        if (!res.ok) {
          setVouchers([])
          return
        }

        const data = await res.json().catch(() => null)
        const list = data && typeof data === 'object' && 'data' in data
          ? (data as { data?: AssignableVoucher[] }).data ?? []
          : []
        setVouchers(Array.isArray(list) ? list : [])
      } catch (fetchError) {
        if (!(fetchError instanceof DOMException && fetchError.name === 'AbortError')) {
          setVouchers([])
        }
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false)
        }
      }
    }, 250)

    return () => {
      controller.abort()
      clearTimeout(timeout)
    }
  }, [search])

  const voucherOptions = useMemo(() => {
    const now = Date.now()
    return vouchers.map((voucher) => {
      const endAt = voucher.end_at ? new Date(voucher.end_at) : null
      const isExpired = endAt ? endAt.getTime() < now : false
      const isInactive = voucher.is_active === false
      return {
        voucher,
        isSelectable: !isExpired && !isInactive,
        isExpired,
      }
    })
  }, [vouchers])

  const selectedVoucher = vouchers.find((voucher) => voucher.id === selectedVoucherId) ?? null

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError(null)

    if (!selectedVoucherId) {
      setError('Please select a voucher.')
      return
    }

    const payload = {
      voucher_id: selectedVoucherId,
      quantity: quantity > 0 ? quantity : 1,
      note: note.trim() || undefined,
      start_at: startAt ? toApiDateTime(startAt) : undefined,
      end_at: endAt ? toApiDateTime(endAt) : undefined,
    }

    setSubmitting(true)

    try {
      const res = await fetch(`/api/proxy/ecommerce/customers/${customer.id}/vouchers/assign`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify(payload),
      })

      const data = await res.json().catch(() => null)

      if (!res.ok) {
        let message = 'Unable to assign voucher.'
        if (data && typeof data === 'object') {
          if (typeof (data as { message?: unknown }).message === 'string') {
            message = (data as { message: string }).message
          } else if ('errors' in data) {
            const errors = (data as { errors?: Record<string, string[] | string> }).errors
            const firstKey = errors ? Object.keys(errors)[0] : null
            const firstValue = firstKey ? errors?.[firstKey] : null
            if (Array.isArray(firstValue)) {
              message = firstValue[0]
            } else if (typeof firstValue === 'string') {
              message = firstValue
            }
          }
        }
        setError(message)
        return
      }

      onAssigned()
    } catch (submitError) {
      console.error(submitError)
      setError('Unable to assign voucher.')
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
      <div className="relative w-full max-w-2xl mx-auto bg-white rounded-lg shadow-lg">
        <div className="flex items-center justify-between border-b border-gray-300 px-5 py-4">
          <div>
            <h2 className="text-lg font-semibold">Assign Voucher</h2>
            <p className="text-xs text-gray-500">Assign a voucher to {customer.name}</p>
          </div>
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
            <label className="block text-sm font-medium text-gray-700 mb-2" htmlFor="voucher-search">
              Voucher
            </label>
            <input
              id="voucher-search"
              type="text"
              value={search}
              onChange={(event: ChangeEvent<HTMLInputElement>) => setSearch(event.target.value)}
              className="w-full mb-3 px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-blue-500 focus:border-blue-500"
              placeholder="Search voucher code"
              disabled={loading || submitting}
            />
            <select
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-blue-500 focus:border-blue-500"
              value={selectedVoucherId ?? ''}
              onChange={(event) => setSelectedVoucherId(Number(event.target.value) || null)}
              disabled={loading || submitting}
            >
              <option value="">{loading ? 'Loading vouchers...' : 'Select a voucher'}</option>
              {voucherOptions.map(({ voucher, isSelectable, isExpired }) => (
                <option key={voucher.id} value={voucher.id} disabled={!isSelectable}>
                  {voucher.code} {isExpired ? '(Expired)' : ''}
                </option>
              ))}
            </select>
          </div>

          {selectedVoucher && (
            <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm">
              <div className="flex flex-wrap gap-4">
                <div>
                  <p className="text-xs text-slate-500">Code</p>
                  <p className="font-medium text-slate-900">{selectedVoucher.code}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500">Discount</p>
                  <p className="font-medium text-slate-900">
                    {selectedVoucher.type === 'percent'
                      ? `${Number(selectedVoucher.value)}%`
                      : formatCurrency(selectedVoucher.value)}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-slate-500">Min Spend</p>
                  <p className="font-medium text-slate-900">
                    {formatCurrency(selectedVoucher.min_order_amount)}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-slate-500">Expires</p>
                  <p className="font-medium text-slate-900">
                    {formatDateLabel(selectedVoucher.end_at)}
                  </p>
                </div>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="quantity">
                Quantity
              </label>
              <input
                id="quantity"
                type="number"
                min={1}
                value={quantity}
                onChange={(event) => setQuantity(Math.max(1, Number(event.target.value) || 1))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-blue-500 focus:border-blue-500"
                disabled={submitting}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="note">
                Note (optional)
              </label>
              <input
                id="note"
                type="text"
                value={note}
                onChange={(event) => setNote(event.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-blue-500 focus:border-blue-500"
                disabled={submitting}
                placeholder="Reason or remark"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="start-at">
                Start at (optional)
              </label>
              <input
                id="start-at"
                type="datetime-local"
                value={startAt}
                onChange={(event) => setStartAt(event.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-blue-500 focus:border-blue-500"
                disabled={submitting}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="end-at">
                End at (optional)
              </label>
              <input
                id="end-at"
                type="datetime-local"
                value={endAt}
                onChange={(event) => setEndAt(event.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-blue-500 focus:border-blue-500"
                disabled={submitting}
              />
            </div>
          </div>

          {error && (
            <div className="text-sm text-red-600" role="alert">
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
              type="submit"
              className="px-4 py-2 text-sm text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50"
              disabled={submitting}
            >
              {submitting ? 'Assigning...' : 'Assign'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
