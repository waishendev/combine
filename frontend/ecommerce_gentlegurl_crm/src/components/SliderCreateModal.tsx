'use client'

import { ChangeEvent, FormEvent, useRef, useState } from 'react'

import type { SliderRowData } from './SliderRow'
import { mapSliderApiItemToRow, type SliderApiItem } from './sliderUtils'
import { useI18n } from '@/lib/i18n'

interface SliderCreateModalProps {
  onClose: () => void
  onSuccess: (slider: SliderRowData) => void
}

interface FormState {
  title: string
  subtitle: string
  button_label: string
  button_link: string
  start_at: string
  end_at: string
}

const initialFormState: FormState = {
  title: '',
  subtitle: '',
  button_label: '',
  button_link: '',
  start_at: '',
  end_at: '',
}

export default function SliderCreateModal({
  onClose,
  onSuccess,
}: SliderCreateModalProps) {
  const { t } = useI18n()
  const [form, setForm] = useState<FormState>({ ...initialFormState })
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [mobileImageFile, setMobileImageFile] = useState<File | null>(null)
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const [mobileImagePreview, setMobileImagePreview] = useState<string | null>(null)
  const imageInputRef = useRef<HTMLInputElement>(null)
  const mobileImageInputRef = useRef<HTMLInputElement>(null)

  const handleChange = (
    event: ChangeEvent<HTMLInputElement | HTMLSelectElement>,
  ) => {
    const { name, value } = event.target
    setForm((prev) => ({ ...prev, [name]: value }))
  }

  const handleImageChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (file) {
      setImageFile(file)
      const reader = new FileReader()
      reader.onloadend = () => {
        setImagePreview(reader.result as string)
      }
      reader.readAsDataURL(file)
    }
  }

  const handleMobileImageChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (file) {
      setMobileImageFile(file)
      const reader = new FileReader()
      reader.onloadend = () => {
        setMobileImagePreview(reader.result as string)
      }
      reader.readAsDataURL(file)
    }
  }

  const handleImageClick = () => {
    imageInputRef.current?.click()
  }

  const handleMobileImageClick = () => {
    mobileImageInputRef.current?.click()
  }

  const handleRemoveImage = () => {
    setImageFile(null)
    setImagePreview(null)
    if (imageInputRef.current) {
      imageInputRef.current.value = ''
    }
  }

  const handleRemoveMobileImage = () => {
    setMobileImageFile(null)
    setMobileImagePreview(null)
    if (mobileImageInputRef.current) {
      mobileImageInputRef.current.value = ''
    }
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    const trimmedTitle = form.title.trim()
    const trimmedSubtitle = form.subtitle.trim()
    const trimmedButtonLabel = form.button_label.trim()
    const trimmedButtonLink = form.button_link.trim()
    const trimmedStartAt = form.start_at.trim()
    const trimmedEndAt = form.end_at.trim()

    if (!trimmedTitle || !trimmedSubtitle || !imageFile || !trimmedStartAt || !trimmedEndAt) {
      setError(t('common.allFieldsRequired'))
      return
    }

    setSubmitting(true)
    setError(null)

    try {
      const formData = new FormData()
      formData.append('title', trimmedTitle)
      formData.append('subtitle', trimmedSubtitle)
      formData.append('image_file', imageFile)
      if (mobileImageFile) {
        formData.append('mobile_image_file', mobileImageFile)
      }
      if (trimmedButtonLabel) {
        formData.append('button_label', trimmedButtonLabel)
      }
      if (trimmedButtonLink) {
        formData.append('button_link', trimmedButtonLink)
      }
      formData.append('start_at', trimmedStartAt)
      formData.append('end_at', trimmedEndAt)
      formData.append('is_active', '1')

      const res = await fetch('/api/proxy/ecommerce/home-sliders', {
        method: 'POST',
        headers: {
          Accept: 'application/json',
        },
        body: formData,
      })

      const data = await res.json().catch(() => null)

      if (!res.ok) {
        let message = 'Failed to create slider'
        if (data && typeof data === 'object') {
          if (typeof (data as { message?: unknown }).message === 'string') {
            message = (data as { message: string }).message
          } else if (data && 'errors' in data) {
            const errors = (data as { errors?: unknown }).errors
            if (errors && typeof errors === 'object') {
              const firstKey = Object.keys(errors)[0]
              const firstValue = firstKey ? (errors as Record<string, unknown>)[firstKey] : null
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
          ? ((data as { data?: SliderApiItem | null }).data ?? null)
          : null

      const sliderRow: SliderRowData = payload
        ? mapSliderApiItemToRow(payload)
        : {
            id: 0,
            title: trimmedTitle,
            subtitle: trimmedSubtitle,
            image_path: imagePreview || '',
            mobile_image_path: mobileImagePreview || '',
            button_label: trimmedButtonLabel,
            button_link: trimmedButtonLink,
            start_at: trimmedStartAt,
            end_at: trimmedEndAt,
            isActive: true,
            sort_order: null,
            createdAt: '',
            updatedAt: '',
          }

      setForm({ ...initialFormState })
      setImageFile(null)
      setMobileImageFile(null)
      setImagePreview(null)
      setMobileImagePreview(null)
      onSuccess(sliderRow)
    } catch (err) {
      console.error(err)
      setError('Failed to create slider')
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
        <div className="flex items-center justify-between border-b border-gray-300 px-5 py-4">
          <h2 className="text-lg font-semibold">Create Slider</h2>
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
          <div className="grid grid-cols-2 gap-6">
            {/* Left Side - Image Upload */}
            <div className="space-y-4">
              <div>
                <h3 className="text-sm font-medium text-gray-700 mb-2">Desktop Image *</h3>
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
                    type="file"
                    accept="image/*"
                    onChange={handleImageChange}
                    className="hidden"
                    disabled={submitting}
                  />
                  {imagePreview ? (
                    <div className="relative">
                      <img
                        src={imagePreview}
                        alt="Preview"
                        className="w-full h-48 object-contain rounded"
                      />
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation()
                          handleRemoveImage()
                        }}
                        className="absolute top-2 right-2 bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center hover:bg-red-600"
                        disabled={submitting}
                      >
                        <i className="fa-solid fa-xmark text-xs" />
                      </button>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center py-8">
                      <i className="fa-solid fa-cloud-arrow-up text-4xl text-gray-400 mb-2" />
                      <p className="text-sm text-gray-600">Click to upload</p>
                    </div>
                  )}
                </div>
              </div>

              <div>
                <h3 className="text-sm font-medium text-gray-700 mb-2">Mobile Image</h3>
                <div
                  onClick={handleMobileImageClick}
                  className={`relative border-2 border-dashed rounded-lg p-4 cursor-pointer transition-colors ${
                    mobileImagePreview
                      ? 'border-gray-300'
                      : 'border-gray-300 hover:border-blue-400'
                  }`}
                >
                  <input
                    ref={mobileImageInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleMobileImageChange}
                    className="hidden"
                    disabled={submitting}
                  />
                  {mobileImagePreview ? (
                    <div className="relative">
                      <img
                        src={mobileImagePreview}
                        alt="Mobile Preview"
                        className="w-full h-48 object-contain rounded"
                      />
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation()
                          handleRemoveMobileImage()
                        }}
                        className="absolute top-2 right-2 bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center hover:bg-red-600"
                        disabled={submitting}
                      >
                        <i className="fa-solid fa-xmark text-xs" />
                      </button>
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
            <div className="space-y-4">
          <div>
            <label
              htmlFor="title"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              Title <span className="text-red-500">*</span>
            </label>
            <input
              id="title"
              name="title"
              type="text"
              value={form.title}
              onChange={handleChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-blue-500 focus:border-blue-500"
              placeholder="Enter title"
              disabled={submitting}
            />
          </div>

          <div>
            <label
              htmlFor="subtitle"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              Subtitle <span className="text-red-500">*</span>
            </label>
            <input
              id="subtitle"
              name="subtitle"
              type="text"
              value={form.subtitle}
              onChange={handleChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-blue-500 focus:border-blue-500"
              placeholder="Enter subtitle"
              disabled={submitting}
            />
          </div>

          <div>
            <label
              htmlFor="button_label"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              Button Label
            </label>
            <input
              id="button_label"
              name="button_label"
              type="text"
              value={form.button_label}
              onChange={handleChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-blue-500 focus:border-blue-500"
              placeholder="Shop Now"
              disabled={submitting}
            />
          </div>

          <div>
            <label
              htmlFor="button_link"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              Button Link
            </label>
            <input
              id="button_link"
              name="button_link"
              type="text"
              value={form.button_link}
              onChange={handleChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-blue-500 focus:border-blue-500"
              placeholder="/shop"
              disabled={submitting}
            />
          </div>

          <div>
            <label
              htmlFor="start_at"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              Start Date <span className="text-red-500">*</span>
            </label>
            <input
              id="start_at"
              name="start_at"
              type="date"
              value={form.start_at}
              onChange={handleChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-blue-500 focus:border-blue-500"
              disabled={submitting}
            />
          </div>

          <div>
            <label
              htmlFor="end_at"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              End Date <span className="text-red-500">*</span>
            </label>
            <input
              id="end_at"
              name="end_at"
              type="date"
              value={form.end_at}
              onChange={handleChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-blue-500 focus:border-blue-500"
              disabled={submitting}
            />
          </div>
            </div>
          </div>

          {error && (
            <div className="text-sm text-red-600 mt-4" role="alert">
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
        </form>
      </div>
    </div>
  )
}

