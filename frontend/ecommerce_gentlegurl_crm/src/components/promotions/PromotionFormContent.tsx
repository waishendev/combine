'use client'

import { useEffect, useState } from 'react'

import type {
  ProductOption,
  PromotionFormState,
  TierApi,
  TierDiscountType,
  TriggerType,
} from './promotionUtils'
import { tierTemplate, toNumber } from './promotionUtils'
import PromotionProductMultiSelect from './PromotionProductMultiSelect'
import { useI18n } from '@/lib/i18n'

interface PromotionFormContentProps {
  form: PromotionFormState
  setForm: React.Dispatch<React.SetStateAction<PromotionFormState>>
  products: ProductOption[]
  isReadOnly: boolean
  formDisabled?: boolean
}

const inputClass =
  'w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-50 disabled:text-gray-600'
const labelClass = 'block text-sm font-medium text-gray-700 mb-1'

const DISCOUNT_TYPES: TierDiscountType[] = [
  'bundle_fixed_price',
  'percentage_discount',
  'fixed_discount',
]

export default function PromotionFormContent({
  form,
  setForm,
  products,
  isReadOnly,
  formDisabled = false,
}: PromotionFormContentProps) {
  const { t } = useI18n()
  const locked = isReadOnly || formDisabled
  const [branches, setBranches] = useState<Array<{ id: number; name: string; code: string }>>([])

  useEffect(() => {
    let cancelled = false
    void fetch('/api/proxy/ecommerce/store-locations?per_page=100', { cache: 'no-store' })
      .then((response) => response.json())
      .then((json) => {
        const rows = json?.data?.data ?? json?.data ?? []
        if (!cancelled && Array.isArray(rows)) setBranches(rows)
      })
      .catch(() => undefined)
    return () => { cancelled = true }
  }, [])

  const discountOptionLabel = (value: TierDiscountType) => {
    const key = `promotions.discountType.${value}`
    const translated = t(key)
    return translated !== key ? translated : value.replace(/_/g, ' ')
  }

  const updateTier = (index: number, updater: (current: TierApi) => TierApi) => {
    setForm((prev) => ({
      ...prev,
      tiers: prev.tiers.map((tier, i) => (i === index ? updater(tier) : tier)),
    }))
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 md:gap-x-4 md:gap-y-4">
        <div>
          <label htmlFor="promotion-name" className={labelClass}>
            Promotion name <span className="text-red-500">*</span>
          </label>
          <input
            id="promotion-name"
            type="text"
            value={form.name}
            disabled={locked}
            onChange={(event) =>
              setForm((prev) => ({ ...prev, name: event.target.value }))
            }
            className={inputClass}
            placeholder="Promotion name"
          />
        </div>

        <div>
          <label htmlFor="promotion-is-active" className={labelClass}>
            Status
          </label>
          <select
            id="promotion-is-active"
            value={form.is_active ? 'true' : 'false'}
            disabled={locked}
            onChange={(event) =>
              setForm((prev) => ({
                ...prev,
                is_active: event.target.value === 'true',
              }))
            }
            className={inputClass}
          >
            <option value="true">Active</option>
            <option value="false">Inactive</option>
          </select>
        </div>

        <div className="md:col-span-2">
          <label htmlFor="promotion-trigger" className={labelClass}>
            Trigger type <span className="text-red-500">*</span>
          </label>
          <select
            id="promotion-trigger"
            value={form.trigger_type}
            disabled={locked}
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
            className={inputClass}
          >
            <option value="quantity">{t('promotions.trigger.quantity')}</option>
            <option value="amount">{t('promotions.trigger.amount')}</option>
          </select>
        </div>
      </div>

      <fieldset className="rounded-lg border border-gray-200 p-4">
        <legend className="px-1 text-sm font-medium text-gray-700">Promotion channels</legend>
        <label className="mt-2 flex items-center gap-2 text-sm text-gray-700">
          <input
            type="checkbox"
            checked={form.is_online_enabled}
            disabled={locked}
            onChange={(event) => setForm((prev) => ({ ...prev, is_online_enabled: event.target.checked }))}
          />
          Online Ecommerce (shared website)
        </label>
        <p className="mt-4 text-xs font-medium uppercase tracking-wide text-gray-500">Offline POS Branches</p>
        <div className="mt-2 grid gap-2 sm:grid-cols-2">
          {branches.map((branch) => (
            <label key={branch.id} className="flex items-center gap-2 text-sm text-gray-700">
              <input
                type="checkbox"
                checked={form.offline_store_location_ids.includes(branch.id)}
                disabled={locked}
                onChange={(event) => setForm((prev) => ({
                  ...prev,
                  offline_store_location_ids: event.target.checked
                    ? [...prev.offline_store_location_ids, branch.id]
                    : prev.offline_store_location_ids.filter((id) => id !== branch.id),
                }))}
              />
              {branch.name}
            </label>
          ))}
        </div>
      </fieldset>

      <div>
        <PromotionProductMultiSelect
          products={products}
          selectedIds={form.product_ids}
          onChange={(ids) => setForm((prev) => ({ ...prev, product_ids: ids }))}
          disabled={locked}
          isReadOnly={isReadOnly}
        />
      </div>

      <div className="w-full">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-sm font-medium text-gray-700">
            Tier rules <span className="text-red-500">*</span>
          </h3>
          {!locked ? (
            <button
              type="button"
              onClick={() =>
                setForm((prev) => ({
                  ...prev,
                  tiers: [...prev.tiers, tierTemplate()],
                }))
              }
              className="rounded-md border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50"
            >
              Add tier
            </button>
          ) : null}
        </div>

        <div className="space-y-3">
          {form.tiers.map((tier, index) => (
            <div
              key={`tier-${index}`}
              className="grid grid-cols-1 gap-3 rounded-lg border border-gray-200 p-4 md:grid-cols-[1fr_1fr_1fr_auto]"
            >
              <div>
                <label className={`${labelClass} text-xs`}>
                  {form.trigger_type === 'quantity'
                    ? 'Quantity threshold'
                    : 'Amount threshold'}
                </label>
                <input
                  type="number"
                  min={0}
                  step={form.trigger_type === 'quantity' ? 1 : 0.01}
                  disabled={locked}
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
                  className={inputClass}
                  placeholder={
                    form.trigger_type === 'quantity' ? 'e.g. 2' : 'e.g. 100'
                  }
                />
              </div>

              <div>
                <label className={`${labelClass} text-xs`}>Discount type</label>
                <select
                  disabled={locked}
                  value={tier.discount_type}
                  onChange={(event) =>
                    updateTier(index, (current) => ({
                      ...current,
                      discount_type: event.target.value as TierDiscountType,
                    }))
                  }
                  className={inputClass}
                >
                  {DISCOUNT_TYPES.map((dt) => (
                    <option key={dt} value={dt}>
                      {discountOptionLabel(dt)}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className={`${labelClass} text-xs`}>Discount value</label>
                <input
                  type="number"
                  min={0}
                  step={0.01}
                  disabled={locked}
                  value={tier.discount_value}
                  onChange={(event) =>
                    updateTier(index, (current) => ({
                      ...current,
                      discount_value: toNumber(event.target.value),
                    }))
                  }
                  className={inputClass}
                  placeholder="0"
                />
              </div>

              {!locked ? (
                <div className="flex items-end">
                  <button
                    type="button"
                    disabled={form.tiers.length <= 1}
                    onClick={() =>
                      setForm((prev) => ({
                        ...prev,
                        tiers: prev.tiers.filter((_, i) => i !== index),
                      }))
                    }
                    className="h-[38px] w-full rounded-md border border-red-200 px-3 text-xs font-medium text-red-600 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-40 md:w-auto"
                  >
                    Remove
                  </button>
                </div>
              ) : null}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
