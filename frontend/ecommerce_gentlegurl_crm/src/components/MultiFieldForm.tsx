'use client'

import { useEffect, useState } from 'react'
import FieldRenderer, { FieldConfig, FieldType } from './FileRender'

const FIELD_CONFIG: FieldConfig[] = [
  { key: 'sku_prefix', label: 'SKU Prefix', type: 'text' },
  { key: 'barcode_prefix', label: 'Barcode Prefix', type: 'text' },
  { key: 'price', label: 'Price', type: 'number' },
  { key: 'discount_percent', label: 'Apply Discount', type: 'discount' },
  { key: 'sale_price', label: 'Sale Price', type: 'number' },
  { key: 'sale_price_start_at', label: 'Start At', type: 'datetime' },
  { key: 'sale_price_end_at', label: 'End At', type: 'datetime' },
  { key: 'low_stock_threshold', label: 'Low Stock Threshold', type: 'number' },
  { key: 'is_active', label: 'Status', type: 'status' },
  { key: 'category_ids', label: 'Categories', type: 'category_multi' },
]

interface Product {
  id: number
}

interface Props {
  selectedProducts: Product[]
  onClose: () => void
  fetchProducts: () => void
  onSuccess: () => void
}

export default function MultiFieldForm({
  selectedProducts,
  onClose,
  fetchProducts,
  onSuccess,
}: Props) {
  const [selectedFields, setSelectedFields] = useState<string[]>([])
  const [values, setValues] = useState<Record<string, any>>({})
  const [errorMessages, setErrorMessages] = useState<string[]>([])
  const [categories, setCategories] = useState<Array<{ id: number; name: string }>>([])

  useEffect(() => {
    const controller = new AbortController()
    const fetchCategories = async () => {
      try {
        const res = await fetch('/api/proxy/ecommerce/categories?page=1&per_page=1000', {
          cache: 'no-store',
          signal: controller.signal,
        })
        if (!res.ok) return
        const json = await res.json()
        const payload = json?.data
        const rawItems = Array.isArray(payload?.data)
          ? payload.data
          : Array.isArray(payload)
            ? payload
            : []

        const collectRows = (nodes: unknown[], depth: number): Array<{ id: number; name: string }> => {
          const rows: Array<{ id: number; name: string }> = []
          for (const node of nodes) {
            const record = node as {
              id?: number | string
              name?: string | null
              children?: unknown[]
            }
            const id = typeof record.id === 'number' ? record.id : Number(record.id) || 0
            const baseName = typeof record.name === 'string' ? record.name : ''
            if (id > 0 && baseName) {
              const label = depth > 0 ? `${'\u2014 '.repeat(depth)}${baseName}` : baseName
              rows.push({ id, name: label })
            }
            if (Array.isArray(record.children) && record.children.length > 0) {
              rows.push(...collectRows(record.children, depth + 1))
            }
          }
          return rows
        }

        const flat = collectRows(rawItems, 0)
        const seen = new Set<number>()
        const deduped = flat.filter((item) => {
          if (seen.has(item.id)) return false
          seen.add(item.id)
          return true
        })
        setCategories(deduped)
      } catch (error) {
        if (!(error instanceof DOMException && error.name === 'AbortError')) {
          setErrorMessages(['Failed to fetch categories.'])
        }
      }
    }
    fetchCategories()
    return () => controller.abort()
  }, [])

  const getDefaultValue = (type: FieldType) => {
    switch (type) {
      case 'boolean':
        return false
      case 'status':
        return true
      case 'number':
        return 0
      case 'discount':
        return 0
      case 'datetime':
        return ''
      case 'select':
        return ''
      case 'category_multi':
        return []
      case 'text':
        return ''
      case 'time':
        return { available_from: '00:00:00', available_to: '23:59:59' }
      default:
        return null
    }
  }

  // ✅ Checkbox toggle
  const toggleField = (key: string) => {
    setSelectedFields((prev) => {
      const isAdding = !prev.includes(key)
      const updated = isAdding ? [...prev, key] : prev.filter((f) => f !== key)

      const config = FIELD_CONFIG.find((f) => f.key === key)
      if (!config) return updated

      if (isAdding) {
        const defaultValue = getDefaultValue(config.type)
        if (config.type === 'time') {
          setValues((prevVal) => ({
            ...prevVal,
            available_from: '00:00:00',
            available_to: '23:59:59',
          }))
        } else {
          setValues((prevVal) => ({
            ...prevVal,
            [key]: defaultValue,
          }))
        }
      } else {
        if (config.type === 'time') {
          setValues((prevVal) => {
            const { available_from, available_to, ...rest } = prevVal
            return rest
          })
        } else {
          setValues((prevVal) => {
            const newVal = { ...prevVal }
            delete newVal[key]
            return newVal
          })
        }
      }

      return updated
    })
  }

  // ✅ 改值
  const handleChange = (key: string, value: any) => {
    setValues((prev) => ({ ...prev, [key]: value }))
  }

  // ✅ 提交逻辑
  const handleSubmit = async () => {
    const payload: any = {
      ids: selectedProducts.map((p) => p.id),
    }

    for (const key of selectedFields) {
      if (key === 'discount_percent') {
        continue
      }
      if (key === 'sku_prefix') {
        const prefix = typeof values[key] === 'string' ? values[key].trim() : ''
        if (!prefix) {
          setErrorMessages(['SKU prefix is required.'])
          return
        }
        if (!/^[A-Za-z0-9._-]+$/.test(prefix)) {
          setErrorMessages(['SKU prefix may only contain letters, numbers, dots, underscores, and hyphens.'])
          return
        }
        payload.sku_prefix = prefix
        continue
      }
      if (key === 'barcode_prefix') {
        const prefix = typeof values[key] === 'string' ? values[key].trim() : ''
        if (!prefix) {
          setErrorMessages(['Barcode prefix is required.'])
          return
        }
        if (!/^[A-Za-z0-9._-]+$/.test(prefix)) {
          setErrorMessages(['Barcode prefix may only contain letters, numbers, dots, underscores, and hyphens.'])
          return
        }
        payload.barcode_prefix = prefix
        continue
      }
      if (key === 'category_ids') {
        const ids = values[key]
        if (Array.isArray(ids) && ids.length > 0) {
          payload.category_ids = ids.map((id: unknown) => Number(id)).filter((n) => Number.isFinite(n) && n > 0)
        }
        continue
      }
      if (values[key] !== undefined) {
        payload[key] = values[key]
      }
    }

    try {
      const res = await fetch('/api/proxy/ecommerce/products/bulk', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      })

      if (!res.ok) {
        const json = await res.json()
        const errs = json.errors ? Object.values(json.errors).flat() : [json.message]
        setErrorMessages(errs as string[])
        return
      }
      fetchProducts()
      onSuccess()
    } catch (err) {
      setErrorMessages(['An unknown error occurred'])
    }
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain py-4">
        {errorMessages.length > 0 && (
          <div className="mb-5 max-w-6xl mx-auto">
            <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative text-sm">
              {errorMessages.length === 1 ? (
                <div>
                  <strong className="font-semibold">Error:</strong>{' '}
                  {errorMessages[0]}
                </div>
              ) : (
                <>
                  <strong className="font-semibold block mb-1">Errors:</strong>
                  {errorMessages.map((msg, idx) => (
                    <div key={idx}>
                      {idx + 1}. {msg}
                    </div>
                  ))}
                </>
              )}
            </div>
          </div>
        )}
        <div className="space-y-6">
          <div>
            <h3 className="text-md font-semibold text-gray-800 mb-3">
              Select Fields to Update{' '}
              <span className="text-gray-500">(you can choose more than one)</span>
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {FIELD_CONFIG.map((field) => {
                const isSelected = selectedFields.includes(field.key)
                return (
                  <button
                    key={field.key}
                    onClick={() => toggleField(field.key)}
                    type="button"
                    className={`group flex items-center gap-3 p-4 rounded-xl border transition shadow-sm ${
                      isSelected
                        ? 'bg-indigo-50 border-indigo-400 ring-2 ring-indigo-300'
                        : 'bg-white hover:bg-gray-50 border-gray-300'
                    }`}
                  >
                    <div
                      className={`w-6 h-6 flex items-center justify-center rounded-full text-white text-xs font-bold ${
                        isSelected ? 'bg-indigo-500' : 'bg-gray-300 group-hover:bg-gray-400'
                      }`}
                    >
                      ✓
                    </div>
                    <span className="text-sm font-medium text-gray-800">{field.label}</span>
                  </button>
                )
              })}
            </div>
          </div>

          <div className="space-y-4">
            {selectedFields.map((key) => {
              const config = FIELD_CONFIG.find((f) => f.key === key)
              if (!config) return null
              return (
                <FieldRenderer
                  key={key}
                  field={config}
                  value={values[key]}
                  onChange={(val) => handleChange(key, val)}
                  allValues={values}
                  setValues={setValues}
                  categories={categories}
                />
              )
            })}
          </div>
        </div>
      </div>

      <div className="relative z-20 shrink-0 border-t border-gray-200 bg-white px-0 py-4 shadow-[0_-4px_12px_-4px_rgba(0,0,0,0.08)]">
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            className="rounded bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
          >
            Save
          </button>
        </div>
      </div>
    </div>
  )
}
