'use client'

import { ChangeEvent, FormEvent, useEffect, useRef, useState } from 'react'

import type { AnnouncementRowData } from './AnnouncementRow'
import { mapAnnouncementApiItemToRow, type AnnouncementApiItem } from './announcementUtils'
import { useI18n } from '@/lib/i18n'

interface AnnouncementEditModalProps {
  announcementId: number
  onClose: () => void
  onSuccess: (announcement: AnnouncementRowData) => void
}

interface FormState {
  title: string
  subtitle: string
  bodyText: string
  buttonLabel: string
  buttonLink: string
  isActive: 'active' | 'inactive'
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
  isActive: 'active',
  startAt: '',
  endAt: '',
  imageFile: null,
}

export default function AnnouncementEditModal({
  announcementId,
  onClose,
  onSuccess,
}: AnnouncementEditModalProps) {
  const { t } = useI18n()
  const [form, setForm] = useState<FormState>({ ...initialFormState })
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loadedAnnouncement, setLoadedAnnouncement] = useState<AnnouncementRowData | null>(null)
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const [existingImageUrl, setExistingImageUrl] = useState<string | null>(null)
  const [imageRemoved, setImageRemoved] = useState(false)
  const imageInputRef = useRef<HTMLInputElement | null>(null)

  useEffect(() => {
    const controller = new AbortController()

    const loadAnnouncement = async () => {
      setLoading(true)
      setError(null)
      try {
        const res = await fetch(`/api/proxy/ecommerce/announcements/${announcementId}`, {
          cache: 'no-store',
          signal: controller.signal,
          headers: {
            Accept: 'application/json',
            'Accept-Language': 'en',
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
          setError('Failed to load announcement')
          return
        }

        const announcement = data?.data as AnnouncementApiItem | undefined
        if (!announcement || typeof announcement !== 'object') {
          setError('Failed to load announcement')
          return
        }

        const mappedAnnouncement = mapAnnouncementApiItemToRow(announcement)
        setLoadedAnnouncement(mappedAnnouncement)

        // Format dates for date input (YYYY-MM-DD)
        const formatDateForInput = (dateStr: string | null | undefined): string => {
          if (!dateStr) return ''
          try {
            const date = new Date(dateStr)
            return date.toISOString().split('T')[0]
          } catch {
            return ''
          }
        }

        setForm({
          title: typeof announcement.title === 'string' ? announcement.title : '',
          subtitle: typeof announcement.subtitle === 'string' ? announcement.subtitle : '',
          bodyText: typeof announcement.body_text === 'string' ? announcement.body_text : '',
          buttonLabel: typeof announcement.button_label === 'string' ? announcement.button_label : '',
          buttonLink: typeof announcement.button_link === 'string' ? announcement.button_link : '',
          isActive:
            announcement.is_active === true || announcement.is_active === 'true' || announcement.is_active === 1
              ? 'active'
              : 'inactive',
          startAt: formatDateForInput(announcement.start_at),
          endAt: formatDateForInput(announcement.end_at),
          imageFile: null,
        })

        if (announcement.image_url || announcement.image_path) {
          setExistingImageUrl(announcement.image_url || announcement.image_path || null)
          setImageRemoved(false)
        }
      } catch (err) {
        if (!(err instanceof DOMException && err.name === 'AbortError')) {
          setError('Failed to load announcement')
        }
      } finally {
        setLoading(false)
      }
    }

    loadAnnouncement().catch(() => {
      setLoading(false)
      setError('Failed to load announcement')
    })

    return () => controller.abort()
  }, [announcementId])

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
        setExistingImageUrl(null) // Clear existing image when new one is selected
        setImageRemoved(false)
      }
      reader.readAsDataURL(file)
    } else {
      setImagePreview(null)
    }
  }

  const handleImageClick = () => {
    if (!disableForm) {
      imageInputRef.current?.click()
    }
  }

  const handleRemoveImage = () => {
    if (disableForm) return
    setForm((prev) => ({ ...prev, imageFile: null }))
    setImagePreview(null)
    setExistingImageUrl(null)
    setImageRemoved(true)
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
      formData.append('_method', 'PUT')
      formData.append('title', form.title.trim())
      formData.append('subtitle', form.subtitle.trim())
      formData.append('body_text', form.bodyText.trim())
      formData.append('button_label', form.buttonLabel.trim())
      formData.append('button_link', form.buttonLink.trim())
      formData.append('is_active', form.isActive === 'active' ? '1' : '0')
      formData.append('start_at', form.startAt)
      formData.append('end_at', form.endAt)

      if (form.imageFile) {
        formData.append('image_file', form.imageFile)
      } else if (imageRemoved) {
        formData.append('image_path', '')
      }

      const res = await fetch(`/api/proxy/ecommerce/announcements/${announcementId}`, {
        method: 'POST',
        body: formData,
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
        setError('Failed to update announcement')
        return
      }

      const payloadData =
        data && typeof data === 'object' && 'data' in data
          ? ((data as { data?: AnnouncementApiItem | null }).data ?? null)
          : null

      const announcementRow: AnnouncementRowData = payloadData
        ? mapAnnouncementApiItemToRow(payloadData)
        : {
            id: loadedAnnouncement?.id ?? announcementId,
            key: loadedAnnouncement?.key ?? '',
            title: form.title.trim(),
            subtitle: form.subtitle.trim(),
            bodyText: form.bodyText.trim(),
            imagePath: existingImageUrl || '',
            imageUrl: existingImageUrl || '',
            buttonLabel: form.buttonLabel.trim(),
            buttonLink: form.buttonLink.trim(),
            isActive: form.isActive === 'active',
            startAt: form.startAt,
            endAt: form.endAt,
            sortOrder: loadedAnnouncement?.sortOrder ?? 0,
            createdAt: loadedAnnouncement?.createdAt ?? '',
            updatedAt: new Date().toISOString(),
            formattedStartAt: form.startAt,
            formattedEndAt: form.endAt,
            formattedCreatedAt: loadedAnnouncement?.formattedCreatedAt ?? '',
            formattedUpdatedAt: new Date().toLocaleDateString(),
          }

      setLoadedAnnouncement(announcementRow)
      onSuccess(announcementRow)
    } catch (err) {
      console.error(err)
      setError('Failed to update announcement')
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
          <h2 className="text-lg font-semibold">Edit Announcement</h2>
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
            <div className="flex flex-col gap-6 mb-4 lg:flex-row">
              <div className="w-full lg:w-1/2 space-y-1">
                <h3 className="text-sm font-medium text-gray-700">Image</h3>
                <p className="text-xs text-red-500 mb-2">Suggested size: 1600 x 1200</p>
                <div
                  onClick={handleImageClick}
                  className={`relative border-2 border-dashed rounded-lg p-4 cursor-pointer transition-colors ${
                    imagePreview || existingImageUrl
                      ? 'border-gray-300'
                      : 'border-gray-300 hover:border-blue-400'
                  }`}
                >
                  <input
                    ref={imageInputRef}
                    id="edit-imageFile"
                    name="imageFile"
                    type="file"
                    accept="image/*"
                    onChange={handleImageChange}
                    className="hidden"
                    disabled={disableForm}
                  />
                  {imagePreview || existingImageUrl ? (
                    <div className="relative group">
                      <img
                        src={imagePreview || existingImageUrl || ''}
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
                          disabled={disableForm}
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
                          disabled={disableForm}
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
                    htmlFor="edit-title"
                    className="block text-sm font-medium text-gray-700 mb-1"
                  >
                    Title <span className="text-red-500">*</span>
                  </label>
                  <input
                    id="edit-title"
                    name="title"
                    type="text"
                    value={form.title}
                    onChange={handleChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-blue-500 focus:border-blue-500"
                    placeholder="Welcome to Our Store"
                    disabled={disableForm}
                    required
                  />
                </div>

                <div>
                  <label
                    htmlFor="edit-subtitle"
                    className="block text-sm font-medium text-gray-700 mb-1"
                  >
                    Subtitle
                  </label>
                  <input
                    id="edit-subtitle"
                    name="subtitle"
                    type="text"
                    value={form.subtitle}
                    onChange={handleChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-blue-500 focus:border-blue-500"
                    placeholder="Special Offer Today"
                    disabled={disableForm}
                  />
                </div>

                <div>
                  <label
                    htmlFor="edit-bodyText"
                    className="block text-sm font-medium text-gray-700 mb-1"
                  >
                    Body Text
                  </label>
                  <textarea
                    id="edit-bodyText"
                    name="bodyText"
                    value={form.bodyText}
                    onChange={handleChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-blue-500 focus:border-blue-500"
                    placeholder="Get 20% off on all products!"
                    disabled={disableForm}
                    rows={3}
                  />
                </div>

                <div>
                  <label
                    htmlFor="edit-status"
                    className="block text-sm font-medium text-gray-700 mb-1"
                  >
                    Status <span className="text-red-500">*</span>
                  </label>
                  <select
                    id="edit-status"
                    name="isActive"
                    value={form.isActive}
                    onChange={handleChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-blue-500 focus:border-blue-500"
                    disabled={disableForm}
                  >
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                  </select>
                </div>
              </div>
            </div>
          )}

          {/* Button & Dates Section */}
          {!loading && (
          <div className="space-y-4">

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label
                  htmlFor="edit-buttonLabel"
                  className="block text-sm font-medium text-gray-700"
                >
                  Button Label
                </label>
                <input
                  id="edit-buttonLabel"
                  name="buttonLabel"
                  type="text"
                  value={form.buttonLabel}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Shop Now"
                  disabled={disableForm}
                />
              </div>

              <div className="space-y-2">
                <label
                  htmlFor="edit-buttonLink"
                  className="block text-sm font-medium text-gray-700"
                >
                  Button Link
                </label>
                <input
                  id="edit-buttonLink"
                  name="buttonLink"
                  type="text"
                  value={form.buttonLink}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-blue-500 focus:border-blue-500"
                  placeholder="/shop"
                  disabled={disableForm}
                />
              </div>

              <div className="space-y-2">
                <label
                  htmlFor="edit-startAt"
                  className="block text-sm font-medium text-gray-700"
                >
                  Start Date
                </label>
                <input
                  id="edit-startAt"
                  name="startAt"
                  type="date"
                  value={form.startAt}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-blue-500 focus:border-blue-500"
                  disabled={disableForm}
                />
              </div>

              <div className="space-y-2">
                <label
                  htmlFor="edit-endAt"
                  className="block text-sm font-medium text-gray-700"
                >
                  End Date
                </label>
                <input
                  id="edit-endAt"
                  name="endAt"
                  type="date"
                  value={form.endAt}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-blue-500 focus:border-blue-500"
                  disabled={disableForm}
                />
              </div>
            </div>
          </div>
          )}

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
              disabled={disableForm}
            >
              {submitting ? t('common.saving') : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
