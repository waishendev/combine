'use client'

import { useEffect, useState } from 'react'

export type LinkedBookingProductCategorySummary = {
  id: number
  name: string
  cn_name?: string | null
  is_active?: boolean
}

export type BookingProductCategoryOption = {
  id: number
  name: string
  cn_name?: string | null
  is_active?: boolean
}

export type BookingServiceCategoryProductLinkValue = {
  linkedProductCategoryId: number | null
  overwriteLinkedProductCategory: boolean
}

type Props = {
  mode: 'create' | 'edit'
  value: BookingServiceCategoryProductLinkValue
  onChange: (value: BookingServiceCategoryProductLinkValue) => void
  disabled?: boolean
}

function formatCategoryLabel(
  category: BookingProductCategoryOption | LinkedBookingProductCategorySummary,
): string {
  const cn =
    typeof category.cn_name === 'string' && category.cn_name.trim() !== ''
      ? ` (${category.cn_name.trim()})`
      : ''
  const status = category.is_active === false ? ' [Inactive]' : ''
  return `${category.name}${cn}${status}`
}

export function buildInitialCategoryProductLinkValue(
  linkedProductCategory?: LinkedBookingProductCategorySummary | null,
): BookingServiceCategoryProductLinkValue {
  return {
    linkedProductCategoryId: linkedProductCategory?.id ?? null,
    overwriteLinkedProductCategory: true,
  }
}

export function appendCategoryProductLinkFormData(
  fd: FormData,
  value: BookingServiceCategoryProductLinkValue,
  isEdit: boolean,
): void {
  if (!isEdit) {
    if (value.overwriteLinkedProductCategory) {
      fd.append('create_linked_product_category', '1')
    }
    return
  }

  if (value.linkedProductCategoryId) {
    fd.append('linked_booking_product_category_id', String(value.linkedProductCategoryId))
  } else {
    fd.append('unlink_product_category', '1')
  }

  if (value.overwriteLinkedProductCategory) {
    fd.append('overwrite_linked_product_category', '1')
  }
}

export default function BookingServiceCategoryProductLinkPanel({
  mode,
  value,
  onChange,
  disabled = false,
}: Props) {
  const [categoryOptions, setCategoryOptions] = useState<BookingProductCategoryOption[]>([])
  const [loadingCategories, setLoadingCategories] = useState(mode === 'edit')

  useEffect(() => {
    if (mode !== 'edit') return

    let ignore = false

    const loadCategories = async () => {
      setLoadingCategories(true)
      try {
        const res = await fetch('/api/proxy/admin/booking/product-categories?all=1', {
          cache: 'no-store',
        })
        if (!res.ok) {
          if (!ignore) setCategoryOptions([])
          return
        }

        const json = await res.json().catch(() => null)
        const payload = json?.data ?? json
        const rows = Array.isArray(payload) ? payload : []

        const mapped = rows
          .map((row: { id?: unknown; name?: unknown; cn_name?: unknown; is_active?: unknown }) => ({
            id: Number(row?.id),
            name: String(row?.name ?? '').trim(),
            cn_name: typeof row?.cn_name === 'string' ? row.cn_name : null,
            is_active: row?.is_active !== false && row?.is_active !== 0 && row?.is_active !== '0',
          }))
          .filter((row: BookingProductCategoryOption) => row.id > 0 && row.name)
          .sort((a, b) => a.name.localeCompare(b.name))

        if (!ignore) setCategoryOptions(mapped)
      } catch {
        if (!ignore) setCategoryOptions([])
      } finally {
        if (!ignore) setLoadingCategories(false)
      }
    }

    void loadCategories()
    return () => {
      ignore = true
    }
  }, [mode])

  return (
    <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 space-y-3">
      <h3 className="text-sm font-semibold text-gray-900">Linked Product Category</h3>

      {mode === 'edit' ? (
        <>
          <p className="text-xs text-gray-600">
            Choose a product category to link under Booking → Product Categories.
          </p>
          <select
            id="linked-booking-product-category-select"
            value={value.linkedProductCategoryId ?? ''}
            onChange={(event) => {
              const nextId = Number(event.target.value)
              onChange({
                ...value,
                linkedProductCategoryId: Number.isFinite(nextId) && nextId > 0 ? nextId : null,
              })
            }}
            disabled={disabled || loadingCategories}
            className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm"
          >
            <option value="">
              {loadingCategories ? 'Loading product categories...' : 'No linked product category'}
            </option>
            {categoryOptions.map((category) => (
              <option key={category.id} value={category.id}>
                {formatCategoryLabel(category)}
              </option>
            ))}
          </select>
        </>
      ) : null}

      <label className="flex items-center gap-2 text-sm text-gray-800">
        <input
          type="checkbox"
          checked={value.overwriteLinkedProductCategory}
          onChange={(event) =>
            onChange({ ...value, overwriteLinkedProductCategory: event.target.checked })
          }
          disabled={disabled}
        />
        <span className="font-medium">
          {mode === 'create'
            ? 'Auto-create linked product category'
            : 'Overwrite linked product category'}
        </span>
      </label>
      {value.overwriteLinkedProductCategory ? (
        <p className="text-xs text-gray-600">
          {mode === 'create'
            ? 'Creates a matching entry under Booking → Product Categories (same English name, Chinese name, sort order, and status).'
            : 'Also syncs English name, Chinese name, sort order, and status to the linked Product Category (Booking → Product Categories).'}
        </p>
      ) : null}
    </div>
  )
}
