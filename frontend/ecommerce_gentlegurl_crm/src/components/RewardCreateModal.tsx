'use client'

import { ChangeEvent, FormEvent, useEffect, useMemo, useState } from 'react'

import type { ProductApiItem } from './productUtils'
import type { VoucherApiItem } from './voucherUtils'
import type { RewardRowData } from './RewardRow'
import { mapRewardApiItemToRow, type RewardApiItem } from './rewardUtils'
import { useI18n } from '@/lib/i18n'

interface RewardCreateModalProps {
  onClose: () => void
  onSuccess: (reward: RewardRowData) => void
}

type Option = {
  id: number
  label: string
}

interface FormState {
  title: string
  description: string
  type: 'product' | 'voucher' | 'custom'
  pointsRequired: string
  productId: string
  voucherId: string
  quotaTotal: string
  sortOrder: string
  isActive: boolean
}

const initialFormState: FormState = {
  title: '',
  description: '',
  type: 'product',
  pointsRequired: '',
  productId: '',
  voucherId: '',
  quotaTotal: '',
  sortOrder: '',
  isActive: true,
}

const extractItems = <T,>(payload: unknown): T[] => {
  if (!payload || typeof payload !== 'object') return []
  if ('data' in payload) {
    const data = (payload as { data?: unknown }).data
    if (Array.isArray(data)) return data as T[]
    if (data && typeof data === 'object' && 'data' in data) {
      const nested = (data as { data?: unknown }).data
      if (Array.isArray(nested)) return nested as T[]
    }
  }
  return []
}

