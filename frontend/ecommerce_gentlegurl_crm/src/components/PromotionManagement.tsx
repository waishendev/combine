'use client'

import { useEffect, useMemo, useState } from 'react'

type ProductOption = {
  id: number
  name: string
  disabled: boolean
  disabled_reason?: string | null
}

type TierDiscountType = 'bundle_fixed_price' | 'percentage_discount' | 'fixed_discount'
type TriggerType = 'quantity' | 'amount'

type Tier = {
  min_qty?: number | null
  min_amount?: number | null
  discount_type: TierDiscountType
  discount_value: number
}

type Promotion = {
  id: number
  name?: string
  title?: string
  is_active: boolean
  promotion_type: TierDiscountType
  trigger_type: TriggerType
  created_at?: string
  promotion_products?: Array<{ product_id: number; product?: { id: number; name: string } }>
  promotion_tiers?: Tier[]
}

type FormState = {
  id?: number
  name: string
  is_active: boolean
  trigger_type: TriggerType
  promotion_type: TierDiscountType
  product_ids: number[]
  tiers: Tier[]
}

type ModalMode = 'create' | 'edit' | 'view' | null

const tierTemplate = (): Tier => ({
  min_qty: 1,
  min_amount: null,
  discount_type: 'bundle_fixed_price',
  discount_value: 0,
})

const formTemplate = (): FormState => ({
  name: '',
  is_active: true,
  trigger_type: 'quantity',
  promotion_type: 'bundle_fixed_price',
  product_ids: [],
  tiers: [tierTemplate()],
})

const toNumber = (value: unknown): number => {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  const casted = Number(value)
  return Number.isFinite(casted) ? casted : 0
}

const formatDateTime = (value?: string): string => {
  if (!value) return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return new Intl.DateTimeFormat('en-MY', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date)
}

const toFormState = (promotion: Promotion): FormState => ({
  id: promotion.id,
  name: promotion.name ?? promotion.title ?? '',
  is_active: Boolean(promotion.is_active),
  trigger_type: promotion.trigger_type ?? 'quantity',
  promotion_type: promotion.promotion_type ?? 'bundle_fixed_price',
  product_ids: promotion.promotion_products?.map((row) => row.product_id) ?? [],
  tiers: (promotion.promotion_tiers?.length
    ? promotion.promotion_tiers
    : [tierTemplate()]).map((tier) => ({
    min_qty: tier.min_qty ?? null,
    min_amount: tier.min_amount ?? null,
    discount_type: tier.discount_type ?? promotion.promotion_type ?? 'bundle_fixed_price',
    discount_value: toNumber(tier.discount_value),
  })),
})

