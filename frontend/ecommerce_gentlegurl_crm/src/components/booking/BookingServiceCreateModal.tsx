/**
 * Booking service creation requires multipart when uploading image.
 * Backend also requires `service_type` to be present.
 */
'use client'

import { ChangeEvent, FormEvent, useEffect, useLayoutEffect, useRef, useState } from 'react'

import type { BookingServiceRowData } from './BookingServiceRow'
import BookingServiceCategoriesPicker, {
  type BookingServiceCategoryOption,
} from './BookingServiceCategoriesPicker'
import BookingServiceAllowedStaffPicker, {
  type BookingStaffOption,
} from './BookingServiceAllowedStaffPicker'
import BookingServiceQuestionsBuilder, {
  emptyQuestionOption,
  type QuestionForm,
} from './BookingServiceQuestionsBuilder'
import {
  BOOKING_SERVICE_COVER_IMAGE_SUGGESTED_SIZE_LINE,
  extractBookingServiceApiErrorMessage,
  mapBookingServiceApiItemToRow,
  type BookingServiceApiItem,
} from './bookingServiceUtils'
import BookingServiceProductLinkPanel, {
  appendProductLinkFormData,
  buildInitialProductLinkValue,
  type BookingServiceProductLinkValue,
} from './BookingServiceProductLinkPanel'
import { useI18n } from '@/lib/i18n'
import { compressImage } from '@/lib/compressImage'
import { IMAGE_ACCEPT } from '../mediaAccept'
import CrmFormModalShell from '@/components/CrmFormModalShell'
import FormErrorAnchor from '@/components/FormErrorAnchor'

const bookingServiceCreateFormId = 'booking-service-create-form'

type ServiceType = 'premium' | 'standard'

interface BookingServiceCreateModalProps {
  onClose: () => void
  onSuccess: (service: BookingServiceRowData) => void
  /** When set, fetches this service and prefills the create form (new POST, no ids on questions/options). */
  copyFromServiceId?: number | null
}

type PriceMode = 'fixed' | 'range'

interface FormState {
  name: string
  cn_name: string
  description: string
  service_type: ServiceType
  categoryIds: number[]
  duration_min: string
  price_mode: PriceMode
  service_price: string
  price_range_min: string
  price_range_max: string
  deposit_amount: string
  buffer_min: string
  is_active: boolean
  allow_photo_upload: boolean
  imageFile: File | null
  allowed_staff_ids: number[]
  primary_slots: string
  questions: QuestionForm[]
}
type BookingServiceOption = { id: number; name: string; cn_name?: string | null; duration_min: number; service_price: number }

const extractCategoryIdsFromService = (service: BookingServiceApiItem): number[] => {
  if (Array.isArray(service.category_ids)) {
    return service.category_ids.map((id) => Number(id)).filter((id) => Number.isFinite(id) && id > 0)
  }
  if (service.category_id != null) {
    const id = Number(service.category_id)
    return Number.isFinite(id) && id > 0 ? [id] : []
  }
  if (Array.isArray(service.categories)) {
    return service.categories
      .map((category) => Number(category?.id))
      .filter((id) => Number.isFinite(id) && id > 0)
  }
  return []
}

const initialFormState: FormState = {
  name: '',
  cn_name: '',
  description: '',
  service_type: 'standard',
  categoryIds: [],
  duration_min: '30',
  price_mode: 'fixed',
  service_price: '0',
  price_range_min: '0',
  price_range_max: '0',
  deposit_amount: '0',
  buffer_min: '15',
  is_active: true,
  allow_photo_upload: false,
  imageFile: null,
  allowed_staff_ids: [],
  primary_slots: '',
  questions: [],
}

