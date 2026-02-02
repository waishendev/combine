import type { Dispatch, SetStateAction } from 'react'
import CustomDateTimePicker from './CustomDateTimePicker'

export type FieldType = 'number' | 'boolean' | 'time' | 'select' | 'datetime' | 'discount'

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
