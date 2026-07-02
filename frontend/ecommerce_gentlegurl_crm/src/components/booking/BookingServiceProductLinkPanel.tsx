'use client'

import { useEffect, useState } from 'react'

export type LinkedBookingProductSummary = {
  id: number
  name: string
  cn_name?: string | null
  price?: number
  price_mode?: string | null
  is_active?: boolean
}

export type BookingProductOption = {
  id: number
  name: string
  cn_name?: string | null
  price?: number
  is_active?: boolean
}

export type BookingServiceProductLinkValue = {
  linkedProductId: number | null
  overwriteLinkedProduct: boolean
}

type Props = {
  mode: 'create' | 'edit'
  value: BookingServiceProductLinkValue
  onChange: (value: BookingServiceProductLinkValue) => void
  linkedProduct?: LinkedBookingProductSummary | null
  disabled?: boolean
}

function formatProductLabel(product: BookingProductOption | LinkedBookingProductSummary): string {
  const cn = typeof product.cn_name === 'string' && product.cn_name.trim() !== '' ? ` (${product.cn_name.trim()})` : ''
  const price = product.price != null ? ` - RM ${Number(product.price).toFixed(2)}` : ''
  const status = product.is_active === false ? ' [Inactive]' : ''
  return `${product.name}${cn}${price}${status}`
}

export function buildInitialProductLinkValue(
  linkedProduct?: LinkedBookingProductSummary | null,
): BookingServiceProductLinkValue {
  return {
    linkedProductId: linkedProduct?.id ?? null,
    overwriteLinkedProduct: true,
  }
}

export function appendProductLinkFormData(fd: FormData, value: BookingServiceProductLinkValue, isEdit: boolean): void {
  if (!isEdit) {
    if (value.overwriteLinkedProduct) {
      fd.append('create_linked_product', '1')
    }
    return
  }

  if (value.linkedProductId) {
    fd.append('linked_booking_product_id', String(value.linkedProductId))
  } else {
    fd.append('unlink_booking_product', '1')
  }

  if (value.overwriteLinkedProduct) {
    fd.append('overwrite_linked_product', '1')
  }
}

export default function BookingServiceProductLinkPanel({
  mode,
  value,
  onChange,
  linkedProduct,
  disabled = false,
}: Props) {
  const [productOptions, setProductOptions] = useState<BookingProductOption[]>([])
  const [loadingProducts, setLoadingProducts] = useState(mode === 'edit')

  useEffect(() => {
    if (mode !== 'edit') return

    let ignore = false

    const loadProducts = async () => {
      setLoadingProducts(true)
      try {
        const collected = new Map<number, BookingProductOption>()

        for (let page = 1; page <= 50; page += 1) {
          const res = await fetch(`/api/proxy/admin/booking/products?page=${page}&per_page=200`, {
            cache: 'no-store',
          })
          if (!res.ok) break

          const json = await res.json().catch(() => null)
          const payload =
            json && typeof json === 'object' && 'data' in json
              ? (json as { data?: { data?: unknown[]; last_page?: number } | unknown[] }).data
              : null

          const rows = Array.isArray((payload as { data?: unknown[] } | null)?.data)
            ? ((payload as { data?: unknown[] }).data ?? [])
            : Array.isArray(payload)
              ? payload
              : []

          for (const row of rows) {
            if (!row || typeof row !== 'object') continue
            const item = row as Record<string, unknown>
            const id = Number(item.id)
            const name = String(item.name ?? '').trim()
            if (!id || !name) continue
            collected.set(id, {
              id,
              name,
              cn_name: typeof item.cn_name === 'string' ? item.cn_name : null,
              price: item.price != null ? Number(item.price) : undefined,
              is_active: item.is_active === true || item.is_active === 1 || item.is_active === '1',
            })
          }

          const lastPage =
            payload && typeof payload === 'object' && 'last_page' in payload
              ? Number((payload as { last_page?: unknown }).last_page)
              : NaN

          if (Number.isFinite(lastPage) && page >= lastPage) break
          if (rows.length < 200) break
        }

        if (!ignore) {
          setProductOptions(Array.from(collected.values()).sort((a, b) => a.name.localeCompare(b.name)))
        }
      } catch {
        if (!ignore) setProductOptions([])
      } finally {
        if (!ignore) setLoadingProducts(false)
      }
    }

    void loadProducts()
    return () => {
      ignore = true
    }
  }, [mode])

  return (
    <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 space-y-3">
      <h3 className="text-sm font-semibold text-gray-900">Linked Booking Product</h3>

      {mode === 'edit' ? (
        <>
          <p className="text-xs text-gray-600">
            Choose a product to link. Any previous service linked to that product will be updated.
          </p>
          <select
            id="linked-booking-product-select"
            value={value.linkedProductId ?? ''}
            onChange={(event) => {
              const nextId = Number(event.target.value)
              onChange({
                ...value,
                linkedProductId: Number.isFinite(nextId) && nextId > 0 ? nextId : null,
              })
            }}
            disabled={disabled || loadingProducts}
            className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm"
          >
            <option value="">{loadingProducts ? 'Loading products...' : 'No linked product'}</option>
            {productOptions.map((product) => (
              <option key={product.id} value={product.id}>
                {formatProductLabel(product)}
              </option>
            ))}
          </select>
        </>
      ) : (
        null
      )}

      <label className="flex items-center gap-2 text-sm text-gray-800">
        <input
          type="checkbox"
          checked={value.overwriteLinkedProduct}
          onChange={(event) => onChange({ ...value, overwriteLinkedProduct: event.target.checked })}
          disabled={disabled}
        />
        <span className="font-medium">
          {mode === 'create' ? 'Auto-create linked booking product' : 'Overwrite linked booking product'}
        </span>
      </label>
    </div>
  )
}
