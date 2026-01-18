'use client'

import { ChangeEvent, FormEvent, useEffect, useMemo, useState } from 'react'

import { useI18n } from '@/lib/i18n'

interface RewardVoucherCreateModalProps {
  onClose: () => void
  onSuccess: () => void
}

interface FormState {
  title: string
  description: string
  pointsRequired: string
  quotaTotal: string
  status: 'active' | 'inactive'
  code: string
  value: string
  minOrderAmount: string
  startAt: string
  endAt: string
  scopeType: 'all' | 'products' | 'categories'
  productIds: number[]
  categoryIds: number[]
}

const initialFormState: FormState = {
  title: '',
  description: '',
  pointsRequired: '',
  quotaTotal: '',
  status: 'active',
  code: '',
  value: '',
  minOrderAmount: '',
  startAt: '',
  endAt: '',
  scopeType: 'all',
  productIds: [],
  categoryIds: [],
}

const generateVoucherCode = () => {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  const segment = Array.from({ length: 6 }, () =>
    chars[Math.floor(Math.random() * chars.length)],
  ).join('')
  return `RW-${segment}`
}

export default function RewardVoucherCreateModal({
  onClose,
  onSuccess,
}: RewardVoucherCreateModalProps) {
  const { t } = useI18n()
  const [form, setForm] = useState<FormState>({ ...initialFormState })
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [productOptions, setProductOptions] = useState<Array<{ id: number; name: string; sku?: string | null }>>([])
  const [categoryOptions, setCategoryOptions] = useState<Array<{ id: number; name: string }>>([])
  const [productSearch, setProductSearch] = useState('')
  const [categorySearch, setCategorySearch] = useState('')
  const [loadingOptions, setLoadingOptions] = useState(false)

  useEffect(() => {
    const controller = new AbortController()
    const fetchOptions = async () => {
      setLoadingOptions(true)
      try {
        const [productsRes, categoriesRes] = await Promise.all([
          fetch('/api/proxy/ecommerce/products?page=1&per_page=200', {
            cache: 'no-store',
            signal: controller.signal,
          }),
          fetch('/api/proxy/ecommerce/categories?page=1&per_page=200', {
            cache: 'no-store',
            signal: controller.signal,
          }),
        ])

        if (!productsRes.ok || !categoriesRes.ok) {
          return
        }

        const productsData = await productsRes.json().catch(() => ({}))
        const categoriesData = await categoriesRes.json().catch(() => ({}))

        if (productsData?.success === false && productsData?.message === 'Unauthorized') {
          window.location.replace('/dashboard')
          return
        }

        const normalizeList = (payload: unknown) => {
          if (Array.isArray(payload)) return payload
          if (payload && typeof payload === 'object' && 'data' in payload) {
            const nested = payload as { data?: unknown }
            if (Array.isArray(nested.data)) return nested.data
          }
          return []
        }

        const productList = normalizeList(productsData?.data)
        const categoryList = normalizeList(categoriesData?.data)

        setProductOptions(
          productList
            .map((item: { id?: number | string | null; name?: string | null; sku?: string | null }) => ({
              id:
                typeof item.id === 'number'
                  ? item.id
                  : Number(item.id) || Number.parseInt(String(item.id), 10) || 0,
              name: item.name ?? '',
              sku: item.sku ?? null,
            }))
            .filter((item: { id: number; name: string }) => item.id > 0 && item.name)
        )

        setCategoryOptions(
          categoryList
            .map((item: { id?: number | string | null; name?: string | null }) => ({
              id:
                typeof item.id === 'number'
                  ? item.id
                  : Number(item.id) || Number.parseInt(String(item.id), 10) || 0,
              name: item.name ?? '',
            }))
            .filter((item: { id: number; name: string }) => item.id > 0 && item.name)
        )
      } catch (err) {
        if (!(err instanceof DOMException && err.name === 'AbortError')) {
          console.error(err)
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

  const filteredProducts = useMemo(() => {
    const query = productSearch.trim().toLowerCase()
    if (!query) return productOptions
    return productOptions.filter((item) => {
      const nameMatch = item.name.toLowerCase().includes(query)
      const skuMatch = item.sku ? item.sku.toLowerCase().includes(query) : false
      return nameMatch || skuMatch
    })
  }, [productOptions, productSearch])

  const filteredCategories = useMemo(() => {
    const query = categorySearch.trim().toLowerCase()
    if (!query) return categoryOptions
    return categoryOptions.filter((item) => item.name.toLowerCase().includes(query))
  }, [categoryOptions, categorySearch])

  const handleChange = (
    event: ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>,
  ) => {
    const { name, value } = event.target
    setForm((prev) => ({ ...prev, [name]: value }))
  }

  const toggleProduct = (productId: number) => {
    setForm((prev) => ({
      ...prev,
      productIds: prev.productIds.includes(productId)
        ? prev.productIds.filter((id) => id !== productId)
        : [...prev.productIds, productId],
    }))
  }

  const toggleCategory = (categoryId: number) => {
    setForm((prev) => ({
      ...prev,
      categoryIds: prev.categoryIds.includes(categoryId)
        ? prev.categoryIds.filter((id) => id !== categoryId)
        : [...prev.categoryIds, categoryId],
    }))
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    const trimmedTitle = form.title.trim()
    const trimmedDescription = form.description.trim()
    const trimmedCode = form.code.trim()
    const pointsRequired = Number.parseInt(form.pointsRequired, 10)
    const valueNum = parseFloat(form.value)
    const minOrderAmountNum = parseFloat(form.minOrderAmount)
    const quotaTotal = form.quotaTotal.trim()
      ? Number.parseInt(form.quotaTotal, 10)
      : undefined

    if (
      !trimmedTitle ||
      !trimmedDescription ||
      !trimmedCode ||
      !Number.isFinite(pointsRequired) ||
      !Number.isFinite(valueNum) ||
      !Number.isFinite(minOrderAmountNum) ||
      !form.startAt ||
      !form.endAt
    ) {
      setError(t('common.allFieldsRequired'))
      return
    }
    if (form.scopeType === 'products' && form.productIds.length === 0) {
      setError('Please select at least one product.')
      return
    }
    if (form.scopeType === 'categories' && form.categoryIds.length === 0) {
      setError('Please select at least one category.')
      return
    }

    setSubmitting(true)
    setError(null)

    try {
      const voucherRes = await fetch('/api/proxy/ecommerce/vouchers', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({
          code: trimmedCode,
          type: 'fixed',
          value: valueNum,
          min_order_amount: minOrderAmountNum,
          scope_type: form.scopeType,
          ...(form.scopeType === 'products' ? { product_ids: form.productIds } : {}),
          ...(form.scopeType === 'categories' ? { category_ids: form.categoryIds } : {}),
          start_at: form.startAt,
          end_at: form.endAt,
          is_active: form.status === 'active',
          is_reward_only: true,
        }),
      })

      const voucherData = await voucherRes.json().catch(() => null)
      if (!voucherRes.ok) {
        let message = 'Failed to create voucher'
        if (voucherData && typeof voucherData === 'object') {
          if (typeof voucherData.message === 'string') {
            message = voucherData.message
          } else if ('errors' in voucherData && typeof voucherData.errors === 'object') {
            const errors = voucherData.errors as Record<string, unknown>
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

      const voucherId =
        voucherData && typeof voucherData === 'object' && 'data' in voucherData
          ? Number((voucherData as { data?: { id?: number | string } }).data?.id)
          : null

      if (!voucherId) {
        setError('Failed to create voucher')
        return
      }

      const rewardRes = await fetch('/api/proxy/ecommerce/loyalty/rewards', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({
          title: trimmedTitle,
          description: trimmedDescription,
          type: 'voucher',
          points_required: pointsRequired,
          voucher_id: voucherId,
          quota_total: quotaTotal,
          is_active: form.status === 'active',
        }),
      })

      const rewardData = await rewardRes.json().catch(() => null)
      if (!rewardRes.ok) {
        let message = 'Failed to create reward'
        if (rewardData && typeof rewardData === 'object') {
          if (typeof rewardData.message === 'string') {
            message = rewardData.message
          } else if ('errors' in rewardData && typeof rewardData.errors === 'object') {
            const errors = rewardData.errors as Record<string, unknown>
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

      setForm({ ...initialFormState })
      onSuccess()
    } catch (err) {
      console.error(err)
      setError('Failed to create reward voucher')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div
        className="absolute inset-0 bg-black/50"
        onClick={() => {
          if (!submitting) onClose()
        }}
      />
      <div className="relative w-full max-w-2xl mx-auto bg-white rounded-lg shadow-lg">
        <div className="flex items-center justify-between border-b border-gray-300 px-5 py-4">
          <h2 className="text-lg font-semibold">Create Reward Voucher</h2>
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
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2 md:col-span-2">
              <label className="block text-sm font-medium text-gray-700" htmlFor="title">
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
            <div className="space-y-2 md:col-span-2">
              <label
                className="block text-sm font-medium text-gray-700"
                htmlFor="description"
              >
                Description <span className="text-red-500">*</span>
              </label>
              <textarea
                id="description"
                name="description"
                value={form.description}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-blue-500 focus:border-blue-500"
                rows={3}
                placeholder="Reward description"
                disabled={submitting}
              />
            </div>
            <div className="space-y-2">
              <label
                className="block text-sm font-medium text-gray-700"
                htmlFor="pointsRequired"
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
            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700" htmlFor="quotaTotal">
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
            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700" htmlFor="status">
                Status
              </label>
              <select
                id="status"
                name="status"
                value={form.status}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-blue-500 focus:border-blue-500"
                disabled={submitting}
              >
                <option value="active">{t('common.active')}</option>
                <option value="inactive">{t('common.inactive')}</option>
              </select>
            </div>
            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700" htmlFor="code">
                Code <span className="text-red-500">*</span>
              </label>
              <div className="flex gap-2">
                <input
                  id="code"
                  name="code"
                  type="text"
                  value={form.code}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Voucher code"
                  disabled={submitting}
                />
                <button
                  type="button"
                  className="whitespace-nowrap px-3 py-2 text-sm border border-gray-300 rounded-md hover:bg-gray-100 disabled:opacity-50"
                  onClick={() => setForm((prev) => ({ ...prev, code: generateVoucherCode() }))}
                  disabled={submitting}
                >
                  Auto-generate
                </button>
              </div>
            </div>
            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700" htmlFor="value">
                Value <span className="text-red-500">*</span>
              </label>
              <input
                id="value"
                name="value"
                type="number"
                step="0.01"
                min="0"
                value={form.value}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-blue-500 focus:border-blue-500"
                placeholder="0.00"
                disabled={submitting}
              />
            </div>
            <div className="space-y-2">
              <label
                className="block text-sm font-medium text-gray-700"
                htmlFor="minOrderAmount"
              >
                Minimum Order Amount <span className="text-red-500">*</span>
              </label>
              <p className="text-xs text-gray-500">Min spend is checked on eligible subtotal only.</p>
              <input
                id="minOrderAmount"
                name="minOrderAmount"
                type="number"
                step="0.01"
                min="0"
                value={form.minOrderAmount}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-blue-500 focus:border-blue-500"
                placeholder="0.00"
                disabled={submitting}
              />
            </div>
            <div className="space-y-2 md:col-span-2">
              <label className="block text-sm font-medium text-gray-700" htmlFor="scopeType">
                Scope Type <span className="text-red-500">*</span>
              </label>
              <select
                id="scopeType"
                name="scopeType"
                value={form.scopeType}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-blue-500 focus:border-blue-500"
                disabled={submitting}
              >
                <option value="all">Storewide</option>
                <option value="products">Specific Products</option>
                <option value="categories">Specific Categories</option>
              </select>
            </div>
            {form.scopeType === 'products' && (
              <div className="space-y-2 md:col-span-2">
                <div className="flex items-center justify-between">
                  <label className="block text-sm font-medium text-gray-700">
                    Eligible Products <span className="text-red-500">*</span>
                  </label>
                  <span className="text-xs text-gray-500">{form.productIds.length} selected</span>
                </div>
                <input
                  type="text"
                  value={productSearch}
                  onChange={(event) => setProductSearch(event.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Search products by name or SKU"
                  disabled={submitting}
                />
                <div className="max-h-48 overflow-y-auto rounded-md border border-gray-200 p-2 text-sm">
                  {loadingOptions ? (
                    <p className="text-gray-500">Loading products...</p>
                  ) : filteredProducts.length === 0 ? (
                    <p className="text-gray-500">No products found.</p>
                  ) : (
                    filteredProducts.map((product) => (
                      <label key={product.id} className="flex items-center gap-2 py-1">
                        <input
                          type="checkbox"
                          checked={form.productIds.includes(product.id)}
                          onChange={() => toggleProduct(product.id)}
                          disabled={submitting}
                        />
                        <span className="text-gray-800">
                          {product.name}
                          {product.sku ? (
                            <span className="text-xs text-gray-500"> ({product.sku})</span>
                          ) : null}
                        </span>
                      </label>
                    ))
                  )}
                </div>
              </div>
            )}
            {form.scopeType === 'categories' && (
              <div className="space-y-2 md:col-span-2">
                <div className="flex items-center justify-between">
                  <label className="block text-sm font-medium text-gray-700">
                    Eligible Categories <span className="text-red-500">*</span>
                  </label>
                  <span className="text-xs text-gray-500">{form.categoryIds.length} selected</span>
                </div>
                <input
                  type="text"
                  value={categorySearch}
                  onChange={(event) => setCategorySearch(event.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Search categories"
                  disabled={submitting}
                />
                <div className="max-h-48 overflow-y-auto rounded-md border border-gray-200 p-2 text-sm">
                  {loadingOptions ? (
                    <p className="text-gray-500">Loading categories...</p>
                  ) : filteredCategories.length === 0 ? (
                    <p className="text-gray-500">No categories found.</p>
                  ) : (
                    filteredCategories.map((category) => (
                      <label key={category.id} className="flex items-center gap-2 py-1">
                        <input
                          type="checkbox"
                          checked={form.categoryIds.includes(category.id)}
                          onChange={() => toggleCategory(category.id)}
                          disabled={submitting}
                        />
                        <span className="text-gray-800">{category.name}</span>
                      </label>
                    ))
                  )}
                </div>
              </div>
            )}
            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700" htmlFor="startAt">
                Start Date <span className="text-red-500">*</span>
              </label>
              <input
                id="startAt"
                name="startAt"
                type="date"
                value={form.startAt}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-blue-500 focus:border-blue-500"
                disabled={submitting}
              />
            </div>
            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700" htmlFor="endAt">
                End Date <span className="text-red-500">*</span>
              </label>
              <input
                id="endAt"
                name="endAt"
                type="date"
                value={form.endAt}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-blue-500 focus:border-blue-500"
                disabled={submitting}
              />
            </div>
          </div>

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
              {submitting ? t('common.creating') : t('common.create')}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
