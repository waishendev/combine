'use client'

import { useEffect, useMemo, useState } from 'react'

import type { BookingServiceRowData } from './BookingServiceRow'
import BookingServiceAllowedStaffPicker, { type BookingStaffOption } from './BookingServiceAllowedStaffPicker'
import BookingServiceQuestionsBuilder, { emptyQuestion, type QuestionForm } from './BookingServiceQuestionsBuilder'
import CrmFormModalShell from '@/components/CrmFormModalShell'

type FieldKey =
  | 'allowed_staff_ids'
  | 'allow_photo_upload'
  | 'primary_slots'
  | 'is_active'
  | 'service_type'
  | 'duration_min'
  | 'buffer_min'
  | 'pricing'
  | 'questions'

const FIELD_OPTIONS: Array<{ key: FieldKey; label: string }> = [
  { key: 'is_active', label: 'Status' },
  { key: 'service_type', label: 'Service Type' },
  { key: 'pricing', label: 'Price Mode / Price' },
  { key: 'duration_min', label: 'Duration (min)' },
  { key: 'buffer_min', label: 'Buffer Time (min)' },
  { key: 'allow_photo_upload', label: 'Allow Photo Upload' },
  { key: 'primary_slots', label: 'Primary slot times' },
  { key: 'allowed_staff_ids', label: 'Allowed Staff' },
  { key: 'questions', label: 'Add-ons / Questions' },
]

interface Props {
  show: boolean
  selectedServices: BookingServiceRowData[]
  onClose: () => void
  onSuccess: () => Promise<void> | void
}