type BookingServiceApiItemWithRelations = BookingServiceApiItem & {
  questions?: Array<{
    id?: number
    title?: string
    cn_title?: string | null
    description?: string | null
    cn_description?: string | null
    question_type?: 'single_choice' | 'multi_choice'
    sort_order?: number
    is_required?: boolean
    is_active?: boolean
    options?: Array<{
      id?: number
      label?: string
      cn_label?: string | null
      linked_booking_service_id?: number | null
      sort_order?: number
      is_active?: boolean
    }>
  }>
  allowed_staff_ids?: unknown[]
  allowed_staffs?: Array<{ id?: unknown }>
  primary_slots?: Array<{ start_time?: string | null }>
}

function mapBookingServiceApiToCreateFormState(service: BookingServiceApiItemWithRelations): FormState {
  const rawName = typeof service.name === 'string' ? service.name.trim() : ''
  const nameWithCopySuffix = rawName ? `${rawName} (Copy)` : 'Untitled (Copy)'

  const questions: QuestionForm[] = Array.isArray(service.questions)
    ? (service.questions ?? []).map((question, questionIndex) => ({
        title: question?.title ?? '',
        cn_title: question?.cn_title ?? '',
        description: question?.description ?? '',
        cn_description: question?.cn_description ?? '',
        question_type: question?.question_type === 'multi_choice' ? 'multi_choice' : 'single_choice',
        sort_order: String(question?.sort_order ?? questionIndex),
        is_required: Boolean(question?.is_required),
        is_active: question?.is_active !== false,
        options:
          Array.isArray(question?.options) && question.options.length > 0
            ? question.options.map((option, optionIndex) => ({
                label: option?.label ?? '',
                cn_label: option?.cn_label ?? '',
                linked_booking_service_id: option?.linked_booking_service_id
                  ? String(option.linked_booking_service_id)
                  : '',
                sort_order: String(option?.sort_order ?? optionIndex),
                is_active: option?.is_active !== false,
                allow_quantity: option?.allow_quantity !== false,
              }))
            : [emptyQuestionOption()],
      }))
    : []

  const allowed_staff_ids = Array.isArray(service.allowed_staff_ids)
    ? (service.allowed_staff_ids ?? []).map((id) => Number(id)).filter((id) => Number.isFinite(id) && id > 0)
    : Array.isArray(service.allowed_staffs)
      ? (service.allowed_staffs ?? []).map((staff) => Number(staff?.id)).filter((id) => Number.isFinite(id) && id > 0)
      : []

  return {
    name: nameWithCopySuffix,
    cn_name: typeof service.cn_name === 'string' ? service.cn_name : '',
    description: typeof service.description === 'string' ? service.description : '',
    service_type:
      service.service_type === 'premium' || service.service_type === 'standard'
        ? service.service_type
        : 'standard',
    categoryIds: extractCategoryIdsFromService(service),
    duration_min: String(service.duration_min ?? 30),
    price_mode: service.price_mode === 'range' ? 'range' : 'fixed',
    service_price: String(service.service_price ?? 0),
    price_range_min: String(service.price_range_min ?? 0),
    price_range_max: String(service.price_range_max ?? 0),
    deposit_amount: String(service.deposit_amount ?? 0),
    buffer_min: String(service.buffer_min ?? 15),
    is_active: service.is_active === true || service.is_active === 'true' || service.is_active === 1,
    allow_photo_upload:
      service.allow_photo_upload === true ||
      service.allow_photo_upload === 'true' ||
      service.allow_photo_upload === 1,
    imageFile: null,
    allowed_staff_ids,
    primary_slots: Array.isArray(service.primary_slots)
      ? (service.primary_slots ?? []).map((slot) => slot?.start_time ?? '').filter(Boolean).join(', ')
      : '',
    questions,
  }
}

