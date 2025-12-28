'use client'

import { ChangeEvent, FormEvent, useEffect, useState } from 'react'

import type { VoucherRowData } from './VoucherRow'
import { mapVoucherApiItemToRow, type VoucherApiItem } from './voucherUtils'
import { useI18n } from '@/lib/i18n'

interface VoucherEditModalProps {
  voucherId: number
  onClose: () => void
  onSuccess: (voucher: VoucherRowData) => void
  isRewardOnly?: boolean
  hideMaxUsesPerCustomer?: boolean
}

interface FormState {
  code: string
  amount: string
  minOrderAmount: string
  maxUses: string
  maxUsesPerCustomer: string
  startAt: string
  endAt: string
  isActive: 'active' | 'inactive'
}

const initialFormState: FormState = {
  code: '',
  amount: '',
  minOrderAmount: '',
  maxUses: '',
  maxUsesPerCustomer: '',
  startAt: '',
  endAt: '',
  isActive: 'active',
}

export default function VoucherEditModal({
  voucherId,
  onClose,
  onSuccess,
  isRewardOnly,
  hideMaxUsesPerCustomer = false,
}: VoucherEditModalProps) {
  const { t } = useI18n()
  const [form, setForm] = useState<FormState>({ ...initialFormState })
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loadedVoucher, setLoadedVoucher] = useState<VoucherRowData | null>(null)

  useEffect(() => {
    const controller = new AbortController()

    const loadVoucher = async () => {
      setLoading(true)
      setError(null)
      try {
        const res = await fetch(`/api/proxy/ecommerce/vouchers/${voucherId}`, {
          cache: 'no-store',
          signal: controller.signal,
          headers: {
            Accept: 'application/json',
            'Accept-Language': 'en',
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
          if (data && typeof data === 'object' && 'message' in data) {
            const message = (data as { message?: unknown }).message
            if (typeof message === 'string') {
              setError(message)
              return
            }
          }
          setError('Failed to load voucher')
          return
        }

        const voucher = data?.data as VoucherApiItem | undefined
        if (!voucher || typeof voucher !== 'object') {
          setError('Failed to load voucher')
          return
        }

        const mappedVoucher = mapVoucherApiItemToRow(voucher)
        setLoadedVoucher(mappedVoucher)

        // Format dates for input fields (YYYY-MM-DD)
        // API returns dates in ISO format (e.g., "2024-12-31T16:00:00.000000Z")
        // We need to convert to YYYY-MM-DD for date input
        const formatDateForInput = (dateStr: string | null | undefined): string => {
          if (!dateStr) return ''
          try {
            const date = new Date(dateStr)
            if (isNaN(date.getTime())) return ''
            return date.toISOString().split('T')[0]
          } catch {
            return ''
          }
        }

        setForm({
          code: typeof voucher.code === 'string' ? voucher.code : '',
          amount: voucher.amount != null ? String(voucher.amount) : '',
          minOrderAmount: voucher.min_order_amount != null ? String(voucher.min_order_amount) : '',
          maxUses: voucher.max_uses != null ? String(voucher.max_uses) : '',
          maxUsesPerCustomer: voucher.max_uses_per_customer != null ? String(voucher.max_uses_per_customer) : '',
          startAt: formatDateForInput(voucher.start_at),
          endAt: formatDateForInput(voucher.end_at),
          isActive:
            voucher.is_active === true || voucher.is_active === 'true' || voucher.is_active === 1
              ? 'active'
              : 'inactive',
        })
      } catch (err) {
        if (!(err instanceof DOMException && err.name === 'AbortError')) {
          setError('Failed to load voucher')
        }
      } finally {
        setLoading(false)
      }
    }

    loadVoucher().catch(() => {
      setLoading(false)
      setError('Failed to load voucher')
    })

    return () => controller.abort()
  }, [voucherId])

  const handleChange = (
    event: ChangeEvent<HTMLInputElement | HTMLSelectElement>,
  ) => {
    const { name, value } = event.target
    setForm((prev) => ({ ...prev, [name]: value }))
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    const trimmedCode = form.code.trim()
    const amountNum = parseFloat(form.amount)
    const minOrderAmountNum = parseFloat(form.minOrderAmount)
    const maxUsesNum = form.maxUses.trim() ? parseInt(form.maxUses, 10) : undefined
    const maxUsesPerCustomerNum = form.maxUsesPerCustomer.trim()
      ? parseInt(form.maxUsesPerCustomer, 10)
      : undefined

    if (
      !trimmedCode ||
      !Number.isFinite(amountNum) ||
      !Number.isFinite(minOrderAmountNum) ||
      !form.startAt ||
      !form.endAt
    ) {
      setError(t('common.allFieldsRequired'))
      return
    }
    if (maxUsesNum !== undefined && !Number.isFinite(maxUsesNum)) {
      setError(t('common.allFieldsRequired'))
      return
    }
    if (
      !hideMaxUsesPerCustomer &&
      maxUsesPerCustomerNum !== undefined &&
      !Number.isFinite(maxUsesPerCustomerNum)
    ) {
      setError(t('common.allFieldsRequired'))
      return
    }

    setSubmitting(true)
    setError(null)

    try {
      const res = await fetch(`/api/proxy/ecommerce/vouchers/${voucherId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          'Accept-Language': 'en',
        },
        body: JSON.stringify({
          code: trimmedCode,
          type: 'fixed',
          amount: amountNum,
          min_order_amount: minOrderAmountNum,
          ...(maxUsesNum !== undefined ? { max_uses: maxUsesNum } : {}),
          ...(!hideMaxUsesPerCustomer && maxUsesPerCustomerNum !== undefined
            ? { max_uses_per_customer: maxUsesPerCustomerNum }
            : {}),
          start_at: form.startAt,
          end_at: form.endAt,
          is_active: form.isActive === 'active',
          ...(isRewardOnly !== undefined ? { is_reward_only: isRewardOnly } : {}),
        }),
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
        setError('Failed to update voucher')
        return
      }

      const payloadData =
        data && typeof data === 'object' && 'data' in data
          ? ((data as { data?: VoucherApiItem | null }).data ?? null)
          : null

      const voucherRow: VoucherRowData = payloadData
        ? mapVoucherApiItemToRow(payloadData)
        : {
            id: loadedVoucher?.id ?? voucherId,
            code: trimmedCode,
            type: 'fixed',
            amount: amountNum.toFixed(2),
            maxUses: maxUsesNum != null ? String(maxUsesNum) : '-',
            maxUsesPerCustomer: maxUsesPerCustomerNum != null ? String(maxUsesPerCustomerNum) : '-',
            minOrderAmount: minOrderAmountNum.toFixed(2),
            startAt: form.startAt,
            endAt: form.endAt,
            isActive: form.isActive === 'active',
          }

      setLoadedVoucher(voucherRow)
      onSuccess(voucherRow)
    } catch (err) {
      console.error(err)
      setError('Failed to update voucher')
    } finally {
      setSubmitting(false)
    }
  }

  const disableForm = loading || submitting

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div
        className="absolute inset-0 bg-black/50"
        onClick={() => {
          if (!submitting) onClose()
        }}
      />
      <div className="relative w-full max-w-lg mx-auto bg-white rounded-lg shadow-lg">
        <div className="flex items-center justify-between border-b border-gray-300 px-5 py-4">
          <h2 className="text-lg font-semibold">Edit Voucher</h2>
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
          {loading ? (
            <div className="py-8 text-center text-sm text-gray-500">{t('common.loadingDetails')}</div>
          ) : (
            <>
              <div>
                <label
                  htmlFor="edit-code"
                  className="block text-sm font-medium text-gray-700 mb-1"
                >
                  Code <span className="text-red-500">*</span>
                </label>
                <input
                  id="edit-code"
                  name="code"
                  type="text"
                  value={form.code}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Voucher code"
                  disabled={disableForm}
                />
              </div>

              <div>
                <label
                  htmlFor="edit-amount"
                  className="block text-sm font-medium text-gray-700 mb-1"
                >
                  Amount <span className="text-red-500">*</span>
                </label>
                <input
                  id="edit-amount"
                  name="amount"
                  type="number"
                  step="0.01"
                  min="0"
                  value={form.amount}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-blue-500 focus:border-blue-500"
                  placeholder="0.00"
                  disabled={disableForm}
                />
              </div>

              <div>
                <label
                  htmlFor="edit-minOrderAmount"
                  className="block text-sm font-medium text-gray-700 mb-1"
                >
                  Minimum Order Amount <span className="text-red-500">*</span>
                </label>
                <input
                  id="edit-minOrderAmount"
                  name="minOrderAmount"
                  type="number"
                  step="0.01"
                  min="0"
                  value={form.minOrderAmount}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-blue-500 focus:border-blue-500"
                  placeholder="0.00"
                  disabled={disableForm}
                />
              </div>

              <div>
                <label
                  htmlFor="edit-maxUses"
                  className="block text-sm font-medium text-gray-700 mb-1"
                >
                  Max Uses
                </label>
                <input
                  id="edit-maxUses"
                  name="maxUses"
                  type="number"
                  min="1"
                  value={form.maxUses}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-blue-500 focus:border-blue-500"
                  placeholder="100"
                  disabled={disableForm}
                />
              </div>

              {!hideMaxUsesPerCustomer && (
                <div>
                  <label
                    htmlFor="edit-maxUsesPerCustomer"
                    className="block text-sm font-medium text-gray-700 mb-1"
                  >
                    Max Uses Per Customer
                  </label>
                  <input
                    id="edit-maxUsesPerCustomer"
                    name="maxUsesPerCustomer"
                    type="number"
                    min="1"
                    value={form.maxUsesPerCustomer}
                    onChange={handleChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-blue-500 focus:border-blue-500"
                    placeholder="1"
                    disabled={disableForm}
                  />
                </div>
              )}

              <div>
                <label
                  htmlFor="edit-startAt"
                  className="block text-sm font-medium text-gray-700 mb-1"
                >
                  Start Date <span className="text-red-500">*</span>
                </label>
                <input
                  id="edit-startAt"
                  name="startAt"
                  type="date"
                  value={form.startAt}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-blue-500 focus:border-blue-500"
                  disabled={disableForm}
                />
              </div>

              <div>
                <label
                  htmlFor="edit-endAt"
                  className="block text-sm font-medium text-gray-700 mb-1"
                >
                  End Date <span className="text-red-500">*</span>
                </label>
                <input
                  id="edit-endAt"
                  name="endAt"
                  type="date"
                  value={form.endAt}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-blue-500 focus:border-blue-500"
                  disabled={disableForm}
                />
              </div>

              <div>
                <label
                  htmlFor="edit-isActive"
                  className="block text-sm font-medium text-gray-700 mb-1"
                >
                  Status <span className="text-red-500">*</span>
                </label>
                <select
                  id="edit-isActive"
                  name="isActive"
                  value={form.isActive}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-blue-500 focus:border-blue-500"
                  disabled={disableForm}
                >
                  <option value="active">{t('common.active')}</option>
                  <option value="inactive">{t('common.inactive')}</option>
                </select>
              </div>
            </>
          )}

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
              disabled={disableForm}
            >
              {submitting ? t('common.saving') : t('common.save')}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