export default function BookingServiceBulkUpdateModal({
  show,
  selectedServices,
  onClose,
  onSuccess,
}: Props) {
  const [selectedFields, setSelectedFields] = useState<FieldKey[]>([])
  const [serviceType, setServiceType] = useState<'standard' | 'premium'>('standard')
  const [durationMin, setDurationMin] = useState('30')
  const [bufferMin, setBufferMin] = useState('15')
  const [isActive, setIsActive] = useState<'true' | 'false'>('true')
  const [allowPhotoUpload, setAllowPhotoUpload] = useState<'true' | 'false'>('false')
  const [priceMode, setPriceMode] = useState<'fixed' | 'range'>('fixed')
  const [servicePrice, setServicePrice] = useState('0')
  const [rangeMin, setRangeMin] = useState('0')
  const [rangeMax, setRangeMax] = useState('0')
  const [primarySlots, setPrimarySlots] = useState('')
  const [staffOptions, setStaffOptions] = useState<BookingStaffOption[]>([])
  const [allowedStaffIds, setAllowedStaffIds] = useState<number[]>([])
  const [staffLoading, setStaffLoading] = useState(false)
  const [bookingServiceOptions, setBookingServiceOptions] = useState<
    Array<{ id: number; name: string; duration_min: number; service_price: number }>
  >([])
  const [questions, setQuestions] = useState<QuestionForm[]>([])
  const [questionsLoading, setQuestionsLoading] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const countText = useMemo(
    () => `${selectedServices.length} service${selectedServices.length > 1 ? 's' : ''} selected`,
    [selectedServices.length],
  )

  useEffect(() => {
    if (!show) return
    if (!selectedFields.includes('allowed_staff_ids')) return

    const controller = new AbortController()
    let ignore = false

    const loadStaffs = async () => {
      setStaffLoading(true)
      try {
        const res = await fetch('/api/proxy/staffs?per_page=200&is_active=true', {
          cache: 'no-store',
          signal: controller.signal,
        })
        if (!res.ok) {
          if (!ignore) setStaffOptions([])
          return
        }
        const json = await res.json().catch(() => null)
        const payload = json?.data?.data ?? json?.data ?? json
        const rows = Array.isArray(payload) ? payload : Array.isArray(payload?.data) ? payload.data : []
        const mapped: BookingStaffOption[] = rows
          .map((row: any) => ({ id: Number(row?.id), name: String(row?.name ?? '') }))
          .filter((row: BookingStaffOption) => Number.isFinite(row.id) && row.id > 0 && row.name.trim())
        if (!ignore) setStaffOptions(mapped)
      } catch (e) {
        if (!ignore) setStaffOptions([])
      } finally {
        if (!ignore) setStaffLoading(false)
      }
    }

    void loadStaffs()
    return () => {
      ignore = true
      controller.abort()
    }
  }, [show, selectedFields])

  useEffect(() => {
    if (!show) return
    if (!selectedFields.includes('pricing')) return
    const first = selectedServices[0]
    if (!first) return
    const nextMode = first.price_mode === 'range' ? 'range' : 'fixed'
    setPriceMode(nextMode)
    setServicePrice(String(first.service_price ?? 0))
    setRangeMin(String(first.price_range_min ?? 0))
    setRangeMax(String(first.price_range_max ?? 0))
  }, [show, selectedFields, selectedServices])

  useEffect(() => {
    if (!show) return
    if (!selectedFields.includes('buffer_min')) return
    const first = selectedServices[0]
    if (!first) return
    setBufferMin(String(first.buffer_min ?? 15))
  }, [show, selectedFields, selectedServices])

  useEffect(() => {
    if (!show) return
    if (!selectedFields.includes('questions')) return
    const controller = new AbortController()
    let ignore = false

    const loadOptions = async () => {
      setQuestionsLoading(true)
      try {
        const res = await fetch('/api/proxy/admin/booking/services?per_page=200', {
          cache: 'no-store',
          signal: controller.signal,
        })
        if (!res.ok) {
          if (!ignore) setBookingServiceOptions([])
          return
        }
        const json = await res.json().catch(() => null)
        const payload = json?.data?.data ?? json?.data ?? json
        const rows = Array.isArray(payload) ? payload : Array.isArray(payload?.data) ? payload.data : []
        const mapped = rows
          .map((row: any) => ({
            id: Number(row?.id),
            name: String(row?.name ?? ''),
            duration_min: Math.max(0, Number(row?.duration_min ?? 0)),
            service_price: Math.max(0, Number(row?.service_price ?? 0)),
          }))
          .filter((row: { id: number; name: string }) => Number.isFinite(row.id) && row.id > 0 && row.name.trim())
        if (!ignore) setBookingServiceOptions(mapped)
      } catch {
        if (!ignore) setBookingServiceOptions([])
      } finally {
        if (!ignore) setQuestionsLoading(false)
      }
    }

    void loadOptions()
    return () => {
      ignore = true
      controller.abort()
    }
  }, [show, selectedFields])

  const toggleField = (field: FieldKey) => {
    setSelectedFields((prev) =>
      prev.includes(field) ? prev.filter((item) => item !== field) : [...prev, field],
    )
  }

  const parsePrimarySlots = (value: string): string[] =>
    value
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean)

  const handleSubmit = async () => {
    if (selectedFields.length === 0) {
      setError('Please select at least one field to update.')
      return
    }

    if (selectedFields.includes('duration_min')) {
      const duration = Number(durationMin)
      if (!Number.isFinite(duration) || duration < 1) {
        setError('Duration (min) must be 1 or greater.')
        return
      }
    }

    if (selectedFields.includes('buffer_min')) {
      const buffer = Number(bufferMin)
      if (!Number.isFinite(buffer) || buffer < 0) {
        setError('Buffer Time (min) must be 0 or greater.')
        return
      }
    }

    if (selectedFields.includes('pricing')) {
      if (priceMode === 'fixed') {
        const price = Number(servicePrice)
        if (!Number.isFinite(price) || price < 0) {
          setError('Service price must be 0 or greater.')
          return
        }
      } else {
        const min = Number(rangeMin)
        const max = Number(rangeMax)
        if (!Number.isFinite(min) || !Number.isFinite(max) || min < 0 || max < 0) {
          setError('Range min/max must be 0 or greater.')
          return
        }
        if (min > max) {
          setError('Range min must be less than or equal to range max.')
          return
        }
      }
    }

    if (selectedFields.includes('allowed_staff_ids')) {
      if (allowedStaffIds.length === 0) {
        setError('Please select at least 1 allowed staff.')
        return
      }
    }

    if (selectedFields.includes('primary_slots')) {
      // Basic sanity check: HH:mm
      const slots = parsePrimarySlots(primarySlots)
      const ok = slots.every((t) => /^\d{2}:\d{2}$/.test(t))
      if (!ok) {
        setError('Primary slot times must be in HH:mm format, separated by comma. Example: 10:00, 14:30')
        return
      }
    }

    if (selectedFields.includes('questions')) {
      if (questionsLoading) {
        setError('Loading booking service options… please wait.')
        return
      }
      const missingLinkedService = questions.some((q) => q.options.some((o) => !o.linked_booking_service_id.trim()))
      if (missingLinkedService) {
        setError('Each add-on option must select a linked booking service')
        return
      }
    }

    setIsSubmitting(true)
    setError(null)
    try {
      const payload: Record<string, unknown> = {
        ids: selectedServices.map((s) => s.id),
      }

      if (selectedFields.includes('is_active')) {
        payload.is_active = isActive === 'true'
      }
      if (selectedFields.includes('service_type')) {
        payload.service_type = serviceType
      }
      if (selectedFields.includes('duration_min')) {
        payload.duration_min = Number(durationMin)
      }
      if (selectedFields.includes('buffer_min')) {
        payload.buffer_min = Number(bufferMin)
      }
      if (selectedFields.includes('allow_photo_upload')) {
        payload.allow_photo_upload = allowPhotoUpload === 'true'
      }
      if (selectedFields.includes('pricing')) {
        payload.price_mode = priceMode
        if (priceMode === 'fixed') {
          payload.service_price = Number(servicePrice)
        } else {
          payload.price_range_min = Number(rangeMin)
          payload.price_range_max = Number(rangeMax)
        }
      }
      if (selectedFields.includes('primary_slots')) {
        payload.primary_slots = parsePrimarySlots(primarySlots)
      }
      if (selectedFields.includes('allowed_staff_ids')) {
        payload.allowed_staff_ids = allowedStaffIds
      }
      if (selectedFields.includes('questions')) {
        payload.questions = questions
      }

      const res = await fetch('/api/proxy/admin/booking/services/bulk', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify(payload),
      })

      if (!res.ok) {
        const response = await res.json().catch(() => null)
        const message =
          response && typeof response === 'object' && 'message' in response && typeof response.message === 'string'
            ? response.message
            : 'Bulk update failed. Please retry.'
        setError(message)
        return
      }

      await onSuccess()
      onClose()
    } catch (e) {
      console.error(e)
      setError('Bulk update failed. Please retry.')
    } finally {
      setIsSubmitting(false)
    }
  }

  if (!show) return null

  return (
    <CrmFormModalShell
      title={
        <div className="min-w-0">
          <span>Bulk Update Services</span>
          <p className="text-sm font-normal text-gray-500">{countText}</p>
        </div>
      }
      size="lg"
      onClose={onClose}
      closeDisabled={isSubmitting}
      footer={
        <>
          <button
            type="button"
            onClick={onClose}
            className="rounded border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-50"
            disabled={isSubmitting}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            className="rounded bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
            disabled={isSubmitting}
          >
            {isSubmitting ? 'Saving…' : 'Save'}
          </button>
        </>
      }
    >
      <div className="space-y-4 px-5 py-4">
          {error && (
            <div className="rounded border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>
          )}

          <div className="border rounded p-2 bg-gray-50 max-h-[180px] overflow-y-auto text-sm text-gray-700">
            {selectedServices.map((service) => (
              <div key={service.id} className="mb-3 border-b border-gray-200 pb-2 last:border-none last:pb-0">
                {/* Name */}
                <div className="font-semibold text-gray-800">
                  {service.name}
                </div>

                {/* TYPE */}
                <div className="text-xs text-gray-500 mt-1">
                  {service.serviceType || '-'}
                </div>

                {/* Duration + Price */}
                <div className="flex justify-between items-center mt-2 text-xs">
                  <span className="text-gray-500">
                    {service.duration_min} min
                  </span>

                  <span className="text-green-600 font-medium">
                    RM {service.service_price}
                  </span>
                </div>
              </div>
            ))}
          </div>

          <div>
            <h3 className="text-md font-semibold text-gray-800 mb-3">
              Select Fields to Update <span className="text-gray-500">(you can choose more than one)</span>
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {FIELD_OPTIONS.map((field) => {
                const isSelected = selectedFields.includes(field.key)
                return (
                  <button
                    key={field.key}
                    type="button"
                    onClick={() => toggleField(field.key)}
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
          {selectedFields.includes('is_active') && (
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Status</label>
              <select
                value={isActive}
                onChange={(e) => setIsActive(e.target.value as 'true' | 'false')}
                className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
              >
                <option value="true">Active</option>
                <option value="false">Inactive</option>
              </select>
            </div>
          )}

          {selectedFields.includes('service_type') && (
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Service Type</label>
              <select
                value={serviceType}
                onChange={(e) => setServiceType(e.target.value as 'standard' | 'premium')}
                className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
              >
                <option value="standard">Standard</option>
                <option value="premium">Premium</option>
              </select>
            </div>
          )}

          {selectedFields.includes('duration_min') && (
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Duration (min)</label>
              <input
                type="number"
                min={1}
                value={durationMin}
                onChange={(e) => setDurationMin(e.target.value)}
                className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
              />
            </div>
          )}

          {selectedFields.includes('buffer_min') && (
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Buffer Time (min)</label>
              <input
                type="number"
                min={0}
                value={bufferMin}
                onChange={(e) => setBufferMin(e.target.value)}
                className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
              />
              <p className="mt-1 text-xs text-gray-500">Extra minutes after the service for setup and cleanup.</p>
            </div>
          )}

          {selectedFields.includes('pricing') && (
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Price Mode</label>
              <select
                value={priceMode}
                onChange={(e) => setPriceMode(e.target.value as 'fixed' | 'range')}
                className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
              >
                <option value="fixed">Fixed</option>
                <option value="range">Range</option>
              </select>
            </div>
          )}

          {selectedFields.includes('pricing') && priceMode === 'fixed' && (
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Service Price</label>
              <input
                type="number"
                min={0}
                step="0.01"
                value={servicePrice}
                onChange={(e) => setServicePrice(e.target.value)}
                className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
              />
            </div>
          )}

          {selectedFields.includes('pricing') && priceMode === 'range' && (
            <div className="grid gap-3 md:grid-cols-2">
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Range Min</label>
                <input
                  type="number"
                  min={0}
                  step="0.01"
                  value={rangeMin}
                  onChange={(e) => setRangeMin(e.target.value)}
                  className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Range Max</label>
                <input
                  type="number"
                  min={0}
                  step="0.01"
                  value={rangeMax}
                  onChange={(e) => setRangeMax(e.target.value)}
                  className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
                />
              </div>
            </div>
          )}

          {selectedFields.includes('allow_photo_upload') && (
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Allow Photo Upload</label>
              <select
                value={allowPhotoUpload}
                onChange={(e) => setAllowPhotoUpload(e.target.value as 'true' | 'false')}
                className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
              >
                <option value="false">No</option>
                <option value="true">Yes</option>
              </select>
            </div>
          )}

          {selectedFields.includes('primary_slots') && (
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Primary slot times</label>
              <input
                type="text"
                value={primarySlots}
                onChange={(e) => setPrimarySlots(e.target.value)}
                placeholder="e.g. 10:00, 14:30, 18:00"
                className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
              />
              <p className="mt-1 text-xs text-gray-500">Use HH:mm, separated by comma.</p>
            </div>
          )}

          {selectedFields.includes('allowed_staff_ids') && (
            <BookingServiceAllowedStaffPicker
              staffOptions={staffOptions}
              value={allowedStaffIds}
              onChange={setAllowedStaffIds}
              disabled={isSubmitting}
              loading={staffLoading}
            />
          )}

          {selectedFields.includes('questions') && (
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-2">
                <div className="text-sm font-medium text-gray-700">Add-ons / Questions</div>
                <button
                  type="button"
                  className="rounded border border-gray-300 px-3 py-1.5 text-xs text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                  onClick={() => setQuestions([emptyQuestion()])}
                  disabled={isSubmitting}
                >
                  Start from empty
                </button>
              </div>
              {questionsLoading ? (
                <div className="text-sm text-gray-500">Loading booking service options…</div>
              ) : (
                <BookingServiceQuestionsBuilder
                  value={questions}
                  onChange={setQuestions}
                  bookingServiceOptions={bookingServiceOptions}
                  disabled={isSubmitting}
                />
              )}
              <p className="text-xs text-amber-700">
                Bulk update will overwrite Add-ons / Questions for all selected services.
              </p>
            </div>
          )}
        </div>
      </div>
    </CrmFormModalShell>
  )
}

