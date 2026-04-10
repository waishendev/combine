'use client'

import type {
  ProductOption,
  PromotionFormState,
  TierApi,
  TierDiscountType,
  TriggerType,
} from './promotionUtils'
import { tierTemplate, toNumber } from './promotionUtils'

interface PromotionFormContentProps {
  form: PromotionFormState
  setForm: React.Dispatch<React.SetStateAction<PromotionFormState>>
  products: ProductOption[]
  isReadOnly: boolean
}

export default function PromotionFormContent({
  form,
  setForm,
  products,
  isReadOnly,
}: PromotionFormContentProps) {
  const updateTier = (index: number, updater: (current: TierApi) => TierApi) => {
    setForm((prev) => ({
      ...prev,
      tiers: prev.tiers.map((tier, i) => (i === index ? updater(tier) : tier)),
    }))
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-500">
            Promotion name
          </label>
          <input
            className="w-full rounded-lg border px-3 py-2 text-sm disabled:bg-gray-100"
            value={form.name}
            disabled={isReadOnly}
            onChange={(event) =>
              setForm((prev) => ({ ...prev, name: event.target.value }))
            }
          />
        </div>

        <div>
          <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-500">
            Active
          </label>
          <label className="inline-flex items-center gap-2 text-sm text-gray-700">
            <input
              type="checkbox"
              checked={form.is_active}
              disabled={isReadOnly}
              onChange={(event) =>
                setForm((prev) => ({ ...prev, is_active: event.target.checked }))
              }
            />
            Enabled
          </label>
        </div>

        <div>
          <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-500">
            Trigger type
          </label>
          <select
            className="w-full rounded-lg border px-3 py-2 text-sm disabled:bg-gray-100"
            value={form.trigger_type}
            disabled={isReadOnly}
            onChange={(event) => {
              const trigger = event.target.value as TriggerType
              setForm((prev) => ({
                ...prev,
                trigger_type: trigger,
                tiers: prev.tiers.map((tier) => ({
                  ...tier,
                  min_qty: trigger === 'quantity' ? (tier.min_qty ?? 1) : null,
                  min_amount:
                    trigger === 'amount' ? (tier.min_amount ?? 1) : null,
                })),
              }))
            }}
          >
            <option value="quantity">quantity</option>
            <option value="amount">amount</option>
          </select>
        </div>

        <div>
          <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-500">
            Promotion type
          </label>
          <select
            className="w-full rounded-lg border px-3 py-2 text-sm disabled:bg-gray-100"
            value={form.promotion_type}
            disabled={isReadOnly}
            onChange={(event) =>
              setForm((prev) => ({
                ...prev,
                promotion_type: event.target.value as TierDiscountType,
              }))
            }
          >
            <option value="bundle_fixed_price">bundle_fixed_price</option>
            <option value="percentage_discount">percentage_discount</option>
            <option value="fixed_discount">fixed_discount</option>
          </select>
        </div>
      </div>

      <div>
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
          Products
        </p>
        <div className="max-h-44 overflow-auto rounded-lg border p-3">
          <div className="grid gap-2 md:grid-cols-2">
            {products.map((product) => {
              const selected = form.product_ids.includes(product.id)
              const disabled = !selected && product.disabled
              return (
                <label
                  key={product.id}
                  className={`rounded border px-3 py-2 text-sm ${
                    disabled
                      ? 'bg-gray-100 text-gray-400'
                      : 'bg-white text-gray-800'
                  }`}
                >
                  <div className="flex items-start gap-2">
                    <input
                      type="checkbox"
                      checked={selected}
                      disabled={isReadOnly || disabled}
                      onChange={(event) => {
                        const checked = event.target.checked
                        setForm((prev) => ({
                          ...prev,
                          product_ids: checked
                            ? [...prev.product_ids, product.id]
                            : prev.product_ids.filter((id) => id !== product.id),
                        }))
                      }}
                    />
                    <span>
                      <span className="block">{product.name}</span>
                      {product.disabled_reason ? (
                        <span className="block text-xs text-amber-700">
                          Already used in another promotion
                        </span>
                      ) : null}
                    </span>
                  </div>
                </label>
              )
            })}
          </div>
        </div>
      </div>

      <div>
        <div className="mb-2 flex items-center justify-between">
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
            Tier rules
          </p>
          {!isReadOnly ? (
            <button
              type="button"
              onClick={() =>
                setForm((prev) => ({
                  ...prev,
                  tiers: [...prev.tiers, tierTemplate()],
                }))
              }
              className="rounded border px-2.5 py-1 text-xs hover:bg-gray-100"
            >
              Add tier
            </button>
          ) : null}
        </div>

        <div className="space-y-2">
          {form.tiers.map((tier, index) => (
            <div
              key={`tier-${index}`}
              className="grid gap-2 rounded-lg border p-3 md:grid-cols-[1fr_1fr_1fr_auto]"
            >
              <input
                type="number"
                min={0}
                step={form.trigger_type === 'quantity' ? 1 : 0.01}
                disabled={isReadOnly}
                value={
                  form.trigger_type === 'quantity'
                    ? (tier.min_qty ?? '')
                    : (tier.min_amount ?? '')
                }
                onChange={(event) => {
                  const value = toNumber(event.target.value)
                  updateTier(index, (current) => ({
                    ...current,
                    min_qty: form.trigger_type === 'quantity' ? value : null,
                    min_amount: form.trigger_type === 'amount' ? value : null,
                  }))
                }}
                className="rounded-lg border px-3 py-2 text-sm disabled:bg-gray-100"
                placeholder={
                  form.trigger_type === 'quantity'
                    ? 'Quantity threshold'
                    : 'Amount threshold'
                }
              />

              <select
                disabled={isReadOnly}
                value={tier.discount_type}
                onChange={(event) =>
                  updateTier(index, (current) => ({
                    ...current,
                    discount_type: event.target.value as TierDiscountType,
                  }))
                }
                className="rounded-lg border px-3 py-2 text-sm disabled:bg-gray-100"
              >
                <option value="bundle_fixed_price">bundle_fixed_price</option>
                <option value="percentage_discount">percentage_discount</option>
                <option value="fixed_discount">fixed_discount</option>
              </select>

              <input
                type="number"
                min={0}
                step={0.01}
                disabled={isReadOnly}
                value={tier.discount_value}
                onChange={(event) =>
                  updateTier(index, (current) => ({
                    ...current,
                    discount_value: toNumber(event.target.value),
                  }))
                }
                className="rounded-lg border px-3 py-2 text-sm disabled:bg-gray-100"
                placeholder="Discount value"
              />

              {!isReadOnly ? (
                <button
                  type="button"
                  disabled={form.tiers.length <= 1}
                  onClick={() =>
                    setForm((prev) => ({
                      ...prev,
                      tiers: prev.tiers.filter((_, i) => i !== index),
                    }))
                  }
                  className="rounded border border-red-200 px-3 py-2 text-xs font-medium text-red-600 hover:bg-red-50 disabled:opacity-40"
                >
                  Remove
                </button>
              ) : null}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
