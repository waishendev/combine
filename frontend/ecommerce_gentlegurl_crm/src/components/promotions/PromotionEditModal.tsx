'use client'

import { useEffect, useState, type Dispatch, type SetStateAction } from 'react'

import PromotionFormContent from './PromotionFormContent'
import {
  fetchPromotionProductOptions,
  mapPromotionApiItemToRow,
  promotionApiItemToFormState,
  type ProductOption,
  type PromotionApiItem,
  type PromotionFormState,
  type PromotionRowData,
  validatePromotionForm,
} from './promotionUtils'
import { useI18n } from '@/lib/i18n'

interface PromotionEditModalProps {
  promotionId: number
  onClose: () => void
  onSuccess: (row: PromotionRowData) => void
}

export default function PromotionEditModal({
  promotionId,
  onClose,
  onSuccess,
}: PromotionEditModalProps) {
  const { t } = useI18n()
  const [form, setForm] = useState<PromotionFormState | null>(null)
  const [products, setProducts] = useState<ProductOption[]>([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let ignore = false

    void (async () => {
      setLoading(true)
      setError(null)
      try {
        const [promotionRes, productList] = await Promise.all([
          fetch(`/api/proxy/ecommerce/promotions/${promotionId}`, {
            cache: 'no-store',
          }),
          fetchPromotionProductOptions(promotionId),
        ])

        const json = await promotionRes.json().catch(() => null)
        if (json && typeof json === 'object') {
          if (json?.success === false && json?.message === 'Unauthorized') {
            window.location.replace('/dashboard')
            return
          }
        }

        if (!promotionRes.ok) {
          if (!ignore) {
            setError(
              typeof json?.message === 'string'
                ? json.message
                : 'Failed to load promotion.',
            )
            setForm(null)
          }
          return
        }

        const item = json?.data as PromotionApiItem | undefined
        if (!item || typeof item.id !== 'number') {
          if (!ignore) {
            setError('Invalid promotion data.')
            setForm(null)
          }
          return
        }

        if (!ignore) {
          setForm(promotionApiItemToFormState(item))
          setProducts(productList)
        }
      } catch (e) {
        console.error(e)
        if (!ignore) setError('Failed to load promotion.')
      } finally {
        if (!ignore) setLoading(false)
      }
    })()

    return () => {
      ignore = true
    }
  }, [promotionId])

  const handleSubmit = async () => {
    if (!form) return
    const validationError = validatePromotionForm(form)
    if (validationError) {
      setError(validationError)
      return
    }

    setSubmitting(true)
    setError(null)

    try {
      const res = await fetch(
        `/api/proxy/ecommerce/promotions/${promotionId}`,
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: form.name.trim(),
            is_active: form.is_active,
            trigger_type: form.trigger_type,
            promotion_type: form.promotion_type,
            product_ids: form.product_ids,
            tiers: form.tiers.map((tier) => ({
              min_qty:
                form.trigger_type === 'quantity' ? tier.min_qty ?? null : null,
              min_amount:
                form.trigger_type === 'amount' ? tier.min_amount ?? null : null,
              discount_type: tier.discount_type,
              discount_value: tier.discount_value,
            })),
          }),
        },
      )

      const json = await res.json().catch(() => null)
      if (json && typeof json === 'object') {
        if (json?.success === false && json?.message === 'Unauthorized') {
          window.location.replace('/dashboard')
          return
        }
      }

      if (!res.ok) {
        const msg =
          typeof json?.message === 'string'
            ? json.message
            : 'Failed to update promotion.'
        setError(msg)
        return
      }

      const updated = json?.data as PromotionApiItem | undefined
      if (updated && typeof updated.id === 'number') {
        onSuccess(mapPromotionApiItemToRow(updated))
        onClose()
        return
      }

      setError('Unexpected response from server.')
    } catch (e) {
      console.error(e)
      setError('Failed to update promotion.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative max-h-[90vh] w-full max-w-5xl overflow-auto rounded-lg bg-white shadow-xl">
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-gray-200 bg-white px-5 py-4">
          <h2 className="text-lg font-semibold text-gray-900">
            {t('common.edit')} promotion
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 text-2xl leading-none"
            aria-label={t('common.close')}
          >
            <i className="fa-solid fa-xmark" />
          </button>
        </div>

        <div className="p-5">
          {error && !loading ? (
            <p className="mb-4 rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </p>
          ) : null}

          {loading || !form ? (
            <p className="text-sm text-gray-500">Loading…</p>
          ) : (
            <PromotionFormContent
              form={form}
              setForm={
                setForm as Dispatch<SetStateAction<PromotionFormState>>
              }
              products={products}
              isReadOnly={false}
            />
          )}
        </div>

        <div className="sticky bottom-0 flex justify-end gap-2 border-t border-gray-200 bg-white px-5 py-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-gray-300 px-4 py-2 text-sm hover:bg-gray-50"
          >
            {t('common.cancel')}
          </button>
          <button
            type="button"
            disabled={submitting || loading || !form}
            onClick={() => void handleSubmit()}
            className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {submitting ? 'Saving…' : t('common.save')}
          </button>
        </div>
      </div>
    </div>
  )
}
