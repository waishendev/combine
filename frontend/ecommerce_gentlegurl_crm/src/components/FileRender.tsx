'use client'

import type { Dispatch, SetStateAction } from 'react'
import { useEffect, useMemo, useRef, useState } from 'react'

import CustomDateTimePicker from './CustomDateTimePicker'
import { useI18n } from '@/lib/i18n'

export type FieldType =
  | 'number'
  | 'boolean'
  | 'status'
  | 'time'
  | 'select'
  | 'datetime'
  | 'discount'
  | 'category_multi'

export interface FieldConfig {
  key: string
  label: string
  type: FieldType
}

interface Props {
  field: FieldConfig
  value: any
  onChange: (val: any) => void
  allValues?: Record<string, any>
  setValues?: Dispatch<SetStateAction<Record<string, any>>>
  categories?: Array<{ id: number; name: string }>
}

function CategoryMultiSelectField({
  label,
  selectedIds,
  onChange,
  categories,
}: {
  label: string
  selectedIds: number[]
  onChange: (val: number[]) => void
  categories: Array<{ id: number; name: string }>
}) {
  const { t } = useI18n()
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const rootRef = useRef<HTMLDivElement>(null)
  const searchRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false)
        setQuery('')
      }
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return categories
    return categories.filter((c) => c.name.toLowerCase().includes(q))
  }, [categories, query])

  const toggle = (id: number) => {
    const next = selectedIds.includes(id)
      ? selectedIds.filter((x) => x !== id)
      : [...selectedIds, id]
    onChange(next)
  }

  const selectAllFiltered = () => {
    const ids = filtered.map((c) => c.id)
    const allOn = ids.length > 0 && ids.every((id) => selectedIds.includes(id))
    if (allOn) {
      onChange(selectedIds.filter((id) => !ids.includes(id)))
    } else {
      const merged = new Set([...selectedIds, ...ids])
      onChange([...merged])
    }
  }

  const clearAll = () => onChange([])

  return (
    <div ref={rootRef} className="space-y-2">
      <label className="block text-sm font-medium text-gray-700">
        {label} <span className="text-red-500">*</span>
        {selectedIds.length > 0 && (
          <span className="ml-2 text-xs font-normal text-gray-500">
            ({t('product.categoriesSelected').replace('{count}', String(selectedIds.length))})
          </span>
        )}
      </label>
      <div className="relative">
        <button
          type="button"
          onClick={() => {
            setOpen((prev) => {
              const next = !prev
              if (next) {
                setTimeout(() => searchRef.current?.focus(), 80)
              } else {
                setQuery('')
              }
              return next
            })
          }}
          className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm text-left bg-white hover:bg-gray-50 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 flex items-center justify-between gap-2 shadow-sm pr-10"
        >
          <div className="flex items-center gap-2 flex-1 min-w-0">
            {selectedIds.length === 0 ? (
              <span className="text-gray-500 flex items-center gap-2">
                <i className="fa-solid fa-layer-group text-xs" />
                {t('product.selectCategories')}
              </span>
            ) : selectedIds.length <= 2 ? (
              <span className="text-gray-700 truncate">
                {categories
                  .filter((c) => selectedIds.includes(c.id))
                  .map((c) => c.name)
                  .join(', ')}
              </span>
            ) : (
              <span className="text-gray-700 font-medium">
                {t('product.categoriesSelectedCount').replace('{count}', String(selectedIds.length))}
              </span>
            )}
          </div>
          <i
            className={`fa-solid fa-chevron-${open ? 'up' : 'down'} text-gray-400 text-xs flex-shrink-0`}
          />
        </button>

        {open && (
          <div className="absolute z-50 mt-2 w-full rounded-xl border border-gray-200 bg-white shadow-xl overflow-hidden">
            <div className="p-3 border-b border-gray-100 bg-gray-50">
              <div className="relative">
                <i className="fa-solid fa-magnifying-glass absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-xs" />
                <input
                  ref={searchRef}
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder={t('product.searchCategories')}
                  className="w-full pl-9 pr-8 py-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white"
                />
                {query ? (
                  <button
                    type="button"
                    onClick={() => setQuery('')}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    <i className="fa-solid fa-xmark text-xs" />
                  </button>
                ) : null}
              </div>
            </div>

            {filtered.length > 0 && (
              <div className="px-3 py-2 border-b border-gray-100 bg-gray-50/50 flex items-center justify-between gap-2">
                <button
                  type="button"
                  onClick={selectAllFiltered}
                  className="text-xs text-blue-600 hover:text-blue-700 font-medium"
                >
                  <i className="fa-solid fa-check-double mr-1" />
                  {filtered.every((c) => selectedIds.includes(c.id))
                    ? t('product.deselectAll')
                    : t('product.selectAll')}
                </button>
                {selectedIds.length > 0 && (
                  <button type="button" onClick={clearAll} className="text-xs text-red-600 hover:text-red-700 font-medium">
                    <i className="fa-solid fa-trash-can mr-1" />
                    {t('product.clearAll')}
                  </button>
                )}
              </div>
            )}

            <div className="max-h-64 overflow-y-auto overscroll-contain">
              {filtered.length > 0 ? (
                <div className="p-2">
                  {filtered.map((category) => {
                    const isSelected = selectedIds.includes(category.id)
                    return (
                      <label
                        key={category.id}
                        className={`flex items-center gap-3 p-2.5 rounded-lg cursor-pointer ${
                          isSelected ? 'bg-blue-50 hover:bg-blue-100' : 'hover:bg-gray-50'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggle(category.id)}
                          className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                        />
                        <span className={`text-sm flex-1 ${isSelected ? 'text-blue-900 font-medium' : 'text-gray-700'}`}>
                          {category.name}
                        </span>
                      </label>
                    )
                  })}
                </div>
              ) : (
                <div className="p-6 text-center text-sm text-gray-500">
                  {query ? t('product.noCategoriesFound') : t('product.noCategoriesAvailable')}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {selectedIds.length > 0 && (
        <div className="flex flex-wrap gap-2 max-h-32 overflow-y-auto">
          {categories
            .filter((c) => selectedIds.includes(c.id))
            .map((category) => (
              <span
                key={category.id}
                className="inline-flex items-center gap-2 px-3 py-1.5 bg-gradient-to-r from-blue-50 to-blue-100 text-blue-800 rounded-lg text-sm border border-blue-200/50"
              >
                <i className="fa-solid fa-tag text-blue-600 text-xs" />
                <span>{category.name}</span>
                <button
                  type="button"
                  onClick={() => toggle(category.id)}
                  className="text-blue-600 hover:text-red-600 rounded-full p-0.5"
                  aria-label={t('product.removeCategory').replace('{name}', category.name)}
                >
                  <i className="fa-solid fa-xmark text-xs" />
                </button>
              </span>
            ))}
        </div>
      )}
    </div>
  )
}

const clampPercent = (value: number) => Math.min(Math.max(value, 0), 100)

const parseNumber = (value: string | number | null | undefined) => {
  const parsed = typeof value === 'number' ? value : Number.parseFloat(String(value))
  return Number.isFinite(parsed) ? parsed : null
}

export default function FieldRenderer({
  field,
  value,
  onChange,
  allValues,
  setValues,
  categories,
}: Props) {
  if (field.type === 'boolean') {
    return (
      <div className="flex flex-col items-start gap-4">
        <span className="text-sm">{field.label}</span>
        <label className="inline-flex items-center gap-2">
          <input
            type="checkbox"
            checked={!!value}
            onChange={(event) => onChange(event.target.checked)}
            className="h-4 w-4 rounded border-gray-300 text-emerald-600"
          />
          <span className="text-xs text-gray-500">{value ? 'Yes' : 'No'}</span>
        </label>
      </div>
    )
  }

  if (field.type === 'status') {
    return (
      <div>
        <label className="text-sm font-medium text-gray-700 block mb-1">{field.label}</label>
        <select
          value={value === false ? 'false' : 'true'}
          onChange={(event) => onChange(event.target.value === 'true')}
          className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
        >
          <option value="true">Active</option>
          <option value="false">Inactive</option>
        </select>
      </div>
    )
  }

  if (field.type === 'time' && allValues && setValues) {
    return (
      <div className="grid sm:grid-cols-2 gap-4">
        <div>
          <CustomDateTimePicker
            label="Available From"
            value={allValues.available_from}
            onChange={(val) => setValues((prev) => ({ ...prev, available_from: val }))}
            showDate={false}
          />
        </div>
        <div>
          <CustomDateTimePicker
            label="Available To"
            value={allValues.available_to}
            onChange={(val) => setValues((prev) => ({ ...prev, available_to: val }))}
            showDate={false}
          />
        </div>
      </div>
    )
  }

  if (field.type === 'datetime') {
    return (
      <div>
        <CustomDateTimePicker
          label={field.label}
          value={value ?? ''}
          onChange={(val) => onChange(val)}
          showDate
          required={false}
        />
      </div>
    )
  }

  if (field.type === 'select') {
    return (
      <div>
        <label className="text-sm font-medium text-gray-700 block mb-1">{field.label}</label>
        <select
          value={value ?? ''}
          onChange={(event) => onChange(Number(event.target.value))}
          className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
        >
          <option value="">Select</option>
          {(field.key === 'category_id' ? categories : [])?.map((option) => (
            <option key={option.id} value={option.id}>
              {option.name}
            </option>
          ))}
        </select>
      </div>
    )
  }

  if (field.type === 'category_multi') {
    return (
      <CategoryMultiSelectField
        label={field.label}
        selectedIds={Array.isArray(value) ? (value as number[]) : []}
        onChange={onChange}
        categories={categories ?? []}
      />
    )
  }

  if (field.type === 'discount' && allValues && setValues) {
    const priceValue = parseNumber(allValues.price)
    const discountValue = parseNumber(value)
    const handleApply = () => {
      if (priceValue === null || discountValue === null) return
      const nextSalePrice = priceValue * (1 - clampPercent(discountValue) / 100)
      setValues((prev) => ({ ...prev, sale_price: nextSalePrice.toFixed(2) }))
    }

    return (
      <div>
        <label className="text-sm font-medium text-gray-700 block mb-1">{field.label}</label>
        <div className="flex items-center gap-2">
          <input
            type="number"
            min="0"
            max="100"
            step="0.1"
            value={value ?? ''}
            onChange={(event) => onChange(Number(event.target.value))}
            className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
          />
          <button
            type="button"
            onClick={handleApply}
            className="h-10 rounded-lg bg-blue-600 px-4 text-sm font-medium text-white hover:bg-blue-700"
          >
            Apply
          </button>
        </div>
      </div>
    )
  }

  return (
    <div>
      <label className="text-sm font-medium text-gray-700 block mb-1">{field.label}</label>
      <input
        type="number"
        value={value ?? ''}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full border rounded px-3 py-2 text-sm"
      />
    </div>
  )
}