export default function PromotionManagement() {
  const [rows, setRows] = useState<Promotion[]>([])
  const [products, setProducts] = useState<ProductOption[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [deletingId, setDeletingId] = useState<number | null>(null)

  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all')

  const [modalMode, setModalMode] = useState<ModalMode>(null)
  const [form, setForm] = useState<FormState>(formTemplate())

  const isReadOnly = modalMode === 'view'

  const openCreate = async () => {
    setForm(formTemplate())
    setModalMode('create')
    await loadProductOptions()
  }

  const openView = async (promotion: Promotion) => {
    setForm(toFormState(promotion))
    setModalMode('view')
    await loadProductOptions(promotion.id)
  }

  const openEdit = async (promotion: Promotion) => {
    setForm(toFormState(promotion))
    setModalMode('edit')
    await loadProductOptions(promotion.id)
  }

  const closeModal = () => {
    setModalMode(null)
    setForm(formTemplate())
  }

  const loadPromotions = async () => {
    const res = await fetch('/api/proxy/ecommerce/promotions?per_page=200', { cache: 'no-store' })
    const json = await res.json().catch(() => null)
    setRows((json?.data?.data ?? json?.data ?? []) as Promotion[])
  }

  const loadProductOptions = async (editingPromotionId?: number) => {
    const qs = new URLSearchParams()
    if (editingPromotionId) qs.set('editing_promotion_id', String(editingPromotionId))

    const res = await fetch(`/api/proxy/ecommerce/promotions-product-options${qs.toString() ? `?${qs.toString()}` : ''}`, { cache: 'no-store' })
    const json = await res.json().catch(() => null)
    setProducts((json?.data?.data ?? json?.data ?? []) as ProductOption[])
  }

  useEffect(() => {
    void (async () => {
      setLoading(true)
      try {
        await Promise.all([loadPromotions(), loadProductOptions()])
      } finally {
        setLoading(false)
      }
    })()
  }, [])

  const filteredRows = useMemo(() => {
    const keyword = search.trim().toLowerCase()

    return rows.filter((row) => {
      if (statusFilter === 'active' && !row.is_active) return false
      if (statusFilter === 'inactive' && row.is_active) return false

      if (!keyword) return true
      const target = (row.name ?? row.title ?? '').toLowerCase()
      return target.includes(keyword)
    })
  }, [rows, search, statusFilter])

  const validateForm = (): string | null => {
    if (!form.name.trim()) return 'Promotion Name is required.'
    if (!form.product_ids.length) return 'Please select at least 1 product.'
    if (!form.tiers.length) return 'Please add at least 1 tier rule.'

    const seen = new Set<string>()

    for (let i = 0; i < form.tiers.length; i += 1) {
      const tier = form.tiers[i]
      const label = `Tier #${i + 1}`
      const threshold = form.trigger_type === 'quantity' ? toNumber(tier.min_qty) : toNumber(tier.min_amount)

      if (threshold <= 0) {
        return `${label}: threshold must be positive.`
      }

      if (toNumber(tier.discount_value) <= 0) {
        return `${label}: discount value must be positive.`
      }

      const key = form.trigger_type === 'quantity'
        ? `qty:${threshold}`
        : `amt:${threshold.toFixed(2)}`

      if (seen.has(key)) {
        return 'Duplicate thresholds are not allowed.'
      }
      seen.add(key)
    }

    return null
  }

  const handleSubmit = async () => {
    const error = validateForm()
    if (error) {
      alert(error)
      return
    }

    const isEdit = modalMode === 'edit' && form.id
    const endpoint = isEdit ? `/api/proxy/ecommerce/promotions/${form.id}` : '/api/proxy/ecommerce/promotions'
    const method = isEdit ? 'PUT' : 'POST'

    setSaving(true)
    try {
      const res = await fetch(endpoint, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.name.trim(),
          is_active: form.is_active,
          trigger_type: form.trigger_type,
          promotion_type: form.promotion_type,
          product_ids: form.product_ids,
          tiers: form.tiers.map((tier) => ({
            min_qty: form.trigger_type === 'quantity' ? toNumber(tier.min_qty) : null,
            min_amount: form.trigger_type === 'amount' ? toNumber(tier.min_amount) : null,
            discount_type: tier.discount_type,
            discount_value: toNumber(tier.discount_value),
          })),
        }),
      })

      if (!res.ok) {
        const json = await res.json().catch(() => null)
        alert(json?.message ?? 'Failed to save promotion.')
        return
      }

      await loadPromotions()
      closeModal()
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (promotion: Promotion) => {
    const name = promotion.name ?? promotion.title ?? `#${promotion.id}`
    if (!window.confirm(`Delete promotion "${name}"?`)) return

    setDeletingId(promotion.id)
    try {
      const res = await fetch(`/api/proxy/ecommerce/promotions/${promotion.id}`, { method: 'DELETE' })
      if (!res.ok) {
        const json = await res.json().catch(() => null)
        alert(json?.message ?? 'Failed to delete promotion.')
        return
      }
      await loadPromotions()
    } finally {
      setDeletingId(null)
    }
  }

  const updateTier = (index: number, updater: (current: Tier) => Tier) => {
    setForm((prev) => ({
      ...prev,
      tiers: prev.tiers.map((tier, i) => (i === index ? updater(tier) : tier)),
    }))
  }

  return (
    <div className="space-y-4">
      <div className="rounded-xl border bg-white p-4 shadow-sm">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">Promotion List</h3>
            <p className="text-sm text-gray-500">Manage multi-tier promotion groups for POS testing.</p>
          </div>
          <button
            type="button"
            onClick={() => void openCreate()}
            className="inline-flex items-center justify-center rounded-lg bg-black px-4 py-2 text-sm font-semibold text-white hover:bg-gray-800"
          >
            Create Promotion
          </button>
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-3">
          <input
            className="rounded-lg border px-3 py-2 text-sm"
            placeholder="Search promotion name"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
          <select
            className="rounded-lg border px-3 py-2 text-sm"
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value as 'all' | 'active' | 'inactive')}
          >
            <option value="all">All status</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
          <div className="text-sm text-gray-500 md:text-right md:self-center">
            {filteredRows.length} result(s)
          </div>
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50 text-xs uppercase tracking-wide text-gray-500">
              <tr>
                <th className="px-4 py-3 text-left">Promotion Name</th>
                <th className="px-4 py-3 text-left">Type</th>
                <th className="px-4 py-3 text-left">Trigger Type</th>
                <th className="px-4 py-3 text-left">Active</th>
                <th className="px-4 py-3 text-right">Products</th>
                <th className="px-4 py-3 text-right">Tiers</th>
                <th className="px-4 py-3 text-left">Created At</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {loading ? (
                <tr>
                  <td className="px-4 py-8 text-center text-gray-500" colSpan={8}>Loading promotions...</td>
                </tr>
              ) : filteredRows.length === 0 ? (
                <tr>
                  <td className="px-4 py-8 text-center text-gray-500" colSpan={8}>No promotions found.</td>
                </tr>
              ) : (
                filteredRows.map((row) => (
                  <tr key={row.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium text-gray-900">{row.name ?? row.title}</td>
                    <td className="px-4 py-3 text-gray-700">{row.promotion_type}</td>
                    <td className="px-4 py-3 text-gray-700">{row.trigger_type}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${row.is_active ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-600'}`}>
                        {row.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right text-gray-700">{row.promotion_products?.length ?? 0}</td>
                    <td className="px-4 py-3 text-right text-gray-700">{row.promotion_tiers?.length ?? 0}</td>
                    <td className="px-4 py-3 text-gray-700">{formatDateTime(row.created_at)}</td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-2">
                        <button type="button" onClick={() => void openView(row)} className="rounded border px-2.5 py-1 text-xs hover:bg-gray-100">View</button>
                        <button type="button" onClick={() => void openEdit(row)} className="rounded border px-2.5 py-1 text-xs hover:bg-gray-100">Edit</button>
                        <button type="button" disabled={deletingId === row.id} onClick={() => void handleDelete(row)} className="rounded border border-red-200 px-2.5 py-1 text-xs text-red-600 hover:bg-red-50 disabled:opacity-40">Delete</button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {modalMode ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="max-h-[90vh] w-full max-w-5xl overflow-auto rounded-xl bg-white p-5 shadow-2xl">
            <div className="mb-4 flex items-center justify-between">
              <h4 className="text-lg font-semibold text-gray-900">
                {modalMode === 'create' ? 'Create Promotion' : modalMode === 'edit' ? 'Edit Promotion' : 'Promotion Details'}
              </h4>
              <button type="button" onClick={closeModal} className="rounded border px-2 py-1 text-sm hover:bg-gray-100">Close</button>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-500">Promotion Name</label>
                <input
                  className="w-full rounded-lg border px-3 py-2 text-sm disabled:bg-gray-100"
                  value={form.name}
                  disabled={isReadOnly}
                  onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))}
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-500">Active</label>
                <label className="inline-flex items-center gap-2 text-sm text-gray-700">
                  <input
                    type="checkbox"
                    checked={form.is_active}
                    disabled={isReadOnly}
                    onChange={(event) => setForm((prev) => ({ ...prev, is_active: event.target.checked }))}
                  />
                  Enabled
                </label>
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-500">Trigger Type</label>
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
                        min_amount: trigger === 'amount' ? (tier.min_amount ?? 1) : null,
                      })),
                    }))
                  }}
                >
                  <option value="quantity">quantity</option>
                  <option value="amount">amount</option>
                </select>
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-500">Promotion Type</label>
                <select
                  className="w-full rounded-lg border px-3 py-2 text-sm disabled:bg-gray-100"
                  value={form.promotion_type}
                  disabled={isReadOnly}
                  onChange={(event) => setForm((prev) => ({ ...prev, promotion_type: event.target.value as TierDiscountType }))}
                >
                  <option value="bundle_fixed_price">bundle_fixed_price</option>
                  <option value="percentage_discount">percentage_discount</option>
                  <option value="fixed_discount">fixed_discount</option>
                </select>
              </div>
            </div>

            <div className="mt-5">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">Product selector</p>
              <div className="max-h-44 overflow-auto rounded-lg border p-3">
                <div className="grid gap-2 md:grid-cols-2">
                  {products.map((product) => {
                    const selected = form.product_ids.includes(product.id)
                    const disabled = !selected && product.disabled
                    return (
                      <label key={product.id} className={`rounded border px-3 py-2 text-sm ${disabled ? 'bg-gray-100 text-gray-400' : 'bg-white text-gray-800'}`}>
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
                              <span className="block text-xs text-amber-700">Already used in another promotion</span>
                            ) : null}
                          </span>
                        </div>
                      </label>
                    )
                  })}
                </div>
              </div>
            </div>

            <div className="mt-5">
              <div className="mb-2 flex items-center justify-between">
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Tier rules editor</p>
                {!isReadOnly ? (
                  <button type="button" onClick={() => setForm((prev) => ({ ...prev, tiers: [...prev.tiers, tierTemplate()] }))} className="rounded border px-2.5 py-1 text-xs hover:bg-gray-100">
                    Add Tier
                  </button>
                ) : null}
              </div>

              <div className="space-y-2">
                {form.tiers.map((tier, index) => (
                  <div key={`tier-${index}`} className="grid gap-2 rounded-lg border p-3 md:grid-cols-[1fr_1fr_1fr_auto]">
                    <input
                      type="number"
                      min={0}
                      step={form.trigger_type === 'quantity' ? 1 : 0.01}
                      disabled={isReadOnly}
                      value={form.trigger_type === 'quantity' ? (tier.min_qty ?? '') : (tier.min_amount ?? '')}
                      onChange={(event) => {
                        const value = toNumber(event.target.value)
                        updateTier(index, (current) => ({
                          ...current,
                          min_qty: form.trigger_type === 'quantity' ? value : null,
                          min_amount: form.trigger_type === 'amount' ? value : null,
                        }))
                      }}
                      className="rounded-lg border px-3 py-2 text-sm disabled:bg-gray-100"
                      placeholder={form.trigger_type === 'quantity' ? 'Quantity threshold' : 'Amount threshold'}
                    />

                    <select
                      disabled={isReadOnly}
                      value={tier.discount_type}
                      onChange={(event) => updateTier(index, (current) => ({ ...current, discount_type: event.target.value as TierDiscountType }))}
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
                      onChange={(event) => updateTier(index, (current) => ({ ...current, discount_value: toNumber(event.target.value) }))}
                      className="rounded-lg border px-3 py-2 text-sm disabled:bg-gray-100"
                      placeholder="Discount value"
                    />

                    {!isReadOnly ? (
                      <button
                        type="button"
                        disabled={form.tiers.length <= 1}
                        onClick={() => setForm((prev) => ({ ...prev, tiers: prev.tiers.filter((_, i) => i !== index) }))}
                        className="rounded border border-red-200 px-3 py-2 text-xs font-medium text-red-600 hover:bg-red-50 disabled:opacity-40"
                      >
                        Remove
                      </button>
                    ) : null}
                  </div>
                ))}
              </div>
            </div>

            {isReadOnly ? null : (
              <div className="mt-5 flex justify-end gap-2">
                <button type="button" onClick={closeModal} className="rounded-lg border px-4 py-2 text-sm hover:bg-gray-100">Cancel</button>
                <button type="button" disabled={saving} onClick={() => void handleSubmit()} className="rounded-lg bg-black px-4 py-2 text-sm font-semibold text-white hover:bg-gray-800 disabled:opacity-40">
                  {saving ? 'Saving...' : modalMode === 'edit' ? 'Update Promotion' : 'Create Promotion'}
                </button>
              </div>
            )}
          </div>
        </div>
      ) : null}
    </div>
  )
}
