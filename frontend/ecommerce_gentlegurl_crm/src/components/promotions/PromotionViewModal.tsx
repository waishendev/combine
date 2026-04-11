'use client'

import { useEffect, useState, type Dispatch, type SetStateAction } from 'react'

import PromotionFormContent from './PromotionFormContent'
import {
  fetchPromotionProductOptions,
  promotionApiItemToFormState,
  type ProductOption,
  type PromotionApiItem,
  type PromotionFormState,
} from './promotionUtils'
import { useI18n } from '@/lib/i18n'

interface PromotionViewModalProps {
  promotionId: number
  onClose: () => void
}

export default function PromotionViewModal({
  promotionId,
  onClose,
}: PromotionViewModalProps) {
  const { t } = useI18n()
  const [form, setForm] = useState<PromotionFormState | null>(null)
  const [products, setProducts] = useState<ProductOption[]>([])
  const [loading, setLoading] = useState(true)
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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div
        className="absolute inset-0 bg-black/50"
        onClick={() => {
          if (!loading) onClose()
        }}
      />
      <div className="relative mx-4 max-h-[90vh] w-full max-w-6xl overflow-y-auto rounded-lg bg-white shadow-lg">
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-gray-300 bg-white px-5 py-4">
          <h2 className="text-lg font-semibold text-gray-900">
            Promotion details
          </h2>
          <button
            type="button"
            onClick={() => {
              if (!loading) onClose()
            }}
            className="text-2xl leading-none text-gray-500 hover:text-gray-700"
            aria-label={t('common.close')}
          >
            <i className="fa-solid fa-xmark" />
          </button>
        </div>

        <div className="p-5">
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
              setForm={
                setForm as Dispatch<SetStateAction<PromotionFormState>>
              }
              products={products}
              isReadOnly
            />
          )}
        </div>

        <div className="flex justify-end border-t border-gray-200 px-5 py-4">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
          >
            {t('common.close')}
          </button>
        </div>
      </div>
    </div>
  )
}
