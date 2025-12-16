'use client'

import { ChangeEvent, FormEvent, useEffect, useState } from 'react'

import type { MembershipRowData } from './MembershipRow'
import { mapMembershipApiItemToRow, type MembershipApiItem } from './membershipUtils'
import { useI18n } from '@/lib/i18n'

interface MembershipEditModalProps {
  membershipId: number
  onClose: () => void
  onSuccess: (membership: MembershipRowData) => void
}

interface FormState {
  displayName: string
  minSpentLastXMonths: string
  monthsWindow: string
  multiplier: string
  productDiscountPercent: string
  isActive: 'active' | 'inactive'
}

const initialFormState: FormState = {
  displayName: '',
  minSpentLastXMonths: '0',
  monthsWindow: '6',
  multiplier: '1.00',
  productDiscountPercent: '0',
  isActive: 'active',
}

export default function MembershipEditModal({
  membershipId,
  onClose,
  onSuccess,
}: MembershipEditModalProps) {
  const { t } = useI18n()
  const [form, setForm] = useState<FormState>({ ...initialFormState })
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loadedMembership, setLoadedMembership] = useState<MembershipRowData | null>(null)

  useEffect(() => {
    const controller = new AbortController()

    const loadMembership = async () => {
      setLoading(true)
      setError(null)
      try {
        const res = await fetch(`/api/proxy/ecommerce/membership-tiers/${membershipId}`, {
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
          setError('Failed to load membership tier')
          return
        }

        const membership = data?.data as MembershipApiItem | undefined
        if (!membership || typeof membership !== 'object') {
          setError('Failed to load membership tier')
          return
        }

        const mappedMembership = mapMembershipApiItemToRow(membership)
        setLoadedMembership(mappedMembership)

        setForm({
          displayName: mappedMembership.displayName || '',
          minSpentLastXMonths: mappedMembership.minSpent || '0',
          monthsWindow: String(mappedMembership.monthsWindow || 6),
          multiplier: mappedMembership.multiplier || '1.00',
          productDiscountPercent: mappedMembership.discountPercent || '0',
          isActive: mappedMembership.isActive ? 'active' : 'inactive',
        })
      } catch (err) {
        if (!(err instanceof DOMException && err.name === 'AbortError')) {
          setError('Failed to load membership tier')
        }
      } finally {
        setLoading(false)
      }
    }

    loadMembership().catch(() => {
      setLoading(false)
      setError('Failed to load membership tier')
    })

    return () => controller.abort()
  }, [membershipId])

  const handleChange = (
    event: ChangeEvent<HTMLInputElement | HTMLSelectElement>,
  ) => {
    const { name, value } = event.target
    setForm((prev) => ({ ...prev, [name]: value }))
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    const trimmedDisplayName = form.displayName.trim()
    const minSpent = Number.parseFloat(form.minSpentLastXMonths) || 0
    const monthsWindow = Number.parseInt(form.monthsWindow, 10) || 6
    const multiplier = Number.parseFloat(form.multiplier) || 1.0
    const discountPercent = Number.parseFloat(form.productDiscountPercent) || 0

    if (!trimmedDisplayName) {
      setError(t('common.allFieldsRequired'))
      return
    }

    setSubmitting(true)
    setError(null)

    try {
      const payload: Record<string, unknown> = {
        display_name: trimmedDisplayName,
        min_spent_last_x_months: minSpent,
        months_window: monthsWindow,
        multiplier: multiplier,
        product_discount_percent: discountPercent,
        is_active: form.isActive === 'active',
      }

      const res = await fetch(`/api/proxy/ecommerce/membership-tiers/${membershipId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          'Accept-Language': 'en',
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
        setError('Failed to update membership tier')
        return
      }

      const payloadData =
        data && typeof data === 'object' && 'data' in data
          ? ((data as { data?: MembershipApiItem | null }).data ?? null)
          : null

      const membershipRow: MembershipRowData = payloadData
        ? mapMembershipApiItemToRow(payloadData)
        : {
            id: loadedMembership?.id ?? membershipId,
            tier: loadedMembership?.tier ?? '',
            displayName: trimmedDisplayName,
            description: loadedMembership?.description ?? '',
            minSpent: minSpent.toFixed(2),
            monthsWindow: monthsWindow,
            multiplier: multiplier.toFixed(2),
            discountPercent: discountPercent.toFixed(2),
            isActive: form.isActive === 'active',
            sortOrder: loadedMembership?.sortOrder ?? 0,
            createdAt: loadedMembership?.createdAt ?? '',
            updatedAt: new Date().toISOString(),
          }

      setLoadedMembership(membershipRow)
      onSuccess(membershipRow)
    } catch (err) {
      console.error(err)
      setError('Failed to update membership tier')
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
      <div className="relative w-full max-w-lg mx-auto bg-white rounded-lg shadow-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between border-b border-gray-300 px-5 py-4">
          <h2 className="text-lg font-semibold">Edit Membership Tier</h2>
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
                  htmlFor="edit-displayName"
                  className="block text-sm font-medium text-gray-700 mb-1"
                >
                  Display Name <span className="text-red-500">*</span>
                </label>
                <input
                  id="edit-displayName"
                  name="displayName"
                  type="text"
                  value={form.displayName}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Display Name"
                  disabled={disableForm}
                />
              </div>

              <div>
                <label
                  htmlFor="edit-minSpentLastXMonths"
                  className="block text-sm font-medium text-gray-700 mb-1"
                >
                  Min Spent Last X Months
                </label>
                <input
                  id="edit-minSpentLastXMonths"
                  name="minSpentLastXMonths"
                  type="number"
                  step="0.01"
                  value={form.minSpentLastXMonths}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-blue-500 focus:border-blue-500"
                  placeholder="0.00"
                  disabled={disableForm}
                />
              </div>

              <div>
                <label
                  htmlFor="edit-monthsWindow"
                  className="block text-sm font-medium text-gray-700 mb-1"
                >
                  Months Window
                </label>
                <input
                  id="edit-monthsWindow"
                  name="monthsWindow"
                  type="number"
                  value={form.monthsWindow}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-blue-500 focus:border-blue-500"
                  placeholder="6"
                  disabled={disableForm}
                />
              </div>

              <div>
                <label
                  htmlFor="edit-multiplier"
                  className="block text-sm font-medium text-gray-700 mb-1"
                >
                  Multiplier
                </label>
                <input
                  id="edit-multiplier"
                  name="multiplier"
                  type="number"
                  step="0.01"
                  value={form.multiplier}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-blue-500 focus:border-blue-500"
                  placeholder="1.00"
                  disabled={disableForm}
                />
              </div>

              <div>
                <label
                  htmlFor="edit-productDiscountPercent"
                  className="block text-sm font-medium text-gray-700 mb-1"
                >
                  Product Discount Percent
                </label>
                <input
                  id="edit-productDiscountPercent"
                  name="productDiscountPercent"
                  type="number"
                  step="0.01"
                  value={form.productDiscountPercent}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-blue-500 focus:border-blue-500"
                  placeholder="0.00"
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

