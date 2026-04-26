'use client'

import { ChangeEvent, FormEvent, useEffect, useRef, useState } from 'react'

import type { BookingServiceRowData } from './BookingServiceRow'
import BookingServiceAllowedStaffPicker, {
  type BookingStaffOption,
} from './BookingServiceAllowedStaffPicker'
import BookingServiceQuestionsBuilder, { emptyQuestionOption, type QuestionForm } from './BookingServiceQuestionsBuilder'
import { mapBookingServiceApiItemToRow, type BookingServiceApiItem } from './bookingServiceUtils'
import { useI18n } from '@/lib/i18n'
import { IMAGE_ACCEPT } from '../mediaAccept'

interface BookingServiceEditModalProps {
  serviceId: number
  onClose: () => void
  onSuccess: (service: BookingServiceRowData) => void
}

type ServiceType = 'premium' | 'standard'
type PriceMode = 'fixed' | 'range'
type BookingServiceApiItemWithType = BookingServiceApiItem & {
  service_type?: ServiceType | string | null
  price_mode?: string | null
  price_range_min?: string | number | null
  price_range_max?: string | number | null
}

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
  is_active: 'true' | 'false'
  allow_photo_upload: 'true' | 'false'
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
  is_active: 'true',
  allow_photo_upload: 'false',
  imageFile: null,
  allowed_staff_ids: [],
  primary_slots: '',
  questions: [],
}

