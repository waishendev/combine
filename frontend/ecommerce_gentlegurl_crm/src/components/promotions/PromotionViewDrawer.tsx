'use client'

import { useEffect, useMemo, useState } from 'react'

import { DiscountTypeText, TriggerTypeText } from './discountTypeUi'
import {
  fetchPromotionProductOptions,
  formatPromotionDateTime,
  toNumber,
  type ProductOption,
  type PromotionApiItem,
  type TierApi,
} from './promotionUtils'
import { useI18n } from '@/lib/i18n'

interface PromotionViewDrawerProps {
  promotionId: number
  onClose: () => void
}

type SelectedProductRow = {
  id: number
  name: string
  coverUrl: string | null | undefined
}

function ProductThumbRow({ name, coverUrl }: SelectedProductRow) {
  const [imgFailed, setImgFailed] = useState(false)
  const showImg = Boolean(coverUrl) && !imgFailed

  return (
    <div className="flex items-center gap-3 rounded-lg border border-gray-200 bg-white px-3 py-2.5 shadow-sm">
      {showImg ? (
        <img
          src={coverUrl!}
          alt=""
          className="h-10 w-10 shrink-0 rounded-md border border-gray-100 object-cover"
          onError={() => setImgFailed(true)}
        />
      ) : (
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md border border-gray-200 bg-gray-50 text-gray-400">
          <i className="fa-solid fa-image text-xs" aria-hidden />
        </div>
      )}
      <span className="min-w-0 flex-1 text-sm font-medium leading-snug text-gray-900">
        {name}
      </span>
    </div>
  )
}

