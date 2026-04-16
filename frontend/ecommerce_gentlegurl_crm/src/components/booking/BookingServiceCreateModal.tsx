/**
 * Booking service creation requires multipart when uploading image.
 * Backend also requires `service_type` to be present.
 */
'use client'

import { ChangeEvent, FormEvent, useEffect, useRef, useState } from 'react'

import type { BookingServiceRowData } from './BookingServiceRow'
import BookingServiceAllowedStaffPicker, {
  type BookingStaffOption,
} from './BookingServiceAllowedStaffPicker'
import BookingServiceQuestionsBuilder, { type QuestionForm } from './BookingServiceQuestionsBuilder'
import { mapBookingServiceApiItemToRow, type BookingServiceApiItem } from './bookingServiceUtils'
import { useI18n } from '@/lib/i18n'
import { IMAGE_ACCEPT } from '../mediaAccept'

type ServiceType = 'premium' | 'standard'

interface BookingServiceCreateModalProps {
  onClose: () => void
  onSuccess: (service: BookingServiceRowData) => void
}

type PriceMode = 'fixed' | 'range'

interface FormState {
  name: string
  description: string
  service_type: ServiceType
  duration_min: string
  price_mode: PriceMode
  service_price: string
  price_range_min: string
  price_range_max: string
  deposit_amount: string
  buffer_min: string
  is_active: boolean
  imageFile: File | null
  allowed_staff_ids: number[]
  primary_slots: string
  questions: QuestionForm[]
}
type BookingServiceOption = { id: number; name: string; duration_min: number; service_price: number }

const initialFormState: FormState = {
  name: '',
  description: '',
  service_type: 'standard',
  duration_min: '30',
  price_mode: 'fixed',
  service_price: '0',
  price_range_min: '0',
  price_range_max: '0',
  deposit_amount: '0',
  buffer_min: '15',
  is_active: true,
  imageFile: null,
  allowed_staff_ids: [],
  primary_slots: '',
  questions: [],
}