export default function BookingServiceCreateModal({
  onClose,
  onSuccess,
  copyFromServiceId = null,
}: BookingServiceCreateModalProps) {
  const { t } = useI18n()
  const copySourceId = (() => {
    const n = Number(copyFromServiceId)
    return Number.isFinite(n) && n > 0 ? n : null
  })()
  const [form, setForm] = useState<FormState>({ ...initialFormState })
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const [staffOptions, setStaffOptions] = useState<BookingStaffOption[]>([])
  const [bookingServiceOptions, setBookingServiceOptions] = useState<BookingServiceOption[]>([])
  const [categoryOptions, setCategoryOptions] = useState<BookingServiceCategoryOption[]>([])
  const [staffLoading, setStaffLoading] = useState(true)
  /** False while copying from server: must track readiness separately from props (first paint can miss copy id). */
  const [copySourceReady, setCopySourceReady] = useState(() => copySourceId == null)
  const [productLink, setProductLink] = useState<BookingServiceProductLinkValue>(buildInitialProductLinkValue())
  const imageInputRef = useRef<HTMLInputElement>(null)


  useEffect(() => {
    let ignore = false
    const loadCategories = async () => {
      try {
        const res = await fetch('/api/proxy/admin/booking/categories?all=1', { cache: 'no-store' })
        if (!res.ok) {
          if (!ignore) setCategoryOptions([])
          return
        }
        const json = await res.json().catch(() => null)
        const payload = json?.data ?? json
        const rows = Array.isArray(payload) ? payload : Array.isArray(payload?.data) ? payload.data : []
        const mapped = rows
          .map((row: { id?: unknown; name?: unknown; cn_name?: unknown; is_active?: unknown; sort_order?: unknown }) => ({
            id: Number(row?.id),
            name: String(row?.name ?? '').trim(),
            cn_name: typeof row?.cn_name === 'string' ? row.cn_name : null,
            is_active: row?.is_active !== false && row?.is_active !== 0 && row?.is_active !== '0',
            sort_order: row?.sort_order != null ? Number(row.sort_order) : undefined,
          }))
          .filter((row: BookingServiceCategoryOption) => row.id > 0 && row.name)
        if (!ignore) setCategoryOptions(mapped)
      } catch {
        if (!ignore) setCategoryOptions([])
      }
    }
    void loadCategories()
    return () => { ignore = true }
  }, [])

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

        // Fetch all pages to ensure linked booking services are complete.
        // This is still lightweight: we only keep id + name + duration + price.
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
            collected.set(id, {
              id,
              name,
              cn_name: typeof maybe.cn_name === 'string' ? maybe.cn_name : null,
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
  }, [])

  useLayoutEffect(() => {
    if (copySourceId == null) {
      setCopySourceReady(true)
    } else {
      setCopySourceReady(false)
    }
  }, [copySourceId])

  useEffect(() => {
    if (copySourceId == null) {
      setCopySourceReady(true)
      setForm({ ...initialFormState })
      setImagePreview(null)
      setProductLink(buildInitialProductLinkValue())
      setError(null)
      return
    }

    let cancelled = false
    const controller = new AbortController()

    const loadCopySource = async () => {
      setError(null)
      setForm({ ...initialFormState })
      setImagePreview(null)
      try {
        const res = await fetch(`/api/proxy/admin/booking/services/${copySourceId}`, {
          cache: 'no-store',
          signal: controller.signal,
          headers: { Accept: 'application/json' },
        })
        const data = await res.json().catch(() => null)
        if (cancelled) return
        if (data && typeof data === 'object') {
          if (data?.success === false && data?.message === 'Unauthorized') {
            window.location.replace('/dashboard')
            return
          }
        }
        if (!res.ok) {
          const message =
            data && typeof data === 'object' && typeof (data as { message?: unknown }).message === 'string'
              ? (data as { message: string }).message
              : 'Failed to load service to copy'
          setError(message)
          return
        }
        const service = (data as { data?: BookingServiceApiItemWithRelations } | null)?.data
        if (!service || typeof service !== 'object') {
          setError('Failed to load service to copy')
          return
        }
        setForm(mapBookingServiceApiToCreateFormState(service))
        setProductLink(buildInitialProductLinkValue())
        const mapped = mapBookingServiceApiItemToRow(service)
        setImagePreview(mapped.imageUrl || null)
      } catch (err) {
        if (cancelled) return
        if (!(err instanceof DOMException && err.name === 'AbortError')) {
          setError('Failed to load service to copy')
        }
      } finally {
        if (!cancelled) {
          setCopySourceReady(true)
        }
      }
    }

    void loadCopySource()
    return () => {
      cancelled = true
      controller.abort()
    }
  }, [copySourceId])

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
    if (name === 'allow_photo_upload') {
      setForm((prev) => ({ ...prev, allow_photo_upload: value === 'true' }))
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
    if (copySourceId != null && !copySourceReady) return

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
      fd.append('cn_name', form.cn_name.trim())
      fd.append('description', form.description.trim())
      fd.append('service_type', form.service_type)
      form.categoryIds.forEach((categoryId) => fd.append('category_ids[]', String(categoryId)))
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
      fd.append('allow_photo_upload', form.allow_photo_upload ? '1' : '0')
      form.allowed_staff_ids.forEach((staffId) => fd.append('allowed_staff_ids[]', String(staffId)))
      form.primary_slots.split(',').map((time) => time.trim()).filter(Boolean).forEach((time) => fd.append('primary_slots[]', time))
      form.questions.forEach((question, questionIndex) => {
        fd.append(`questions[${questionIndex}][title]`, question.title.trim())
        fd.append(`questions[${questionIndex}][cn_title]`, question.cn_title.trim())
        fd.append(`questions[${questionIndex}][description]`, question.description.trim())
        fd.append(`questions[${questionIndex}][cn_description]`, question.cn_description.trim())
        fd.append(`questions[${questionIndex}][question_type]`, question.question_type)
        fd.append(`questions[${questionIndex}][sort_order]`, String(questionIndex))
        fd.append(`questions[${questionIndex}][is_required]`, question.is_required ? '1' : '0')
        fd.append(`questions[${questionIndex}][is_active]`, question.is_active ? '1' : '0')
        question.options.forEach((option, optionIndex) => {
          fd.append(`questions[${questionIndex}][options][${optionIndex}][label]`, option.label.trim())
          fd.append(`questions[${questionIndex}][options][${optionIndex}][cn_label]`, option.cn_label.trim())
          fd.append(`questions[${questionIndex}][options][${optionIndex}][linked_booking_service_id]`, option.linked_booking_service_id.trim())
          fd.append(`questions[${questionIndex}][options][${optionIndex}][sort_order]`, String(optionIndex))
          fd.append(`questions[${questionIndex}][options][${optionIndex}][is_active]`, option.is_active ? '1' : '0')
          fd.append(`questions[${questionIndex}][options][${optionIndex}][allow_quantity]`, option.allow_quantity ? '1' : '0')
        })
      })
      if (form.imageFile) {
        const compressed = await compressImage(form.imageFile)
        fd.append('image', compressed)
      }
      appendProductLinkFormData(fd, productLink, false)

      const res = await fetch('/api/proxy/admin/booking/services', {
        method: 'POST',
        headers: { Accept: 'application/json' },
        body: fd,
      })

      const data = await res.json().catch(() => null)
      if (!res.ok) {
        setError(extractBookingServiceApiErrorMessage(data, 'Failed to create booking service'))
        return
      }

      const created = mapBookingServiceApiItemToRow((data?.data ?? {}) as BookingServiceApiItem)
      setForm({ ...initialFormState })
      setImagePreview(null)
      setProductLink(buildInitialProductLinkValue())
      onSuccess(created)
    } catch (err) {
      console.error(err)
      setError('Failed to create booking service')
    } finally {
      setSubmitting(false)
    }
  }

  const isWaitingForCopySource = copySourceId != null && !copySourceReady
  const disableForm = submitting || isWaitingForCopySource

  return (
    <CrmFormModalShell
      title={
        <div className="min-w-0 pr-2">
          <span>Create Booking Service</span>
          {copySourceId != null ? (
            <p className="mt-1 max-w-xl text-xs font-normal text-gray-500">
              {isWaitingForCopySource
                ? 'Retrieving the selected service — please wait.'
                : 'Prefilled from the selected service (name ends with (Copy)). Upload a cover file if you want that image on the new record — preview is for reference only.'}
            </p>
          ) : null}
        </div>
      }
      size="lg"
      onClose={onClose}
      closeDisabled={submitting}
      closeLabel={t('common.close')}
      footer={
        <>
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
            form={bookingServiceCreateFormId}
            className="px-4 py-2 text-sm text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50"
            disabled={disableForm}
          >
            {submitting ? t('common.creating') : t('common.create')}
          </button>
        </>
      }
    >
      <div className={`relative ${isWaitingForCopySource ? 'min-h-[min(22rem,78vh)]' : ''}`}>
        {isWaitingForCopySource ? (
          <div
            className="absolute inset-0 z-[100] flex flex-col items-center justify-center gap-4 bg-white px-6 text-center"
            role="status"
            aria-live="polite"
            aria-busy="true"
          >
            <span
              className="h-12 w-12 shrink-0 animate-spin rounded-full border-[3px] border-gray-200 border-t-blue-600"
              aria-hidden
            />
            <div className="max-w-md">
              <p className="text-lg font-semibold text-gray-900">Retrieving service…</p>
              <p className="mt-2 text-sm text-gray-600">
                Loading the booking service from the server. Fields will appear when data is ready.
              </p>
            </div>
          </div>
        ) : null}

        <form
          id={bookingServiceCreateFormId}
          onSubmit={handleSubmit}
          className="relative z-[1] p-5"
          aria-busy={isWaitingForCopySource}
        >
          <FormErrorAnchor error={error} />

          <div className="mb-6">
            <BookingServiceProductLinkPanel
              mode="create"
              value={productLink}
              onChange={setProductLink}
              disabled={disableForm}
            />
          </div>

          <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
            {/* Left Side - Image Upload */}
            <div className="space-y-4 w-full lg:w-1/2">
              <div>
                <h3 className="text-sm font-medium text-gray-700 mb-1">Image</h3>
                <p className="text-xs text-gray-500 mb-2">{BOOKING_SERVICE_COVER_IMAGE_SUGGESTED_SIZE_LINE}</p>
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
                <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1">
                  English Name <span className="text-red-500">*</span>
                </label>
                <input
                  id="name"
                  name="name"
                  type="text"
                  value={form.name}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-blue-500 focus:border-blue-500"
                  placeholder="English service name"
                  disabled={disableForm}
                />
              </div>

              <div>
                <label htmlFor="cn_name" className="block text-sm font-medium text-gray-700 mb-1">
                  Chinese Name
                </label>
                <input
                  id="cn_name"
                  name="cn_name"
                  type="text"
                  value={form.cn_name}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-blue-500 focus:border-blue-500"
                  placeholder="中文服务名称"
                  disabled={disableForm}
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

            <div className="md:col-span-2">
              <BookingServiceCategoriesPicker
                categories={categoryOptions}
                value={form.categoryIds}
                onChange={(categoryIds) => setForm((prev) => ({ ...prev, categoryIds }))}
                disabled={disableForm}
                label="Categories"
              />
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
                disabled={disableForm}
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
                disabled={disableForm}
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
                  disabled={disableForm}
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
                    disabled={disableForm}
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
                    disabled={disableForm}
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
                disabled={disableForm}
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
                disabled={disableForm}
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
                disabled={disableForm}
              >
                <option value="true">Active</option>
                <option value="false">Inactive</option>
              </select>
            </div>
            <div>
              <label htmlFor="create-allowPhotoUpload" className="block text-sm font-medium text-gray-700 mb-1">
                Allow Photo Upload (Max 3 photos)
              </label>
              <select
                id="create-allowPhotoUpload"
                name="allow_photo_upload"
                value={form.allow_photo_upload ? 'true' : 'false'}
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
        </form>
      </div>
    </CrmFormModalShell>
  )
}