export default function PromotionViewDrawer({
  promotionId,
  onClose,
}: PromotionViewDrawerProps) {
  const { t } = useI18n()
  const [detail, setDetail] = useState<PromotionApiItem | null>(null)
  const [productOptions, setProductOptions] = useState<ProductOption[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [panelIn, setPanelIn] = useState(false)

  useEffect(() => {
    const id = requestAnimationFrame(() => setPanelIn(true))
    return () => cancelAnimationFrame(id)
  }, [])

  useEffect(() => {
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = ''
    }
  }, [])

  useEffect(() => {
    let ignore = false

    void (async () => {
      setLoading(true)
      setError(null)
      try {
        const [promotionRes, optionsList] = await Promise.all([
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
            setDetail(null)
          }
          return
        }

        const item = json?.data as PromotionApiItem | undefined
        if (!item || typeof item.id !== 'number') {
          if (!ignore) {
            setError('Invalid promotion data.')
            setDetail(null)
          }
          return
        }

        if (!ignore) {
          setDetail(item)
          setProductOptions(optionsList)
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

  const selectedProducts = useMemo((): SelectedProductRow[] => {
    if (!detail?.promotion_products?.length) return []
    const byId = new Map(productOptions.map((p) => [p.id, p]))
    return detail.promotion_products.map((row) => {
      const opt = byId.get(row.product_id)
      const name =
        opt?.name ??
        row.product?.name ??
        `Product #${row.product_id}`
      return {
        id: row.product_id,
        name,
        coverUrl: opt?.cover_image_url,
      }
    })
  }, [detail, productOptions])

  const tiers: TierApi[] = detail?.promotion_tiers?.length
    ? detail.promotion_tiers.map((tier) => ({
        min_qty: tier.min_qty ?? null,
        min_amount: tier.min_amount ?? null,
        discount_type: tier.discount_type ?? 'bundle_fixed_price',
        discount_value: toNumber(tier.discount_value),
      }))
    : []

  return (
    <div
      className="fixed inset-0 z-50 flex justify-end bg-black/40"
      role="dialog"
      aria-modal="true"
      aria-labelledby="promotion-view-drawer-title"
      onClick={onClose}
    >
      <aside
        className={`flex h-full w-full max-w-xl flex-col bg-gray-50 shadow-2xl transition-transform duration-300 ease-out sm:max-w-2xl ${
          panelIn ? 'translate-x-0' : 'translate-x-full'
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex shrink-0 items-center justify-between border-b border-gray-200 bg-white px-5 py-4">
          <div>
            <h2
              id="promotion-view-drawer-title"
              className="text-lg font-semibold text-gray-900"
            >
              {t('promotions.viewDrawerTitle')}
            </h2>
            <p className="mt-0.5 text-xs text-gray-500">
              {t('promotions.viewDrawerSubtitle')}
            </p>
          </div>
          <button
            type="button"
            className="text-2xl leading-none text-gray-500 hover:text-gray-700"
            onClick={onClose}
            aria-label={t('common.close')}
          >
            <i className="fa-solid fa-xmark" />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
          {error && !loading ? (
            <div
              className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
              role="alert"
            >
              {error}
            </div>
          ) : null}

          {loading ? (
            <p className="text-sm text-gray-500">{t('table.loading_data')}</p>
          ) : null}

          {!loading && detail ? (
            <div className="space-y-4">
              <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                      {t('promotions.viewPromotionName')}
                    </p>
                    <p className="mt-1 text-base font-semibold text-gray-900">
                      {detail.name ?? detail.title ?? '—'}
                    </p>
                  </div>
                  <span
                    className={`shrink-0 rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-wide ${
                      detail.is_active
                        ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                        : 'border-gray-200 bg-gray-100 text-gray-600'
                    }`}
                  >
                    {detail.is_active ? t('common.active') : t('common.inactive')}
                  </span>
                </div>

                <div className="mt-5 grid gap-4 sm:grid-cols-2">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                      {t('promotions.viewTrigger')}
                    </p>
                    <p className="mt-1 text-sm text-gray-900">
                      <TriggerTypeText type={detail.trigger_type ?? ''} />
                    </p>
                  </div>
                  {detail.created_at ? (
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                        {t('promotions.viewCreated')}
                      </p>
                      <p className="mt-1 text-sm font-medium text-gray-900">
                        {formatPromotionDateTime(detail.created_at)}
                      </p>
                    </div>
                  ) : null}
                </div>
              </div>

              <div>
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
                  {t('promotions.viewProductsHeading')}
                  <span className="font-normal normal-case text-gray-400">
                    {' '}
                    ({selectedProducts.length} {t('promotions.viewSelectedSuffix')})
                  </span>
                </p>
                {selectedProducts.length === 0 ? (
                  <p className="rounded-xl border border-dashed border-gray-200 bg-white px-4 py-6 text-center text-sm text-gray-500">
                    {t('table.no_data')}
                  </p>
                ) : (
                  <div className="max-h-72 space-y-2 overflow-y-auto pr-0.5">
                    {selectedProducts.map((row) => (
                      <ProductThumbRow key={row.id} {...row} />
                    ))}
                  </div>
                )}
              </div>

              <div>
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
                  {t('promotions.viewTiersHeading')}
                </p>
                {tiers.length === 0 ? (
                  <p className="text-sm text-gray-500">—</p>
                ) : (
                  <div className="space-y-3">
                    {tiers.map((tier, index) => (
                      <div
                        key={`tier-${index}`}
                        className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm"
                      >
                        <div className="border-b border-gray-100 bg-gray-50 px-4 py-3">
                          <p className="text-sm font-semibold text-gray-900">
                            {t('promotions.viewTierPrefix')} {index + 1}
                          </p>
                        </div>
                        <div className="grid gap-3 px-4 py-4 sm:grid-cols-3">
                          <div>
                            <p className="text-xs font-medium text-gray-500">
                              {detail.trigger_type === 'amount'
                                ? t('promotions.viewAmountThreshold')
                                : t('promotions.viewQtyThreshold')}
                            </p>
                            <p className="mt-1 text-sm font-semibold text-gray-900">
                              {detail.trigger_type === 'amount'
                                ? tier.min_amount != null
                                  ? `RM ${Number(tier.min_amount).toFixed(2)}`
                                  : '—'
                                : tier.min_qty != null
                                  ? String(tier.min_qty)
                                  : '—'}
                            </p>
                          </div>
                          <div>
                            <p className="text-xs font-medium text-gray-500">
                              {t('promotions.viewDiscountType')}
                            </p>
                            <p className="mt-1 text-sm text-gray-900">
                              <DiscountTypeText type={tier.discount_type} />
                            </p>
                          </div>
                          <div>
                            <p className="text-xs font-medium text-gray-500">
                              {t('promotions.viewDiscountValue')}
                            </p>
                            <p className="mt-1 text-sm font-semibold text-gray-900">
                              {tier.discount_type === 'percentage_discount'
                                ? `${tier.discount_value}%`
                                : `RM ${Number(tier.discount_value).toFixed(2)}`}
                            </p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ) : null}
        </div>
      </aside>
    </div>
  )
}