export default function BookingServiceCreateModal({
  onClose,
  onSuccess,
}: BookingServiceCreateModalProps) {
  const { t } = useI18n()
  const [form, setForm] = useState<FormState>({ ...initialFormState })
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const [staffOptions, setStaffOptions] = useState<BookingStaffOption[]>([])
  const [bookingServiceOptions, setBookingServiceOptions] = useState<BookingServiceOption[]>([])
  const [staffLoading, setStaffLoading] = useState(true)
  const imageInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    let ignore = false

    const loadStaffs = async () => {
      setStaffLoading(true)
      try {
        const res = await fetch('/api/proxy/staffs?per_page=200&is_active=true', { cache: 'no-store' })
        if (!res.ok) {
          if (!ignore) setStaffOptions([])
          return
        }
        const json = await res.json().catch(() => null)
        const payload = (json && typeof json === 'object' && 'data' in json)
          ? (json as { data?: { data?: unknown[] } | unknown[] }).data
          : null

        const rows = Array.isArray((payload as { data?: unknown[] } | null)?.data)
          ? ((payload as { data?: unknown[] }).data ?? [])
          : Array.isArray(payload)
            ? payload
            : []

        const mapped = rows
          .map((row): BookingStaffOption | null => {
            if (!row || typeof row !== 'object') return null
            const maybe = row as Record<string, unknown>
            const id = Number(maybe.id)
            const name = String(maybe.name ?? '').trim()
            if (!id || !name) return null
            return { id, name }
          })
          .filter((row): row is BookingStaffOption => Boolean(row))

        if (!ignore) setStaffOptions(mapped)
      } catch {
        if (!ignore) setStaffOptions([])
      } finally {
        if (!ignore) setStaffLoading(false)
      }
    }

    void loadStaffs()
    return () => { ignore = true }
  }, [])

  useEffect(() => {
    let ignore = false

    const loadBookingServices = async () => {
      try {
        const res = await fetch('/api/proxy/admin/booking/services?per_page=200', { cache: 'no-store' })
        if (!res.ok) {
          if (!ignore) setBookingServiceOptions([])
          return
        }
        const json = await res.json().catch(() => null)
        const payload = (json && typeof json === 'object' && 'data' in json)
          ? (json as { data?: { data?: unknown[] } | unknown[] }).data
          : null
        const rows = Array.isArray((payload as { data?: unknown[] } | null)?.data)
          ? ((payload as { data?: unknown[] }).data ?? [])
          : Array.isArray(payload)
            ? payload
            : []

        const mapped = rows
          .map((row): BookingServiceOption | null => {
            if (!row || typeof row !== 'object') return null
            const maybe = row as Record<string, unknown>
            const id = Number(maybe.id)
            const name = String(maybe.name ?? '').trim()
            if (!id || !name) return null
            return {
              id,
              name,
              duration_min: Math.max(0, Number(maybe.duration_min ?? 0)),
              service_price: Math.max(0, Number(maybe.service_price ?? 0)),
            }
          })
          .filter((row): row is BookingServiceOption => Boolean(row))

        if (!ignore) setBookingServiceOptions(mapped)
      } catch {
        if (!ignore) setBookingServiceOptions([])
      }
    }

    void loadBookingServices()
    return () => { ignore = true }
  }, [])

  const handleChange = (
    event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>,
  ) => {
    const { name, value, type } = event.target
    if (type === 'checkbox') {
      const checked = (event.target as HTMLInputElement).checked
      setForm((prev) => ({ ...prev, [name]: checked }))
      return
    }
    if (name === 'is_active') {
      setForm((prev) => ({ ...prev, is_active: value === 'true' }))
      return
    }
    setForm((prev) => ({ ...prev, [name]: value }))
  }

  const handleImageChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return
    setForm((prev) => ({ ...prev, imageFile: file }))
    const reader = new FileReader()
    reader.onloadend = () => setImagePreview(reader.result as string)
    reader.readAsDataURL(file)
  }

  const handleImageClick = () => imageInputRef.current?.click()

  const handleRemoveImage = () => {
    setForm((prev) => ({ ...prev, imageFile: null }))
    setImagePreview(null)
    if (imageInputRef.current) imageInputRef.current.value = ''
  }


  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    const trimmedName = form.name.trim()
    if (!trimmedName) {
      setError('Name is required')
      return
    }

    const duration = Number(form.duration_min)
    const servicePrice = Number(form.service_price)
    const rangeMin = Number(form.price_range_min)
    const rangeMax = Number(form.price_range_max)
    const deposit = Number(form.deposit_amount)
    const buffer = Number(form.buffer_min)

    if (!Number.isFinite(duration) || duration <= 0) {
      setError('Duration must be greater than 0')
      return
    }
    if (form.price_mode === 'fixed') {
      if (!Number.isFinite(servicePrice) || servicePrice < 0) {
        setError('Service price must be 0 or greater')
        return
      }
    } else {
      if (!Number.isFinite(rangeMin) || rangeMin < 0) {
        setError('Range min price must be 0 or greater')
        return
      }
      if (!Number.isFinite(rangeMax) || rangeMax < 0) {
        setError('Range max price must be 0 or greater')
        return
      }
      if (rangeMax < rangeMin) {
        setError('Range max must be greater than or equal to range min')
        return
      }
    }
    if (!Number.isFinite(deposit) || deposit < 0) {
      setError('Deposit must be 0 or greater')
      return
    }
    if (!Number.isFinite(buffer) || buffer < 0) {
      setError('Buffer must be 0 or greater')
      return
    }

    if (form.allowed_staff_ids.length === 0) {
      setError('Please assign at least 1 allowed staff')
      return
    }
    const missingLinkedService = form.questions.some((question) =>
      question.options.some((option) => !option.linked_booking_service_id.trim()),
    )
    if (missingLinkedService) {
      setError('Each add-on option must select a linked booking service')
      return
    }

    setSubmitting(true)
    setError(null)

    try {
      const fd = new FormData()
      fd.append('name', trimmedName)
      fd.append('description', form.description.trim())
      fd.append('service_type', form.service_type)
      fd.append('duration_min', String(duration))
      fd.append('price_mode', form.price_mode)
      if (form.price_mode === 'fixed') {
        fd.append('service_price', String(servicePrice))
      } else {
        fd.append('service_price', String(rangeMin))
        fd.append('price_range_min', String(rangeMin))
        fd.append('price_range_max', String(rangeMax))
      }
      fd.append('deposit_amount', String(deposit))
      fd.append('buffer_min', String(buffer))
      fd.append('is_active', form.is_active ? '1' : '0')
      form.allowed_staff_ids.forEach((staffId) => fd.append('allowed_staff_ids[]', String(staffId)))
      form.primary_slots.split(',').map((time) => time.trim()).filter(Boolean).forEach((time) => fd.append('primary_slots[]', time))
      form.questions.forEach((question, questionIndex) => {
        fd.append(`questions[${questionIndex}][title]`, question.title.trim())
        fd.append(`questions[${questionIndex}][description]`, question.description.trim())
        fd.append(`questions[${questionIndex}][question_type]`, question.question_type)
        fd.append(`questions[${questionIndex}][sort_order]`, String(questionIndex))
        fd.append(`questions[${questionIndex}][is_required]`, question.is_required ? '1' : '0')
        fd.append(`questions[${questionIndex}][is_active]`, question.is_active ? '1' : '0')
        question.options.forEach((option, optionIndex) => {
          fd.append(`questions[${questionIndex}][options][${optionIndex}][label]`, option.label.trim())
          fd.append(`questions[${questionIndex}][options][${optionIndex}][linked_booking_service_id]`, option.linked_booking_service_id.trim())
          fd.append(`questions[${questionIndex}][options][${optionIndex}][sort_order]`, String(optionIndex))
          fd.append(`questions[${questionIndex}][options][${optionIndex}][is_active]`, option.is_active ? '1' : '0')
        })
      })
      if (form.imageFile) fd.append('image', form.imageFile)

      const res = await fetch('/api/proxy/admin/booking/services', {
        method: 'POST',
        headers: { Accept: 'application/json' },
        body: fd,
      })

      const data = await res.json().catch(() => null)
      if (!res.ok) {
        setError((data as { message?: string } | null)?.message ?? 'Failed to create booking service')
        return
      }

      const created = mapBookingServiceApiItemToRow((data?.data ?? {}) as BookingServiceApiItem)
      setForm({ ...initialFormState })
      setImagePreview(null)
      onSuccess(created)
    } catch (err) {
      console.error(err)
      setError('Failed to create booking service')
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
      <div className="relative w-full max-w-6xl mx-auto bg-white rounded-lg shadow-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between border-b border-gray-300 px-5 py-4 sticky top-0 bg-white z-10">
          <h2 className="text-lg font-semibold">Create Booking Service</h2>
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

        <form onSubmit={handleSubmit} className="p-5">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
            {/* Left Side - Image Upload */}
            <div className="space-y-4 w-full lg:w-1/2">
              <div>
                <h3 className="text-sm font-medium text-gray-700 mb-1">Image</h3>
                <div
                  onClick={handleImageClick}
                  className={`relative border-2 border-dashed rounded-lg p-4 cursor-pointer transition-colors ${
                    imagePreview ? 'border-gray-300' : 'border-gray-300 hover:border-blue-400'
                  }`}
                >
                  <input
                    ref={imageInputRef}
                    type="file"
                    accept={IMAGE_ACCEPT}
                    onChange={handleImageChange}
                    className="hidden"
                    disabled={submitting}
                  />
                  {imagePreview ? (
                    <div className="relative group">
                      <img
                        src={imagePreview}
                        alt="Service Image Preview"
                        className="w-full h-48 object-contain rounded"
                      />
                      <div className="absolute top-2 right-2 flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation()
                            handleImageClick()
                          }}
                          className="w-8 h-8 bg-blue-500/95 backdrop-blur-md text-white rounded-full flex items-center justify-center shadow-lg border border-blue-400/30 hover:bg-blue-600 hover:shadow-xl hover:scale-110 transition-all duration-200"
                          aria-label="Replace image"
                          disabled={submitting}
                        >
                          <i className="fa-solid fa-image text-xs" />
                        </button>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation()
                            handleRemoveImage()
                          }}
                          className="w-8 h-8 bg-red-500/95 backdrop-blur-md text-white rounded-full flex items-center justify-center shadow-lg border border-red-400/30 hover:bg-red-600 hover:shadow-xl hover:scale-110 transition-all duration-200"
                          aria-label="Delete image"
                          disabled={submitting}
                        >
                          <i className="fa-solid fa-trash-can text-xs" />
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center py-8">
                      <i className="fa-solid fa-cloud-arrow-up text-4xl text-gray-400 mb-2" />
                      <p className="text-sm text-gray-600">Click to upload</p>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Right Side - Form Fields */}
            <div className="space-y-4 w-full lg:w-1/2">
              <div>
                <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1">
                  Name <span className="text-red-500">*</span>
                </label>
                <input
                  id="name"
                  name="name"
                  type="text"
                  value={form.name}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Service name"
                  disabled={submitting}
                />
              </div>

              <div>
                <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-1">
                  Description
                </label>
                <textarea
                  id="description"
                  name="description"
                  value={form.description}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Service description"
                  rows={3}
                  disabled={submitting}
                />
              </div>
            </div>
          </div>

          <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-4">
            <div>
              <label
                htmlFor="service_type"
                className="block text-sm font-medium text-gray-700 mb-1"
              >
                Service Type <span className="text-red-500">*</span>
              </label>
              <select
                id="service_type"
                name="service_type"
                value={form.service_type}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-blue-500 focus:border-blue-500"
                disabled={submitting}
              >
                <option value="standard">Standard</option>
                <option value="premium">Premium</option>
              </select>
            </div>

            <div>
              <label htmlFor="duration_min" className="block text-sm font-medium text-gray-700 mb-1">
                Duration (min) <span className="text-red-500">*</span>
              </label>
              <input
                id="duration_min"
                name="duration_min"
                type="number"
                min={1}
                value={form.duration_min}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-blue-500 focus:border-blue-500"
                placeholder="30"
                disabled={submitting}
              />
            </div>

            <div>
              <label htmlFor="price_mode" className="block text-sm font-medium text-gray-700 mb-1">
                Price Mode <span className="text-red-500">*</span>
              </label>
              <select
                id="price_mode"
                name="price_mode"
                value={form.price_mode}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-blue-500 focus:border-blue-500"
                disabled={submitting}
              >
                <option value="fixed">Fixed</option>
                <option value="range">Range</option>
              </select>
            </div>

            {form.price_mode === 'fixed' ? (
              <div>
                <label htmlFor="service_price" className="block text-sm font-medium text-gray-700 mb-1">
                  Service Price <span className="text-red-500">*</span>
                </label>
                <input
                  id="service_price"
                  name="service_price"
                  type="number"
                  min={0}
                  step="0.01"
                  value={form.service_price}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-blue-500 focus:border-blue-500"
                  placeholder="0"
                  disabled={submitting}
                />
              </div>
            ) : (
              <>
                <div>
                  <label htmlFor="price_range_min" className="block text-sm font-medium text-gray-700 mb-1">
                    Price Range Min <span className="text-red-500">*</span>
                  </label>
                  <input
                    id="price_range_min"
                    name="price_range_min"
                    type="number"
                    min={0}
                    step="0.01"
                    value={form.price_range_min}
                    onChange={handleChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-blue-500 focus:border-blue-500"
                    placeholder="0"
                    disabled={submitting}
                  />
                </div>
                <div>
                  <label htmlFor="price_range_max" className="block text-sm font-medium text-gray-700 mb-1">
                    Price Range Max <span className="text-red-500">*</span>
                  </label>
                  <input
                    id="price_range_max"
                    name="price_range_max"
                    type="number"
                    min={0}
                    step="0.01"
                    value={form.price_range_max}
                    onChange={handleChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-blue-500 focus:border-blue-500"
                    placeholder="0"
                    disabled={submitting}
                  />
                </div>
              </>
            )}

            <div>
              <label htmlFor="deposit_amount" className="block text-sm font-medium text-gray-700 mb-1">
                Deposit Amount <span className="text-red-500">*</span>
              </label>
              <input
                id="deposit_amount"
                name="deposit_amount"
                type="number"
                min={0}
                step="0.01"
                value={form.deposit_amount}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-blue-500 focus:border-blue-500"
                placeholder="0"
                disabled={submitting}
              />
            </div>

            <div>
              <label htmlFor="buffer_min" className="block text-sm font-medium text-gray-700 mb-1">
                Buffer (min) <span className="text-red-500">*</span>
              </label>
              <input
                id="buffer_min"
                name="buffer_min"
                type="number"
                min={0}
                value={form.buffer_min}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-blue-500 focus:border-blue-500"
                placeholder="15"
                disabled={submitting}
              />
            </div>

            <div className="min-w-0">
              <BookingServiceAllowedStaffPicker
                staffOptions={staffOptions}
                value={form.allowed_staff_ids}
                onChange={(ids) => setForm((prev) => ({ ...prev, allowed_staff_ids: ids }))}
                disabled={submitting}
                loading={staffLoading}
              />
            </div>

            <div>
              <label htmlFor="primary_slots" className="block text-sm font-medium text-gray-700 mb-1">
                Primary slot times (HH:mm, comma-separated)
              </label>
              <input
                id="primary_slots"
                name="primary_slots"
                type="text"
                value={form.primary_slots}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-blue-500 focus:border-blue-500"
                placeholder="12:00, 15:00, 18:00"
                disabled={submitting}
              />
            </div>
            <div>
              <label htmlFor="create-isActive" className="block text-sm font-medium text-gray-700 mb-1">
                Status
              </label>
              <select
                id="create-isActive"
                name="is_active"
                value={form.is_active ? 'true' : 'false'}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-blue-500 focus:border-blue-500"
                disabled={submitting}
              >
                <option value="true">Active</option>
                <option value="false">Inactive</option>
              </select>
            </div>
          </div>

          <div className="mt-6 w-full">
            <BookingServiceQuestionsBuilder
              value={form.questions}
              onChange={(questions) => setForm((prev) => ({ ...prev, questions }))}
              bookingServiceOptions={bookingServiceOptions}
              disabled={submitting}
            />
          </div>

          {error && (
            <div className="mt-4 text-sm text-red-600" role="alert">
              {error}
            </div>
          )}

          <div className="mt-6 flex items-center justify-end gap-3 border-t border-gray-200 pt-4">
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
