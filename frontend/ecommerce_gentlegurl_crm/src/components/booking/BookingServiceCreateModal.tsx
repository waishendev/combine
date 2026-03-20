/**
 * Booking service creation requires multipart when uploading image.
 * Backend also requires `service_type` to be present.
 */
'use client'

import { ChangeEvent, FormEvent, useRef, useState } from 'react'

import type { BookingServiceRowData } from './BookingServiceRow'
import { mapBookingServiceApiItemToRow, type BookingServiceApiItem } from './bookingServiceUtils'
import { useI18n } from '@/lib/i18n'
import { IMAGE_ACCEPT } from '../mediaAccept'

type ServiceType = 'premium' | 'standard'

interface BookingServiceCreateModalProps {
  onClose: () => void
  onSuccess: (service: BookingServiceRowData) => void
}

interface FormState {
  name: string
  description: string
  service_type: ServiceType
  duration_min: string
  service_price: string
  deposit_amount: string
  buffer_min: string
  is_active: boolean
  imageFile: File | null
}

const initialFormState: FormState = {
  name: '',
  description: '',
  service_type: 'standard',
  duration_min: '30',
  service_price: '0',
  deposit_amount: '0',
  buffer_min: '15',
  is_active: true,
  imageFile: null,
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
  const imageInputRef = useRef<HTMLInputElement>(null)

  const handleChange = (
    event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>,
  ) => {
    const { name, value, type } = event.target
    if (type === 'checkbox') {
      const checked = (event.target as HTMLInputElement).checked
      setForm((prev) => ({ ...prev, [name]: checked }))
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

    setSubmitting(true)
    setError(null)

    try {
      const fd = new FormData()
      fd.append('name', trimmedName)
      fd.append('description', form.description.trim())
      fd.append('service_type', form.service_type)
      fd.append('duration_min', String(duration))
      fd.append('service_price', String(servicePrice))
      fd.append('deposit_amount', String(deposit))
      fd.append('buffer_min', String(buffer))
      fd.append('is_active', form.is_active ? '1' : '0')
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
      <div className="relative w-full max-w-4xl mx-auto bg-white rounded-lg shadow-lg max-h-[90vh] overflow-y-auto">
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
                  disabled={submitting}
                >
                  {submitting ? t('common.creating') : t('common.create')}
                </button>
              </div>
            </div>
          </div>
        </form>
      </div>
    </div>
  )
}
