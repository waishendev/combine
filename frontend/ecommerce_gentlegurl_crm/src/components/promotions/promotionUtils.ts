export type TierDiscountType =
  | 'bundle_fixed_price'
  | 'percentage_discount'
  | 'fixed_discount'

export type TriggerType = 'quantity' | 'amount'

export type TierApi = {
  min_qty?: number | null
  min_amount?: number | null
  discount_type: TierDiscountType
  discount_value: number
}

export type ProductOption = {
  id: number
  name: string
  disabled: boolean
  disabled_reason?: string | null
  cover_image_url?: string | null
}

export type PromotionApiItem = {
  id: number
  name?: string
  title?: string
  is_active: boolean
  trigger_type: TriggerType
  created_at?: string
  promotion_products?: Array<{
    product_id: number
    product?: { id: number; name: string }
  }>
  promotion_tiers?: TierApi[]
}

export type PromotionRowData = {
  id: number
  name: string
  /** First tier’s discount_type (list preview). */
  tierDiscountPreview: string
  triggerType: string
  isActive: boolean
  productCount: number
  tierCount: number
  createdAt: string | null
}

export type PromotionFormState = {
  id?: number
  name: string
  is_active: boolean
  trigger_type: TriggerType
  product_ids: number[]
  tiers: TierApi[]
}

export const tierTemplate = (): TierApi => ({
  min_qty: 1,
  min_amount: null,
  discount_type: 'bundle_fixed_price',
  discount_value: 0,
})

export const emptyPromotionForm = (): PromotionFormState => ({
  name: '',
  is_active: true,
  trigger_type: 'quantity',
  product_ids: [],
  tiers: [tierTemplate()],
})

export const toNumber = (value: unknown): number => {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  const casted = Number(value)
  return Number.isFinite(casted) ? casted : 0
}

export function promotionApiItemToFormState(
  promotion: PromotionApiItem,
): PromotionFormState {
  return {
    id: promotion.id,
    name: promotion.name ?? promotion.title ?? '',
    is_active: Boolean(promotion.is_active),
    trigger_type: promotion.trigger_type ?? 'quantity',
    product_ids: promotion.promotion_products?.map((row) => row.product_id) ?? [],
    tiers: (promotion.promotion_tiers?.length
      ? promotion.promotion_tiers
      : [tierTemplate()]
    ).map((tier) => ({
      min_qty: tier.min_qty ?? null,
      min_amount: tier.min_amount ?? null,
      discount_type: tier.discount_type ?? 'bundle_fixed_price',
      discount_value: toNumber(tier.discount_value),
    })),
  }
}

export function mapPromotionApiItemToRow(
  item: PromotionApiItem,
): PromotionRowData {
  const firstTier = item.promotion_tiers?.[0]
  return {
    id: item.id,
    name: item.name ?? item.title ?? '',
    tierDiscountPreview: firstTier?.discount_type ?? '',
    triggerType: item.trigger_type ?? '',
    isActive: Boolean(item.is_active),
    productCount: item.promotion_products?.length ?? 0,
    tierCount: item.promotion_tiers?.length ?? 0,
    createdAt: item.created_at ?? null,
  }
}

export function validatePromotionForm(form: PromotionFormState): string | null {
  if (!form.name.trim()) return 'Promotion name is required.'
  if (!form.product_ids.length) return 'Please select at least one product.'
  if (!form.tiers.length) return 'Please add at least one tier rule.'

  const seen = new Set<string>()
  const triggerType = form.trigger_type

  for (let i = 0; i < form.tiers.length; i += 1) {
    const tier = form.tiers[i]
    const label = `Tier #${i + 1}`
    const threshold =
      triggerType === 'quantity'
        ? toNumber(tier.min_qty)
        : toNumber(tier.min_amount)

    if (threshold <= 0) {
      return `${label}: threshold must be positive.`
    }

    if (toNumber(tier.discount_value) <= 0) {
      return `${label}: discount value must be positive.`
    }

    const key =
      triggerType === 'quantity'
        ? `qty:${threshold}`
        : `amt:${threshold.toFixed(2)}`

    if (seen.has(key)) {
      return 'Duplicate thresholds are not allowed.'
    }
    seen.add(key)
  }

  return null
}

export async function fetchPromotionProductOptions(
  editingPromotionId?: number,
): Promise<ProductOption[]> {
  const qs = new URLSearchParams()
  if (editingPromotionId) {
    qs.set('editing_promotion_id', String(editingPromotionId))
  }
  const res = await fetch(
    `/api/proxy/ecommerce/promotions-product-options${qs.toString() ? `?${qs.toString()}` : ''}`,
    { cache: 'no-store' },
  )
  const json = await res.json().catch(() => null)
  return (json?.data?.data ?? json?.data ?? []) as ProductOption[]
}

export function formatPromotionDateTime(value?: string | null): string {
  if (!value) return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  const pad = (n: number) => String(n).padStart(2, '0')
  const y = date.getFullYear()
  const m = pad(date.getMonth() + 1)
  const d = pad(date.getDate())
  const h = pad(date.getHours())
  const min = pad(date.getMinutes())
  const s = pad(date.getSeconds())
  return `${y}-${m}-${d} ${h}:${min}:${s}`
}
