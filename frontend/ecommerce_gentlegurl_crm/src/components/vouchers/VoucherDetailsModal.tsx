'use client'

import { useEffect, useMemo, useState } from 'react'

type VoucherDetailsModalProps = {
  voucherId: number
  onClose: () => void
}

type VoucherDetail = {
  id: number
  code?: string | null
  type?: string | null
  value?: string | number | null
  min_order_amount?: string | number | null
  start_at?: string | null
  end_at?: string | null
  scope_type?: string | null
  products?: Array<{ id: number; name?: string | null; sku?: string | null }>
  categories?: Array<{ id: number; name?: string | null }>
}

const scopeLabels: Record<string, string> = {
  all: 'Storewide',
  products: 'Specific Products',
  categories: 'Specific Categories',
}

const formatAmount = (value?: string | number | null) => {
  if (value == null || value === '') return 'N/A'
  const parsed = typeof value === 'string' ? Number.parseFloat(value) : value
  if (!Number.isFinite(parsed)) return String(value)
  return parsed.toFixed(2)
}

export default function VoucherDetailsModal({
  voucherId,
  onClose,
}: VoucherDetailsModalProps) {
  const [voucher, setVoucher] = useState<VoucherDetail | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const controller = new AbortController()
    const fetchVoucher = async () => {
      setLoading(true)
      setError(null)
      try {
        const res = await fetch(`/api/proxy/ecommerce/vouchers/${voucherId}`, {
          cache: 'no-store',
          signal: controller.signal,
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
          setError('Unable to load voucher details.')
          return
        }

        const payload =
          data && typeof data === 'object' && 'data' in data
            ? ((data as { data?: VoucherDetail | null }).data ?? null)
            : null

        setVoucher(payload)
      } catch (err) {
        if (!(err instanceof DOMException && err.name === 'AbortError')) {
          setError('Unable to load voucher details.')
        }
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false)
        }
      }
    }

    fetchVoucher()
    return () => controller.abort()
  }, [voucherId])

  const scopeLabel = scopeLabels[voucher?.scope_type ?? 'all'] ?? 'Storewide'
  const discountLabel = useMemo(() => {
    if (!voucher) return 'N/A'
    const value = voucher.value ?? 0
    if (voucher.type === 'percent') {
      return `${value}%`
    }
    return `RM ${formatAmount(value)}`
  }, [voucher])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div
        className="absolute inset-0 bg-black/50"
        onClick={() => onClose()}
      />
      <div className="relative w-full max-w-2xl mx-auto bg-white rounded-lg shadow-lg">
        <div className="flex items-center justify-between border-b border-gray-300 px-5 py-4">
          <div>
            <h2 className="text-lg font-semibold">Voucher Details</h2>
            <p className="text-xs text-gray-500">{voucher?.code ?? 'Voucher'}</p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 text-2xl leading-none"
            aria-label="Close"
            type="button"
          >
            <i className="fa-solid fa-xmark" />
          </button>
        </div>

        <div className="px-5 py-4 space-y-4">
          {loading ? (
            <p className="text-sm text-gray-500">Loading voucher details...</p>
          ) : error ? (
            <p className="text-sm text-red-600">{error}</p>
          ) : voucher ? (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-xs text-gray-500">Discount</p>
                  <p className="font-semibold">{discountLabel}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Min Spend</p>
                  <p className="font-semibold">RM {formatAmount(voucher.min_order_amount)}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Start Date</p>
                  <p className="font-semibold">{voucher.start_at ?? '-'}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">End Date</p>
                  <p className="font-semibold">{voucher.end_at ?? '-'}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Scope Type</p>
                  <span className="inline-flex rounded-full bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-700">
                    {scopeLabel}
                  </span>
                </div>
              </div>

              {voucher.scope_type === 'products' && (
                <div>
                  <p className="text-sm font-semibold text-gray-700">Eligible Products</p>
                  <ul className="mt-2 space-y-1 text-sm text-gray-600">
                    {voucher.products && voucher.products.length > 0 ? (
                      voucher.products.map((product) => (
                        <li key={product.id} className="flex items-center justify-between gap-3">
                          <span>{product.name ?? 'Unnamed product'}</span>
                          <span className="text-xs text-gray-400">{product.sku ?? '-'}</span>
                        </li>
                      ))
                    ) : (
                      <li>No products assigned.</li>
                    )}
                  </ul>
                </div>
              )}

              {voucher.scope_type === 'categories' && (
                <div>
                  <p className="text-sm font-semibold text-gray-700">Eligible Categories</p>
                  <ul className="mt-2 space-y-1 text-sm text-gray-600">
                    {voucher.categories && voucher.categories.length > 0 ? (
                      voucher.categories.map((category) => (
                        <li key={category.id}>{category.name ?? 'Unnamed category'}</li>
                      ))
                    ) : (
                      <li>No categories assigned.</li>
                    )}
                  </ul>
                </div>
              )}
            </>
          ) : (
            <p className="text-sm text-gray-500">No voucher details available.</p>
          )}
        </div>
      </div>
    </div>
  )
}