export default function BookingServiceEditModal({
  serviceId,
  onClose,
  onSuccess,
}: BookingServiceEditModalProps) {
  const { t } = useI18n()
  const [form, setForm] = useState<FormState>({ ...initialFormState })
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loadedService, setLoadedService] = useState<BookingServiceRowData | null>(null)
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const [staffOptions, setStaffOptions] = useState<BookingStaffOption[]>([])
  const [bookingServiceOptions, setBookingServiceOptions] = useState<BookingServiceOption[]>([])
  const [staffLoading, setStaffLoading] = useState(true)
  const imageInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const controller = new AbortController()

    const loadService = async () => {
      setLoading(true)
      setError(null)
      try {
        const res = await fetch(`/api/proxy/admin/booking/services/${serviceId}`, {
          cache: 'no-store',
          signal: controller.signal,
          headers: {
            Accept: 'application/json',
          },
        })

        const data = await res.json().catch(() => null)
        if (data && typeof data === 'object') {
          if (data?.success === false && data?.message === 'Unauthorized') {
            window.location.replace('/dashboard')
            return
          }
        }

        if (!res.ok) {
          if (data && typeof data === 'object' && 'message' in data) {
            const message = (data as { message?: unknown }).message
            if (typeof message === 'string') {
              setError(message)
              return
            }
          }
          setError('Failed to load booking service')
          return
        }

        const service = data?.data as BookingServiceApiItemWithType | undefined
        if (!service || typeof service !== 'object') {
          setError('Failed to load booking service')
          return
        }

        const mappedService = mapBookingServiceApiItemToRow(service)
        setLoadedService(mappedService)
        setImagePreview(mappedService.imageUrl || null)

        setForm({
          name: typeof service.name === 'string' ? service.name : '',
          description: typeof service.description === 'string' ? service.description : '',
          service_type:
            service.service_type === 'premium' || service.service_type === 'standard'
              ? service.service_type
              : 'standard',
          duration_min: String(service.duration_min ?? 30),
          price_mode: service.price_mode === 'range' ? 'range' : 'fixed',
          service_price: String(service.service_price ?? 0),
          price_range_min: String(service.price_range_min ?? 0),
          price_range_max: String(service.price_range_max ?? 0),
          deposit_amount: String(service.deposit_amount ?? 0),
          buffer_min: String(service.buffer_min ?? 15),
          is_active:
            service.is_active === true || service.is_active === 'true' || service.is_active === 1
              ? 'true'
              : 'false',
          allow_photo_upload:
            service.allow_photo_upload === true || service.allow_photo_upload === 'true' || service.allow_photo_upload === 1
              ? 'true'
              : 'false',
          imageFile: null,
          primary_slots: Array.isArray((service as { primary_slots?: Array<{ start_time?: string }> }).primary_slots)
            ? ((service as { primary_slots?: Array<{ start_time?: string }> }).primary_slots ?? []).map((slot) => slot?.start_time ?? '').filter(Boolean).join(', ')
            : '',
          questions: Array.isArray((service as { questions?: unknown[] }).questions)
            ? ((service as {
                questions?: Array<{
                  id?: number
                  title?: string
                  description?: string | null
                  question_type?: 'single_choice' | 'multi_choice'
                  sort_order?: number
                  is_required?: boolean
                  is_active?: boolean
                  options?: Array<{
                    id?: number
                    label?: string
                    linked_booking_service_id?: number | null
                    extra_duration_min?: number
                    extra_price?: number
                    sort_order?: number
                    is_active?: boolean
                  }>
                }>
              }).questions ?? []).map((question, questionIndex) => ({
                id: question?.id,
                title: question?.title ?? '',
                description: question?.description ?? '',
                question_type: question?.question_type === 'multi_choice' ? 'multi_choice' : 'single_choice',
                sort_order: String(question?.sort_order ?? questionIndex),
                is_required: Boolean(question?.is_required),
                is_active: question?.is_active !== false,
                options: Array.isArray(question?.options) && question.options.length > 0
                  ? question.options.map((option, optionIndex) => ({
                    id: option?.id,
                    label: option?.label ?? '',
                    linked_booking_service_id: option?.linked_booking_service_id ? String(option?.linked_booking_service_id) : '',
                    sort_order: String(option?.sort_order ?? optionIndex),
                    is_active: option?.is_active !== false,
                  }))
                  : [emptyQuestionOption()],
              }))
            : [],
          allowed_staff_ids: Array.isArray((service as { allowed_staff_ids?: unknown }).allowed_staff_ids)
            ? ((service as { allowed_staff_ids?: unknown[] }).allowed_staff_ids ?? []).map((id) => Number(id)).filter((id) => Number.isFinite(id) && id > 0)
            : Array.isArray((service as { allowed_staffs?: Array<{ id?: unknown }> }).allowed_staffs)
              ? ((service as { allowed_staffs?: Array<{ id?: unknown }> }).allowed_staffs ?? []).map((staff) => Number(staff?.id)).filter((id) => Number.isFinite(id) && id > 0)
              : [],
        })
      } catch (err) {
        if (!(err instanceof DOMException && err.name === 'AbortError')) {
          setError('Failed to load booking service')
        }
      } finally {
        setLoading(false)
      }
    }

    loadService().catch(() => {
      setLoading(false)
      setError('Failed to load booking service')
    })

    return () => controller.abort()
  }, [serviceId])


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
        const controller = new AbortController()
        const perPage = 200
        const collected = new Map<number, BookingServiceOption>()

        for (let page = 1; page <= 50; page += 1) {
          const res = await fetch(
            `/api/proxy/admin/booking/services?page=${page}&per_page=${perPage}`,
            { cache: 'no-store', signal: controller.signal },
          )
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
            const maybe = row as Record<string, unknown>
            const id = Number(maybe.id)
            const name = String(maybe.name ?? '').trim()
            if (!id || !name) continue
            if (id === serviceId) continue
            collected.set(id, {
              id,
              name,
              duration_min: Math.max(0, Number(maybe.duration_min ?? 0)),
              service_price: Math.max(0, Number(maybe.service_price ?? 0)),
            })
          }

          const lastPage =
            payload && typeof payload === 'object' && 'last_page' in payload
              ? Number((payload as { last_page?: unknown }).last_page)
              : NaN

          if (Number.isFinite(lastPage) && page >= lastPage) break
          if (rows.length < perPage) break
        }

        if (!ignore) {
          setBookingServiceOptions(Array.from(collected.values()))
        }
      } catch {
        if (!ignore) setBookingServiceOptions([])
      }
    }

    void loadBookingServices()
    return () => { ignore = true }
  }, [serviceId])

  const handleChange = (
    event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>,
  ) => {
    const { name, value } = event.target
    setForm((prev) => ({ ...prev, [name]: value }))
  }

  const handleImageChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return
    setForm((prev) => ({ ...prev, imageFile: file }))
    const reader = new FileReader()
    reader.onloadend = () => {
      setImagePreview(reader.result as string)
    }
    reader.readAsDataURL(file)
  }

  const handleImageClick = () => {
    imageInputRef.current?.click()
  }

  const handleRemoveImage = () => {
    setForm((prev) => ({ ...prev, imageFile: null }))
    setImagePreview(loadedService?.imageUrl || null)
    if (imageInputRef.current) {
      imageInputRef.current.value = ''
    }
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
      fd.append('_method', 'PUT')
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
      fd.append('is_active', form.is_active === 'true' ? '1' : '0')
      fd.append('allow_photo_upload', form.allow_photo_upload === 'true' ? '1' : '0')
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
      if (form.imageFile) {
        fd.append('image', form.imageFile)
      }

      const res = await fetch(`/api/proxy/admin/booking/services/${serviceId}`, {
        method: 'POST',
        headers: {
          Accept: 'application/json',
        },
        body: fd,
      })

      const data = await res.json().catch(() => null)
      if (data && typeof data === 'object') {
        if (data?.success === false && data?.message === 'Unauthorized') {
          window.location.replace('/dashboard')
          return
        }
      }

      if (!res.ok) {
        if (data && typeof data === 'object') {
          if ('message' in data && typeof data.message === 'string') {
            setError(data.message)
            return
          }
          if ('errors' in data && typeof data.errors === 'object') {
            const errors = data.errors as Record<string, unknown>
            const firstKey = Object.keys(errors)[0]
            if (firstKey) {
              const firstValue = errors[firstKey]
              if (Array.isArray(firstValue) && typeof firstValue[0] === 'string') {
                setError(firstValue[0])
                return
              }
              if (typeof firstValue === 'string') {
                setError(firstValue)
                return
              }
            }
          }
        }
        setError('Failed to update booking service')
        return
      }

      const payloadData =
        data && typeof data === 'object' && 'data' in data
          ? ((data as { data?: BookingServiceApiItem | null }).data ?? null)
          : null

      const serviceRow: BookingServiceRowData = payloadData
        ? mapBookingServiceApiItemToRow(payloadData)
        : {
            id: loadedService?.id ?? serviceId,
            name: trimmedName,
            description: form.description.trim(),
            duration_min: duration,
            service_price: servicePrice,
            deposit_amount: deposit,
            buffer_min: buffer,
            isActive: form.is_active === 'true',
            allowPhotoUpload: form.allow_photo_upload === 'true',
            imagePath: loadedService?.imagePath ?? '',
            imageUrl: loadedService?.imageUrl ?? '',
            createdAt: loadedService?.createdAt,
          }

      setLoadedService(serviceRow)
      onSuccess(serviceRow)
    } catch (err) {
      console.error(err)
      setError('Failed to update booking service')
    } finally {
      setSubmitting(false)
    }
  }

  const disableForm = loading || submitting

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
          <h2 className="text-lg font-semibold">Edit Booking Service</h2>
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
          {loading ? (
            <div className="py-8 text-center text-sm text-gray-500">{t('common.loadingDetails')}</div>
          ) : (
            <>
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
                      disabled={disableForm}
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
                            disabled={disableForm}
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
                            disabled={disableForm}
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
                  <label
                    htmlFor="edit-name"
                    className="block text-sm font-medium text-gray-700 mb-1"
                  >
                    Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    id="edit-name"
                    name="name"
                    type="text"
                    value={form.name}
                    onChange={handleChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-blue-500 focus:border-blue-500"
                    placeholder="Service name"
                    disabled={disableForm}
                  />
                </div>

                <div>
                  <label
                    htmlFor="edit-description"
                    className="block text-sm font-medium text-gray-700 mb-1"
                  >
                    Description
                  </label>
                  <textarea
                    id="edit-description"
                    name="description"
                    value={form.description}
                    onChange={handleChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-blue-500 focus:border-blue-500"
                    placeholder="Service description"
                    rows={3}
                    disabled={disableForm}
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
                  disabled={disableForm}
                >
                  <option value="standard">Standard</option>
                  <option value="premium">Premium</option>
                </select>
              </div>

              <div>
                <label
                  htmlFor="edit-duration_min"
                  className="block text-sm font-medium text-gray-700 mb-1"
                >
                  Duration (min) <span className="text-red-500">*</span>
                </label>
                <input
                  id="edit-duration_min"
                  name="duration_min"
                  type="number"
                  min={1}
                  value={form.duration_min}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-blue-500 focus:border-blue-500"
                  placeholder="30"
                  disabled={disableForm}
                />
              </div>

              <div>
                <label
                  htmlFor="edit-price_mode"
                  className="block text-sm font-medium text-gray-700 mb-1"
                >
                  Price Mode <span className="text-red-500">*</span>
                </label>
                <select
                  id="edit-price_mode"
                  name="price_mode"
                  value={form.price_mode}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-blue-500 focus:border-blue-500"
                  disabled={disableForm}
                >
                  <option value="fixed">Fixed</option>
                  <option value="range">Range</option>
                </select>
              </div>

              {form.price_mode === 'fixed' ? (
                <div>
                  <label
                    htmlFor="edit-service_price"
                    className="block text-sm font-medium text-gray-700 mb-1"
                  >
                    Service Price <span className="text-red-500">*</span>
                  </label>
                  <input
                    id="edit-service_price"
                    name="service_price"
                    type="number"
                    min={0}
                    step="0.01"
                    value={form.service_price}
                    onChange={handleChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-blue-500 focus:border-blue-500"
                    placeholder="0"
                    disabled={disableForm}
                  />
                </div>
              ) : (
                <>
                  <div>
                    <label
                      htmlFor="edit-price_range_min"
                      className="block text-sm font-medium text-gray-700 mb-1"
                    >
                      Price Range Min <span className="text-red-500">*</span>
                    </label>
                    <input
                      id="edit-price_range_min"
                      name="price_range_min"
                      type="number"
                      min={0}
                      step="0.01"
                      value={form.price_range_min}
                      onChange={handleChange}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-blue-500 focus:border-blue-500"
                      placeholder="0"
                      disabled={disableForm}
                    />
                  </div>
                  <div>
                    <label
                      htmlFor="edit-price_range_max"
                      className="block text-sm font-medium text-gray-700 mb-1"
                    >
                      Price Range Max <span className="text-red-500">*</span>
                    </label>
                    <input
                      id="edit-price_range_max"
                      name="price_range_max"
                      type="number"
                      min={0}
                      step="0.01"
                      value={form.price_range_max}
                      onChange={handleChange}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-blue-500 focus:border-blue-500"
                      placeholder="0"
                      disabled={disableForm}
                    />
                  </div>
                </>
              )}

              <div>
                <label
                  htmlFor="edit-deposit_amount"
                  className="block text-sm font-medium text-gray-700 mb-1"
                >
                  Deposit Amount <span className="text-red-500">*</span>
                </label>
                <input
                  id="edit-deposit_amount"
                  name="deposit_amount"
                  type="number"
                  min={0}
                  step="0.01"
                  value={form.deposit_amount}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-blue-500 focus:border-blue-500"
                  placeholder="0"
                  disabled={disableForm}
                />
              </div>

              <div>
                <label
                  htmlFor="edit-buffer_min"
                  className="block text-sm font-medium text-gray-700 mb-1"
                >
                  Buffer (min) <span className="text-red-500">*</span>
                </label>
                <input
                  id="edit-buffer_min"
                  name="buffer_min"
                  type="number"
                  min={0}
                  value={form.buffer_min}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-blue-500 focus:border-blue-500"
                  placeholder="15"
                  disabled={disableForm}
                />
              </div>

              <div className="min-w-0">
                <BookingServiceAllowedStaffPicker
                  staffOptions={staffOptions}
                  value={form.allowed_staff_ids}
                  onChange={(ids) => setForm((prev) => ({ ...prev, allowed_staff_ids: ids }))}
                  disabled={disableForm}
                  loading={staffLoading}
                />
              </div>

              <div>
                <label htmlFor="edit-primary_slots" className="block text-sm font-medium text-gray-700 mb-1">
                  Primary slot times (HH:mm, comma-separated)
                </label>
                <input
                  id="edit-primary_slots"
                  name="primary_slots"
                  type="text"
                  value={form.primary_slots}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-blue-500 focus:border-blue-500"
                  placeholder="12:00, 15:00, 18:00"
                  disabled={disableForm}
                />
              </div>
              <div>
                <label htmlFor="edit-isActive" className="block text-sm font-medium text-gray-700 mb-1">
                  Status
                </label>
                <select
                  id="edit-isActive"
                  name="is_active"
                  value={form.is_active}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-blue-500 focus:border-blue-500"
                  disabled={disableForm}
                >
                  <option value="true">Active</option>
                  <option value="false">Inactive</option>
                </select>
              </div>
              <div>
                <label htmlFor="edit-allowPhotoUpload" className="block text-sm font-medium text-gray-700 mb-1">
                  Allow Photo Upload (Max 3 photos)
                </label>
                <select
                  id="edit-allowPhotoUpload"
                  name="allow_photo_upload"
                  value={form.allow_photo_upload}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-blue-500 focus:border-blue-500"
                  disabled={disableForm}
                >
                  <option value="false">Disabled</option>
                  <option value="true">Enabled</option>
                </select>
              </div>
            </div>

            <div className="mt-6 w-full">
              <BookingServiceQuestionsBuilder
                value={form.questions}
                onChange={(questions) => setForm((prev) => ({ ...prev, questions }))}
                bookingServiceOptions={bookingServiceOptions}
                disabled={disableForm}
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
                disabled={disableForm}
              >
                {submitting ? t('common.saving') : 'Save Changes'}
              </button>
            </div>
            </>
          )}
        </form>
      </div>
    </div>
  )
}
