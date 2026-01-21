'use client'

import { ChangeEvent, FormEvent, useRef, useState } from 'react'

import type { AnnouncementRowData } from './AnnouncementRow'
import { mapAnnouncementApiItemToRow, type AnnouncementApiItem } from './announcementUtils'
import { useI18n } from '@/lib/i18n'
import { IMAGE_ACCEPT } from './mediaAccept'

interface AnnouncementCreateModalProps {
  onClose: () => void
  onSuccess: (announcement: AnnouncementRowData) => void
}

interface FormState {
  title: string
  subtitle: string
  bodyText: string
  buttonLabel: string
  buttonLink: string
  startAt: string
  endAt: string
  imageFile: File | null
}

const initialFormState: FormState = {
  title: '',
  subtitle: '',
  bodyText: '',
  buttonLabel: '',
  buttonLink: '',
  startAt: '',
  endAt: '',
  imageFile: null,
}

export default function AnnouncementCreateModal({
  onClose,
  onSuccess,
}: AnnouncementCreateModalProps) {
  const { t } = useI18n()
  const [form, setForm] = useState<FormState>({ ...initialFormState })
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const imageInputRef = useRef<HTMLInputElement | null>(null)

  const handleChange = (
    event: ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>,
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

  const handleRemoveImage = () => {
    if (submitting) return
    setForm((prev) => ({ ...prev, imageFile: null }))
    setImagePreview(null)
    if (imageInputRef.current) {
      imageInputRef.current.value = ''
    }
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    if (!form.title.trim()) {
      setError(t('common.allFieldsRequired'))
      return
    }

    setSubmitting(true)
    setError(null)

    try {
      const formData = new FormData()
      formData.append('title', form.title.trim())
      formData.append('subtitle', form.subtitle.trim())
      formData.append('body_text', form.bodyText.trim())
      formData.append('button_label', form.buttonLabel.trim())
      formData.append('button_link', form.buttonLink.trim())
      formData.append('start_at', form.startAt)
      formData.append('end_at', form.endAt)
      formData.append('is_active', '1') // Always pass 1 for create
      
      if (form.imageFile) {
        formData.append('image_file', form.imageFile)
      }

      const res = await fetch('/api/proxy/ecommerce/announcements', {
        method: 'POST',
        body: formData,
      })

      const data = await res.json().catch(() => null)

      if (!res.ok) {
        let message = 'Failed to create announcement'
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
          ? ((data as { data?: AnnouncementApiItem | null }).data ?? null)
          : null

      const announcementRow: AnnouncementRowData = payload
        ? mapAnnouncementApiItemToRow(payload)
        : {
            id: 0,
            key: '',
            title: form.title.trim(),
            subtitle: form.subtitle.trim(),
            bodyText: form.bodyText.trim(),
            imagePath: '',
            imageUrl: '',
            buttonLabel: form.buttonLabel.trim(),
            buttonLink: form.buttonLink.trim(),
            isActive: true,
            startAt: form.startAt,
            endAt: form.endAt,
            sortOrder: 0,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            formattedStartAt: form.startAt,
            formattedEndAt: form.endAt,
            formattedCreatedAt: new Date().toLocaleDateString(),
            formattedUpdatedAt: new Date().toLocaleDateString(),
          }

      setForm({ ...initialFormState })
      setImagePreview(null)
      onSuccess(announcementRow)
    } catch (err) {
      console.error(err)
      setError('Failed to create announcement')
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
          <h2 className="text-lg font-semibold">Create Announcement</h2>
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
          <div className="flex flex-col gap-6 lg:flex-row mb-4">
            <div className="w-full lg:w-1/2 space-y-1">
              <h3 className="text-sm font-medium text-gray-700">Image <span className="text-red-500">*</span></h3>
              <p className="text-xs text-red-500 mb-2">Suggested size: 1600 x 1200</p>
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
                  accept={IMAGE_ACCEPT}
                  onChange={handleImageChange}
                  className="hidden"
                  disabled={submitting}
                />
                {imagePreview ? (
                  <div className="relative group">
                    <img
                      src={imagePreview}
                      alt="Preview"
                      className="w-full h-64 object-contain rounded"
                    />
                    <div className="absolute top-2 right-2 flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                      <button
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation()
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
                        onClick={(event) => {
                          event.stopPropagation()
                          handleRemoveImage()
                        }}
                        className="w-8 h-8 bg-red-500/95 backdrop-blur-md text-white rounded-full flex items-center justify-center shadow-lg border border-red-400/30 hover:bg-red-600 hover:shadow-xl hover:scale-110 transition-all duration-200"
                        aria-label="Remove image"
                        disabled={submitting}
                      >
                        <i className="fa-solid fa-trash-can text-xs" />
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-16">
                    <i className="fa-solid fa-cloud-arrow-up text-4xl text-gray-400 mb-2" />
                    <p className="text-sm text-gray-600">Click to upload</p>
                  </div>
                )}
              </div>
            </div>

            <div className="w-full lg:w-1/2 space-y-4">
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
                  placeholder="Welcome to Our Store"
                  disabled={submitting}
                  required
                />
              </div>

              <div>
                <label
                  htmlFor="subtitle"
                  className="block text-sm font-medium text-gray-700 mb-1"
                >
                  Subtitle
                </label>
                <input
                  id="subtitle"
                  name="subtitle"
                  type="text"
                  value={form.subtitle}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Special Offer Today"
                  disabled={submitting}
                />
              </div>

              <div>
                <label
                  htmlFor="bodyText"
                  className="block text-sm font-medium text-gray-700 mb-1"
                >
                  Body Text
                </label>
                <textarea
                  id="bodyText"
                  name="bodyText"
                  value={form.bodyText}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Get 20% off on all products!"
                  disabled={submitting}
                  rows={3}
                />
              </div>
            </div>
          </div>

          {/* Button & Dates Section */}
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label
                  htmlFor="buttonLabel"
                  className="block text-sm font-medium text-gray-700"
                >
                  Button Label
                </label>
                <input
                  id="buttonLabel"
                  name="buttonLabel"
                  type="text"
                  value={form.buttonLabel}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Shop Now"
                  disabled={submitting}
                />
              </div>

              <div className="space-y-2">
                <label
                  htmlFor="buttonLink"
                  className="block text-sm font-medium text-gray-700"
                >
                  Button Link
                </label>
                <input
                  id="buttonLink"
                  name="buttonLink"
                  type="text"
                  value={form.buttonLink}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-blue-500 focus:border-blue-500"
                  placeholder="/shop"
                  disabled={submitting}
                />
              </div>

              <div className="space-y-2">
                <label
                  htmlFor="startAt"
                  className="block text-sm font-medium text-gray-700"
                >
                  Start Date
                </label>
                <input
                  id="startAt"
                  name="startAt"
                  type="date"
                  value={form.startAt}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-blue-500 focus:border-blue-500"
                  disabled={submitting}
                />
              </div>

              <div className="space-y-2">
                <label
                  htmlFor="endAt"
                  className="block text-sm font-medium text-gray-700"
                >
                  End Date
                </label>
                <input
                  id="endAt"
                  name="endAt"
                  type="date"
                  value={form.endAt}
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