export default function RewardCreateModal({
  onClose,
  onSuccess,
}: RewardCreateModalProps) {
  const { t } = useI18n()
  const [form, setForm] = useState<FormState>({ ...initialFormState })
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [productOptions, setProductOptions] = useState<Option[]>([])
  const [voucherOptions, setVoucherOptions] = useState<Option[]>([])
  const [loadingOptions, setLoadingOptions] = useState(false)

  useEffect(() => {
    const controller = new AbortController()

    const fetchOptions = async () => {
      setLoadingOptions(true)
      try {
        const [productRes, voucherRes] = await Promise.all([
          fetch('/api/proxy/ecommerce/products?is_reward_only=true&per_page=200', {
            signal: controller.signal,
            cache: 'no-store',
          }),
          fetch('/api/proxy/ecommerce/vouchers?is_reward_only=true&per_page=200', {
            signal: controller.signal,
            cache: 'no-store',
          }),
        ])

        const productPayload = productRes.ok
          ? await productRes.json().catch(() => null)
          : null
        const voucherPayload = voucherRes.ok
          ? await voucherRes.json().catch(() => null)
          : null

        const products = extractItems<ProductApiItem>(productPayload).map((item) => ({
          id:
            typeof item.id === 'number'
              ? item.id
              : Number(item.id) || Number.parseInt(String(item.id), 10),
          label: item.name ?? `Product #${item.id}`,
        }))

        const vouchers = extractItems<VoucherApiItem>(voucherPayload).map((item) => ({
          id:
            typeof item.id === 'number'
              ? item.id
              : Number(item.id) || Number.parseInt(String(item.id), 10),
          label: item.code ?? `Voucher #${item.id}`,
        }))

        setProductOptions(products.filter((option) => Number.isFinite(option.id)))
        setVoucherOptions(vouchers.filter((option) => Number.isFinite(option.id)))
      } catch (fetchError) {
        if (!(fetchError instanceof DOMException && fetchError.name === 'AbortError')) {
          setProductOptions([])
          setVoucherOptions([])
        }
      } finally {
        if (!controller.signal.aborted) {
          setLoadingOptions(false)
        }
      }
    }

    fetchOptions()
    return () => controller.abort()
  }, [])

  const rewardTypeOptions = useMemo(
    () => [
      { value: 'product', label: 'Product' },
      { value: 'voucher', label: 'Voucher' },
      { value: 'custom', label: 'Custom' },
    ],
    [],
  )

  const handleChange = (
    event: ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>,
  ) => {
    const { name, value, type, checked } = event.target
    setForm((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }))
  }

  const handleTypeChange = (event: ChangeEvent<HTMLSelectElement>) => {
    const { value } = event.target
    setForm((prev) => ({
      ...prev,
      type: value as FormState['type'],
      productId: value === 'product' ? prev.productId : '',
      voucherId: value === 'voucher' ? prev.voucherId : '',
    }))
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    const trimmedTitle = form.title.trim()
    const pointsRequired = Number.parseInt(form.pointsRequired, 10)
    const quotaTotal = form.quotaTotal.trim()
      ? Number.parseInt(form.quotaTotal, 10)
      : undefined
    const sortOrder = form.sortOrder.trim()
      ? Number.parseInt(form.sortOrder, 10)
      : undefined
    const productId = form.productId.trim()
      ? Number.parseInt(form.productId, 10)
      : undefined
    const voucherId = form.voucherId.trim()
      ? Number.parseInt(form.voucherId, 10)
      : undefined

    if (!trimmedTitle || !Number.isFinite(pointsRequired)) {
      setError(t('common.allFieldsRequired'))
      return
    }

    if (form.type === 'product' && !Number.isFinite(productId)) {
      setError('Please select a reward product.')
      return
    }

    if (form.type === 'voucher' && !Number.isFinite(voucherId)) {
      setError('Please select a reward voucher.')
      return
    }

    setSubmitting(true)
    setError(null)

    try {
      const payload = {
        title: trimmedTitle,
        description: form.description.trim() || null,
        type: form.type,
        points_required: pointsRequired,
        ...(form.type === 'product' ? { product_id: productId } : { product_id: null }),
        ...(form.type === 'voucher' ? { voucher_id: voucherId } : { voucher_id: null }),
        ...(quotaTotal !== undefined ? { quota_total: quotaTotal } : {}),
        ...(sortOrder !== undefined ? { sort_order: sortOrder } : {}),
        is_active: form.isActive,
      }

      const res = await fetch('/api/proxy/ecommerce/loyalty/rewards', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify(payload),
      })

      const data = await res.json().catch(() => null)

      if (!res.ok) {
        let message = 'Failed to create reward'
        if (data && typeof data === 'object') {
          if (typeof (data as { message?: unknown }).message === 'string') {
            message = (data as { message: string }).message
          } else if ('errors' in data && typeof data.errors === 'object') {
            const errors = data.errors as Record<string, unknown>
            const firstKey = Object.keys(errors)[0]
            const firstValue = firstKey ? errors[firstKey] : null
            if (Array.isArray(firstValue) && typeof firstValue[0] === 'string') {
              message = firstValue[0]
            } else if (typeof firstValue === 'string') {
              message = firstValue
            }
          }
        }
        setError(message)
        return
      }

      const payloadData =
        data && typeof data === 'object' && 'data' in data
          ? ((data as { data?: RewardApiItem | null }).data ?? null)
          : null

      const rewardRow: RewardRowData = payloadData
        ? mapRewardApiItemToRow(payloadData)
        : {
            id: 0,
            title: trimmedTitle,
            description: form.description,
            type: form.type,
            pointsRequired,
            productId: productId ?? null,
            voucherId: voucherId ?? null,
            quotaTotal: quotaTotal ?? null,
            quotaUsed: 0,
            isActive: form.isActive,
            sortOrder: sortOrder ?? null,
            productName: null,
            productSku: null,
            voucherCode: null,
          }

      setForm({ ...initialFormState })
      onSuccess(rewardRow)
    } catch (err) {
      console.error(err)
      setError('Failed to create reward')
    } finally {
      setSubmitting(false)
    }
  }

  const showProductSelect = form.type === 'product'
  const showVoucherSelect = form.type === 'voucher'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div
        className="absolute inset-0 bg-black/50"
        onClick={() => {
          if (!submitting) onClose()
        }}
      />
      <div className="relative w-full max-w-xl mx-auto bg-white rounded-lg shadow-lg">
        <div className="flex items-center justify-between border-b border-gray-300 px-5 py-4">
          <h2 className="text-lg font-semibold">Create Reward</h2>
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
          <div>
            <label
              htmlFor="title"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              Title <span className="text-red-500">*</span>
            </label>
            <input
              id="title"
              name="title"
              type="text"
              value={form.title}
              onChange={handleChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-blue-500 focus:border-blue-500"
              placeholder="Reward title"
              disabled={submitting}
            />
          </div>

          <div>
            <label
              htmlFor="description"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              Description
            </label>
            <textarea
              id="description"
              name="description"
              value={form.description}
              onChange={handleChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-blue-500 focus:border-blue-500"
              rows={3}
              placeholder="Describe the reward"
              disabled={submitting}
            />
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <label
                htmlFor="type"
                className="block text-sm font-medium text-gray-700 mb-1"
              >
                Reward Type <span className="text-red-500">*</span>
              </label>
              <select
                id="type"
                name="type"
                value={form.type}
                onChange={handleTypeChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-blue-500 focus:border-blue-500"
                disabled={submitting}
              >
                {rewardTypeOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label
                htmlFor="pointsRequired"
                className="block text-sm font-medium text-gray-700 mb-1"
              >
                Points Required <span className="text-red-500">*</span>
              </label>
              <input
                id="pointsRequired"
                name="pointsRequired"
                type="number"
                min="1"
                value={form.pointsRequired}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-blue-500 focus:border-blue-500"
                placeholder="0"
                disabled={submitting}
              />
            </div>
          </div>

          {showProductSelect && (
            <div>
              <label
                htmlFor="productId"
                className="block text-sm font-medium text-gray-700 mb-1"
              >
                Reward Product <span className="text-red-500">*</span>
              </label>
              <select
                id="productId"
                name="productId"
                value={form.productId}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-blue-500 focus:border-blue-500"
                disabled={submitting || loadingOptions}
              >
                <option value="">Select a product</option>
                {productOptions.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
          )}

          {showVoucherSelect && (
            <div>
              <label
                htmlFor="voucherId"
                className="block text-sm font-medium text-gray-700 mb-1"
              >
                Reward Voucher <span className="text-red-500">*</span>
              </label>
              <select
                id="voucherId"
                name="voucherId"
                value={form.voucherId}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-blue-500 focus:border-blue-500"
                disabled={submitting || loadingOptions}
              >
                <option value="">Select a voucher</option>
                {voucherOptions.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <label
                htmlFor="quotaTotal"
                className="block text-sm font-medium text-gray-700 mb-1"
              >
                Total Quota
              </label>
              <input
                id="quotaTotal"
                name="quotaTotal"
                type="number"
                min="0"
                value={form.quotaTotal}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-blue-500 focus:border-blue-500"
                placeholder="Unlimited"
                disabled={submitting}
              />
            </div>
            <div>
              <label
                htmlFor="sortOrder"
                className="block text-sm font-medium text-gray-700 mb-1"
              >
                Sort Order
              </label>
              <input
                id="sortOrder"
                name="sortOrder"
                type="number"
                min="0"
                value={form.sortOrder}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-blue-500 focus:border-blue-500"
                placeholder="0"
                disabled={submitting}
              />
            </div>
          </div>

          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input
              type="checkbox"
              name="isActive"
              checked={form.isActive}
              onChange={handleChange}
              className="h-4 w-4 rounded border-gray-300 text-blue-600"
              disabled={submitting}
            />
            Active
          </label>

          {error && (
            <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700" role="alert">
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
              disabled={submitting}
            >
              {submitting ? 'Creating...' : 'Create Reward'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
