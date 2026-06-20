'use client'

import {
  FormEvent,
  useEffect,
  useState,
  type Dispatch,
  type SetStateAction,
} from 'react'

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
import CrmFormModalShell from '@/components/CrmFormModalShell'
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

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
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

  const closeDisabled = submitting || loading

  return (
    <CrmFormModalShell
      title={`${t('common.edit')} promotion`}
      size="lg"
      onClose={onClose}
      closeDisabled={closeDisabled}
      closeLabel={t('common.close')}
      footer={
        <>
          <button
            type="button"
            onClick={() => {
              if (!closeDisabled) onClose()
            }}
            disabled={closeDisabled || !form}
            className="rounded-md border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 disabled:opacity-50"
          >
            {t('common.cancel')}
          </button>
          <button
            type="submit"
            form="promotion-edit-form"
            disabled={closeDisabled || !form}
            className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {submitting ? t('common.saving') : t('common.save')}
          </button>
        </>
      }
    >
        <form id="promotion-edit-form" onSubmit={(e) => void handleSubmit(e)} className="p-5">
          {error && !loading ? (
            <div
              className="mb-4 rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"
              role="alert"
            >
              {error}
            </div>
          ) : null}

          {loading || !form ? (
            <p className="text-sm text-gray-500">Loading…</p>
          ) : (
            <PromotionFormContent
              form={form}
              setForm={setForm as Dispatch<SetStateAction<PromotionFormState>>}
              products={products}
              isReadOnly={false}
              formDisabled={submitting}
            />
          )}

        </form>
    </CrmFormModalShell>
  )
}
