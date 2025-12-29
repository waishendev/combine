'use client'

import { ChangeEvent, FormEvent, useRef, useState } from 'react'

import type { StoreRowData } from './StoreRow'
import { mapStoreApiItemToRow, type StoreApiItem } from './storeUtils'
import { useI18n } from '@/lib/i18n'

interface StoreCreateModalProps {
  onClose: () => void
  onSuccess: (store: StoreRowData) => void
}

interface FormState {
  name: string
  code: string
  address_line1: string
  address_line2: string
  city: string
  state: string
  postcode: string
  country: string
  phone: string
  imageFile: File | null
}

const initialFormState: FormState = {
  name: '',
  code: '',
  address_line1: '',
  address_line2: '',
  city: '',
  state: '',
  postcode: '',
  country: '',
  phone: '',
  imageFile: null,
}

export default function StoreCreateModal({
  onClose,
  onSuccess,
}: StoreCreateModalProps) {
  const { t } = useI18n()
  const [form, setForm] = useState<FormState>({ ...initialFormState })
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const imageInputRef = useRef<HTMLInputElement | null>(null)

  const handleChange = (
    event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
  ) => {
    const { name, value } = event.target
    setForm((prev) => ({ ...prev, [name]: value }))
  }

  const handleImageChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] || null
    setForm((prev) => ({ ...prev, imageFile: file }))

    if (file) {
      const reader = new FileReader()
      reader.onloadend = () => {
        setImagePreview(reader.result as string)
      }
      reader.readAsDataURL(file)
    } else {
      setImagePreview(null)
    }
  }

  const handleImageClick = () => {
    if (!submitting) {
      imageInputRef.current?.click()
    }
  }

  const handleImageRemove = () => {
    if (submitting) return
    setForm((prev) => ({ ...prev, imageFile: null }))
    setImagePreview(null)
    if (imageInputRef.current) {
      imageInputRef.current.value = ''
    }
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    const trimmedName = form.name.trim()
    const trimmedCode = form.code.trim()
    const trimmedAddressLine1 = form.address_line1.trim()
    const trimmedCity = form.city.trim()
    const trimmedState = form.state.trim()
    const trimmedPostcode = form.postcode.trim()
    const trimmedCountry = form.country.trim()
    const trimmedPhone = form.phone.trim()

    if (
      !trimmedName ||
      !trimmedCode ||
      !trimmedAddressLine1 ||
      !trimmedCity ||
      !trimmedState ||
      !trimmedPostcode ||
      !trimmedCountry ||
      !trimmedPhone
    ) {
      setError(t('common.allFieldsRequired'))
      return
    }

    setSubmitting(true)
    setError(null)

    try {
      const formData = new FormData()
      formData.append('name', trimmedName)
      formData.append('code', trimmedCode)
      formData.append('address_line1', trimmedAddressLine1)
      formData.append('address_line2', form.address_line2.trim())
      formData.append('city', trimmedCity)
      formData.append('state', trimmedState)
      formData.append('postcode', trimmedPostcode)
      formData.append('country', trimmedCountry)
      formData.append('phone', trimmedPhone)
      formData.append('is_active', '1')
      if (form.imageFile) {
        formData.append('image_file', form.imageFile)
      }

      const res = await fetch('/api/proxy/ecommerce/store-locations', {
        method: 'POST',
        body: formData,
      })

      const data = await res.json().catch(() => null)

      if (!res.ok) {
        let message = 'Failed to create store'
        if (data && typeof data === 'object') {
          if (typeof (data as { message?: unknown }).message === 'string') {
            message = (data as { message: string }).message
          } else if (data && 'errors' in data) {
            const errors = (data as { errors?: unknown }).errors
            if (errors && typeof errors === 'object') {
              const firstKey = Object.keys(errors)[0]
              const firstValue = firstKey
                ? (errors as Record<string, unknown>)[firstKey]
                : null
              if (Array.isArray(firstValue) && typeof firstValue[0] === 'string') {
                message = firstValue[0]
              } else if (typeof firstValue === 'string') {
                message = firstValue
              }
            }
          }
        }
        setError(message)
        return
      }

      const payload =
        data && typeof data === 'object' && 'data' in data
          ? ((data as { data?: StoreApiItem | null }).data ?? null)
          : null

      const storeRow: StoreRowData = payload
        ? mapStoreApiItemToRow(payload)
        : {
            id: 0,
            name: trimmedName,
            code: trimmedCode,
            imageUrl: null,
            address_line1: trimmedAddressLine1,
            address_line2: form.address_line2.trim(),
            city: trimmedCity,
            state: trimmedState,
            postcode: trimmedPostcode,
            country: trimmedCountry,
            phone: trimmedPhone,
            isActive: true,
          }

      setForm({ ...initialFormState })
      setImagePreview(null)
      onSuccess(storeRow)
    } catch (err) {
      console.error(err)
      setError('Failed to create store')
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
          <h2 className="text-lg font-semibold">Create Store</h2>
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

        <form onSubmit={handleSubmit} className="px-5 py-4 space-y-4">
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-[280px_minmax(0,1fr)]">
            <div className="space-y-2">
              <h3 className="text-sm font-medium text-gray-700">Photo</h3>
              <div
                onClick={handleImageClick}
                className={`relative border-2 border-dashed rounded-lg p-4 cursor-pointer transition-colors ${
                  imagePreview
                    ? 'border-gray-300'
                    : 'border-gray-300 hover:border-blue-400'
                }`}
              >
                <input
                  ref={imageInputRef}
                  id="imageFile"
                  name="imageFile"
                  type="file"
                  accept="image/*"
                  onChange={handleImageChange}
                  className="hidden"
                  disabled={submitting}
                />
                {imagePreview ? (
                  <div className="relative group">
                    <img
                      src={imagePreview}
                      alt="Preview"
                      className="w-full h-56 object-cover rounded"
                    />
                    <div className="absolute top-2 right-2 flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                      <button
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation()
                          handleImageClick()
                        }}
                        className="w-8 h-8 bg-blue-500/95 text-white rounded-full flex items-center justify-center shadow-lg hover:bg-blue-600"
                        aria-label="Replace image"
                      >
                        <i className="fa-solid fa-pen" />
                      </button>
                      <button
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation()
                          handleImageRemove()
                        }}
                        className="w-8 h-8 bg-red-500/95 text-white rounded-full flex items-center justify-center shadow-lg hover:bg-red-600"
                        aria-label="Remove image"
                      >
                        <i className="fa-solid fa-trash" />
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-12 text-gray-400">
                    <i className="fa-regular fa-image text-3xl mb-2" />
                    <p className="text-sm">Click to upload</p>
                  </div>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label
                  htmlFor="name"
                  className="block text-sm font-medium text-gray-700 mb-1"
                >
                  Name <span className="text-red-500">*</span>
                </label>
                <input
                  id="name"
                  name="name"
                  type="text"
                  value={form.name}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Store Name"
                  disabled={submitting}
                />
              </div>

              <div>
                <label
                  htmlFor="code"
                  className="block text-sm font-medium text-gray-700 mb-1"
                >
                  Code <span className="text-red-500">*</span>
                </label>
                <input
                  id="code"
                  name="code"
                  type="text"
                  value={form.code}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Store Code"
                  disabled={submitting}
                />
              </div>

              <div className="md:col-span-2">
                <label
                  htmlFor="address_line1"
                  className="block text-sm font-medium text-gray-700 mb-1"
                >
                  Address Line 1 <span className="text-red-500">*</span>
                </label>
                <input
                  id="address_line1"
                  name="address_line1"
                  type="text"
                  value={form.address_line1}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Address Line 1"
                  disabled={submitting}
                />
              </div>
              <div className="md:col-span-2">
                <label
                  htmlFor="address_line2"
                  className="block text-sm font-medium text-gray-700 mb-1"
                >
                  Address Line 2
                </label>
                <input
                  id="address_line2"
                  name="address_line2"
                  type="text"
                  value={form.address_line2}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Address Line 2 (Optional)"
                  disabled={submitting}
                />
              </div>

              <div>
                <label
                  htmlFor="city"
                  className="block text-sm font-medium text-gray-700 mb-1"
                >
                  City <span className="text-red-500">*</span>
                </label>
                <input
                  id="city"
                  name="city"
                  type="text"
                  value={form.city}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-blue-500 focus:border-blue-500"
                  placeholder="City"
                  disabled={submitting}
                />
              </div>

              <div>
                <label
                  htmlFor="state"
                  className="block text-sm font-medium text-gray-700 mb-1"
                >
                  State <span className="text-red-500">*</span>
                </label>
                <input
                  id="state"
                  name="state"
                  type="text"
                  value={form.state}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-blue-500 focus:border-blue-500"
                  placeholder="State"
                  disabled={submitting}
                />
              </div>

              <div>
                <label
                  htmlFor="postcode"
                  className="block text-sm font-medium text-gray-700 mb-1"
                >
                  Postcode <span className="text-red-500">*</span>
                </label>
                <input
                  id="postcode"
                  name="postcode"
                  type="text"
                  value={form.postcode}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Postcode"
                  disabled={submitting}
                />
              </div>

              <div>
                <label
                  htmlFor="country"
                  className="block text-sm font-medium text-gray-700 mb-1"
                >
                  Country <span className="text-red-500">*</span>
                </label>
                <input
                  id="country"
                  name="country"
                  type="text"
                  value={form.country}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Country"
                  disabled={submitting}
                />
              </div>

              <div className="md:col-span-2">
                <label
                  htmlFor="phone"
                  className="block text-sm font-medium text-gray-700 mb-1"
                >
                  Phone <span className="text-red-500">*</span>
                </label>
                <input
                  id="phone"
                  name="phone"
                  type="text"
                  value={form.phone}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Phone Number"
                  disabled={submitting}
                />
              </div>
            </div>
          </div>

          {error && (
            <div className="text-sm text-red-600" role="alert">
              {error}
            </div>
          )}

          <div className="flex items-center justify-end gap-3 pt-2 sticky bottom-0 bg-white pb-4">
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
