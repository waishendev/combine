'use client'

import { FormEvent, useEffect, useState } from 'react'

import PromotionFormContent from './PromotionFormContent'
import {
  emptyPromotionForm,
  fetchPromotionProductOptions,
  mapPromotionApiItemToRow,
  type ProductOption,
  type PromotionApiItem,
  type PromotionFormState,
  type PromotionRowData,
  validatePromotionForm,
} from './promotionUtils'
import { useI18n } from '@/lib/i18n'

interface PromotionCreateModalProps {
  onClose: () => void
  onSuccess: (row: PromotionRowData) => void
}

export default function PromotionCreateModal({
  onClose,
  onSuccess,
}: PromotionCreateModalProps) {
  const { t } = useI18n()
  const [form, setForm] = useState<PromotionFormState>(emptyPromotionForm())
  const [products, setProducts] = useState<ProductOption[]>([])
  const [loadingProducts, setLoadingProducts] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let ignore = false
    void (async () => {
      setLoadingProducts(true)
      try {
        const list = await fetchPromotionProductOptions()
        if (!ignore) setProducts(list)
      } finally {
        if (!ignore) setLoadingProducts(false)
      }
    })()
    return () => {
      ignore = true
    }
  }, [])

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    const validationError = validatePromotionForm(form)
    if (validationError) {
      setError(validationError)
      return
    }

    setSubmitting(true)
    setError(null)

    try {
      const res = await fetch('/api/proxy/ecommerce/promotions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.name.trim(),
          is_active: form.is_active,
          trigger_type: form.trigger_type,
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
      })

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
            : 'Failed to create promotion.'
        setError(msg)
        return
      }

      const created = json?.data as PromotionApiItem | undefined
      if (created && typeof created.id === 'number') {
        setForm(emptyPromotionForm())
        onSuccess(mapPromotionApiItemToRow(created))
        onClose()
        return
      }

      setError('Unexpected response from server.')
    } catch (e) {
      console.error(e)
      setError('Failed to create promotion.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div
        className="absolute inset-0 bg-black/50"
        onClick={() => {
          if (!submitting && !loadingProducts) onClose()
        }}
      />
      <div className="relative mx-4 max-h-[90vh] w-full max-w-6xl overflow-y-auto rounded-lg bg-white shadow-lg">
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-gray-300 bg-white px-5 py-4">
          <h2 className="text-lg font-semibold text-gray-900">
            Create promotion
          </h2>
          <button
            type="button"
            onClick={() => {
              if (!submitting && !loadingProducts) onClose()
            }}
            className="text-2xl leading-none text-gray-500 hover:text-gray-700"
            aria-label={t('common.close')}
          >
            <i className="fa-solid fa-xmark" />
          </button>
        </div>

        <form onSubmit={(e) => void handleSubmit(e)} className="p-5">
          {error ? (
            <div
              className="mb-4 rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"
              role="alert"
            >
              {error}
            </div>
          ) : null}

          {loadingProducts ? (
            <p className="text-sm text-gray-500">Loading products…</p>
          ) : (
            <PromotionFormContent
              form={form}
              setForm={setForm}
              products={products}
              isReadOnly={false}
              formDisabled={submitting}
            />
          )}

          <div className="mt-6 flex items-center justify-end gap-3 border-t border-gray-200 pt-4">
            <button
              type="button"
              className="rounded-md border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 disabled:opacity-50"
              onClick={() => {
                if (!submitting && !loadingProducts) onClose()
              }}
              disabled={submitting || loadingProducts}
            >
              {t('common.cancel')}
            </button>
            <button
              type="submit"
              disabled={submitting || loadingProducts}
              className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {submitting ? t('common.creating') : t('common.create')}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
