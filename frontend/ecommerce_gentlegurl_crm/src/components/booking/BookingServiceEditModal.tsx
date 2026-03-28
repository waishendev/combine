'use client'

import { ChangeEvent, FormEvent, useEffect, useRef, useState } from 'react'

import type { BookingServiceRowData } from './BookingServiceRow'
import { mapBookingServiceApiItemToRow, type BookingServiceApiItem } from './bookingServiceUtils'
import { useI18n } from '@/lib/i18n'
import { IMAGE_ACCEPT } from '../mediaAccept'

type StaffOption = { id: number; name: string }

interface BookingServiceEditModalProps {
  serviceId: number
  onClose: () => void
  onSuccess: (service: BookingServiceRowData) => void
}

type ServiceType = 'premium' | 'standard'
type BookingServiceApiItemWithType = BookingServiceApiItem & {
  service_type?: ServiceType | string | null
}

interface FormState {
  name: string
  description: string
  service_type: ServiceType
  duration_min: string
  service_price: string
  deposit_amount: string
  buffer_min: string
  is_active: 'true' | 'false'
  imageFile: File | null
  allowed_staff_ids: number[]
}

const initialFormState: FormState = {
  name: '',
  description: '',
  service_type: 'standard',
  duration_min: '30',
  service_price: '0',
  deposit_amount: '0',
  buffer_min: '15',
  is_active: 'true',
  imageFile: null,
  allowed_staff_ids: [],
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
  const [staffOptions, setStaffOptions] = useState<StaffOption[]>([])
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
          service_price: String(service.service_price ?? 0),
          deposit_amount: String(service.deposit_amount ?? 0),
          buffer_min: String(service.buffer_min ?? 15),
          is_active:
            service.is_active === true || service.is_active === 'true' || service.is_active === 1
              ? 'true'
              : 'false',
          imageFile: null,
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
      try {
        const res = await fetch('/api/proxy/staffs?per_page=200&is_active=true', { cache: 'no-store' })
        if (!res.ok) return
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
          .map((row): StaffOption | null => {
            if (!row || typeof row !== 'object') return null
            const maybe = row as Record<string, unknown>
            const id = Number(maybe.id)
            const name = String(maybe.name ?? '').trim()
            if (!id || !name) return null
            return { id, name }
          })
          .filter((row): row is StaffOption => Boolean(row))

        if (!ignore) setStaffOptions(mapped)
      } catch {
        if (!ignore) setStaffOptions([])
      }
    }

    void loadStaffs()
    return () => { ignore = true }
  }, [])

  const handleChange = (
    event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>,
  ) => {
    const { name, value, type } = event.target
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


  const toggleAllowedStaff = (staffId: number) => {
    setForm((prev) => {
      const exists = prev.allowed_staff_ids.includes(staffId)
      return {
        ...prev,
        allowed_staff_ids: exists
          ? prev.allowed_staff_ids.filter((id) => id !== staffId)
          : [...prev.allowed_staff_ids, staffId],
      }
    })
  }

  const selectAllStaffs = () => {
    setForm((prev) => ({ ...prev, allowed_staff_ids: staffOptions.map((staff) => staff.id) }))
  }

  const clearAllStaffs = () => {
    setForm((prev) => ({ ...prev, allowed_staff_ids: [] }))
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
    const deposit = Number(form.deposit_amount)
    const buffer = Number(form.buffer_min)

    if (!Number.isFinite(duration) || duration <= 0) {
      setError('Duration must be greater than 0')
      return
    }
    if (!Number.isFinite(servicePrice) || servicePrice < 0) {
      setError('Service price must be 0 or greater')
      return
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

    setSubmitting(true)
    setError(null)

    try {
      const fd = new FormData()
      fd.append('_method', 'PUT')
      fd.append('name', trimmedName)
      fd.append('description', form.description.trim())
      fd.append('service_type', form.service_type)
      fd.append('duration_min', String(duration))
      fd.append('service_price', String(servicePrice))
      fd.append('deposit_amount', String(deposit))
      fd.append('buffer_min', String(buffer))
      fd.append('is_active', form.is_active === 'true' ? '1' : '0')
      form.allowed_staff_ids.forEach((staffId) => fd.append('allowed_staff_ids[]', String(staffId)))
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
      <div className="relative w-full max-w-4xl mx-auto bg-white rounded-lg shadow-lg max-h-[90vh] overflow-y-auto">
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
            <div className="flex flex-col gap-6 lg:flex-row">
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
                    htmlFor="edit-service_type"
                    className="block text-sm font-medium text-gray-700 mb-1"
                  >
                    Service Type <span className="text-red-500">*</span>
                  </label>
                  <select
                    id="edit-service_type"
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

                <div>
                  <label
                    htmlFor="edit-isActive"
                    className="block text-sm font-medium text-gray-700 mb-1"
                  >
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
                  <div className="mb-1 flex items-center justify-between">
                    <label className="block text-sm font-medium text-gray-700">Allowed Staff <span className="text-red-500">*</span></label>
                    <span className="text-xs text-gray-500">{form.allowed_staff_ids.length} staff selected</span>
                  </div>
                  <div className="mb-2 flex items-center gap-2">
                    <button type="button" className="rounded border border-blue-200 px-2 py-1 text-xs text-blue-700" onClick={selectAllStaffs} disabled={disableForm || staffOptions.length === 0}>Select All Staff</button>
                    <button type="button" className="rounded border border-gray-200 px-2 py-1 text-xs text-gray-700" onClick={clearAllStaffs} disabled={disableForm || form.allowed_staff_ids.length === 0}>Clear All</button>
                  </div>
                  <div className="max-h-32 space-y-1 overflow-y-auto rounded-md border border-gray-200 p-2">
                    {staffOptions.length === 0 ? <p className="text-xs text-gray-500">No active staff found.</p> : staffOptions.map((staff) => (
                      <label key={staff.id} className="flex items-center gap-2 text-sm text-gray-700">
                        <input type="checkbox" checked={form.allowed_staff_ids.includes(staff.id)} onChange={() => toggleAllowedStaff(staff.id)} disabled={disableForm} />
                        <span>{staff.name}</span>
                      </label>
                    ))}
                  </div>
                </div>

                {error && (
                  <div className="text-sm text-red-600" role="alert">
                    {error}
                  </div>
                )}

                <div className="flex items-center justify-end gap-3 pt-4 mt-4 border-t border-gray-200">
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
              </div>
            </div>
          )}
        </form>
      </div>
    </div>
  )
}
