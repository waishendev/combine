'use client'

import { ChangeEvent, FormEvent, useEffect, useRef, useState } from 'react'

import type { SliderRowData } from './SliderRow'
import { mapSliderApiItemToRow, type SliderApiItem } from './sliderUtils'
import { useI18n } from '@/lib/i18n'

interface SliderEditModalProps {
  sliderId: number
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
  isActive: 'active' | 'inactive'
}

const initialFormState: FormState = {
  title: '',
  subtitle: '',
  button_label: '',
  button_link: '',
  start_at: '',
  end_at: '',
  isActive: 'active',
}

export default function SliderEditModal({
  sliderId,
  onClose,
  onSuccess,
}: SliderEditModalProps) {
  const { t } = useI18n()
  const [form, setForm] = useState<FormState>({ ...initialFormState })
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loadedSlider, setLoadedSlider] = useState<SliderRowData | null>(null)
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [mobileImageFile, setMobileImageFile] = useState<File | null>(null)
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const [mobileImagePreview, setMobileImagePreview] = useState<string | null>(null)
  const [desktopImageRemoved, setDesktopImageRemoved] = useState(false)
  const [mobileImageRemoved, setMobileImageRemoved] = useState(false)
  const imageInputRef = useRef<HTMLInputElement>(null)
  const mobileImageInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const controller = new AbortController()

    const loadSlider = async () => {
      setLoading(true)
      setError(null)
      try {
        const res = await fetch(`/api/proxy/ecommerce/home-sliders/${sliderId}`, {
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
          setError('Failed to load slider')
          return
        }

        const slider = data?.data as SliderApiItem | undefined
        if (!slider || typeof slider !== 'object') {
          setError('Failed to load slider')
          return
        }

        const mappedSlider = mapSliderApiItemToRow(slider)
        setLoadedSlider(mappedSlider)

        // Format dates for date inputs (YYYY-MM-DD)
        const formatDateForInput = (dateString: string) => {
          if (!dateString) return ''
          try {
            const date = new Date(dateString)
            return date.toISOString().split('T')[0]
          } catch {
            return dateString.split('T')[0] || ''
          }
        }

        // Set image previews from existing paths (prioritize image_url over image_path)
        const imageUrl = slider.image_url ?? slider.image_path
        if (imageUrl) {
          setImagePreview(imageUrl)
        }
        const mobileImageUrl = slider.mobile_image_url ?? slider.mobile_image_path
        if (mobileImageUrl) {
          setMobileImagePreview(mobileImageUrl)
        }
        setDesktopImageRemoved(false)
        setMobileImageRemoved(false)

        setForm({
          title: typeof slider.title === 'string' ? slider.title : '',
          subtitle: typeof slider.subtitle === 'string' ? slider.subtitle : '',
          button_label: typeof slider.button_label === 'string' ? slider.button_label : '',
          button_link: typeof slider.button_link === 'string' ? slider.button_link : '',
          start_at: formatDateForInput(slider.start_at ?? ''),
          end_at: formatDateForInput(slider.end_at ?? ''),
          isActive:
            slider.is_active === true || slider.is_active === 'true' || slider.is_active === 1
              ? 'active'
              : 'inactive',
        })
      } catch (err) {
        if (!(err instanceof DOMException && err.name === 'AbortError')) {
          setError('Failed to load slider')
        }
      } finally {
        setLoading(false)
      }
    }

    loadSlider().catch(() => {
      setLoading(false)
      setError('Failed to load slider')
    })

    return () => controller.abort()
  }, [sliderId])

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
      setDesktopImageRemoved(false)
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
      setMobileImageRemoved(false)
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
    setDesktopImageRemoved(true)
    if (imageInputRef.current) {
      imageInputRef.current.value = ''
    }
  }

  const handleRemoveMobileImage = () => {
    setMobileImageFile(null)
    setMobileImagePreview(null)
    setMobileImageRemoved(true)
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

    // Image is required - either existing or new upload
    if (!imagePreview && !imageFile) {
      setError('Desktop image is required')
      return
    }

    setSubmitting(true)
    setError(null)

    try {
      const formData = new FormData()
      formData.append('_method', 'PUT')
      formData.append('title', trimmedTitle)
      formData.append('subtitle', trimmedSubtitle)
      if (imageFile) {
        formData.append('image_file', imageFile)
      }
      if (mobileImageFile) {
        formData.append('mobile_image_file', mobileImageFile)
      } else if (mobileImageRemoved) {
        formData.append('mobile_image_path', '')
      }
      formData.append('button_label', trimmedButtonLabel)
      formData.append('button_link', trimmedButtonLink)
      formData.append('start_at', trimmedStartAt)
      formData.append('end_at', trimmedEndAt)
      formData.append('is_active', form.isActive === 'active' ? '1' : '0')

      const res = await fetch(`/api/proxy/ecommerce/home-sliders/${sliderId}`, {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Accept-Language': 'en',
        },
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
        setError('Failed to update slider')
        return
      }

      const payloadData =
        data && typeof data === 'object' && 'data' in data
          ? ((data as { data?: SliderApiItem | null }).data ?? null)
          : null

      const sliderRow: SliderRowData = payloadData
        ? mapSliderApiItemToRow(payloadData)
        : {
            id: loadedSlider?.id ?? sliderId,
            title: trimmedTitle,
            subtitle: trimmedSubtitle,
            image_path: imagePreview || loadedSlider?.image_path || '',
            mobile_image_path: mobileImagePreview || loadedSlider?.mobile_image_path || '',
            button_label: trimmedButtonLabel,
            button_link: trimmedButtonLink,
            start_at: trimmedStartAt,
            end_at: trimmedEndAt,
            isActive: form.isActive === 'active',
            sort_order: loadedSlider?.sort_order ?? null,
            createdAt: loadedSlider?.createdAt ?? '',
            updatedAt: new Date().toISOString(),
          }

      setLoadedSlider(sliderRow)
      onSuccess(sliderRow)
    } catch (err) {
      console.error(err)
      setError('Failed to update slider')
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
        <div className="flex items-center justify-between border-b border-gray-300 px-5 py-4">
          <h2 className="text-lg font-semibold">Edit Slider</h2>
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
                        disabled={disableForm}
                      />
                      {imagePreview ? (
                        <div className="relative group">
                          <img
                            src={imagePreview}
                            alt="Preview"
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
                              aria-label="Replace desktop image"
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
                              aria-label="Delete desktop image"
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
                        disabled={disableForm}
                      />
                      {mobileImagePreview ? (
                        <div className="relative group">
                          <img
                            src={mobileImagePreview}
                            alt="Mobile Preview"
                            className="w-full h-48 object-contain rounded"
                          />
                          <div className="absolute top-2 right-2 flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation()
                                handleMobileImageClick()
                              }}
                              className="w-8 h-8 bg-blue-500/95 backdrop-blur-md text-white rounded-full flex items-center justify-center shadow-lg border border-blue-400/30 hover:bg-blue-600 hover:shadow-xl hover:scale-110 transition-all duration-200"
                              aria-label="Replace mobile image"
                              disabled={disableForm}
                            >
                              <i className="fa-solid fa-image text-xs" />
                            </button>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation()
                                handleRemoveMobileImage()
                              }}
                              className="w-8 h-8 bg-red-500/95 backdrop-blur-md text-white rounded-full flex items-center justify-center shadow-lg border border-red-400/30 hover:bg-red-600 hover:shadow-xl hover:scale-110 transition-all duration-200"
                              aria-label="Delete mobile image"
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
                <div className="space-y-4">
                  <div>
                    <label
                      htmlFor="edit-title"
                      className="block text-sm font-medium text-gray-700 mb-1"
                    >
                      Title
                    </label>
                    <input
                      id="edit-title"
                      name="title"
                      type="text"
                      value={form.title}
                      onChange={handleChange}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-blue-500 focus:border-blue-500"
                      placeholder="Enter title"
                      disabled={disableForm}
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
                      placeholder="Enter subtitle"
                      disabled={disableForm}
                    />
                  </div>

                  <div>
                    <label
                      htmlFor="edit-button_label"
                      className="block text-sm font-medium text-gray-700 mb-1"
                    >
                      Button Label
                    </label>
                    <input
                      id="edit-button_label"
                      name="button_label"
                      type="text"
                      value={form.button_label}
                      onChange={handleChange}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-blue-500 focus:border-blue-500"
                      placeholder="Shop Now"
                      disabled={disableForm}
                    />
                  </div>

                  <div>
                    <label
                      htmlFor="edit-button_link"
                      className="block text-sm font-medium text-gray-700 mb-1"
                    >
                      Button Link
                    </label>
                    <input
                      id="edit-button_link"
                      name="button_link"
                      type="text"
                      value={form.button_link}
                      onChange={handleChange}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-blue-500 focus:border-blue-500"
                      placeholder="/shop"
                      disabled={disableForm}
                    />
                  </div>

                  <div>
                    <label
                      htmlFor="edit-start_at"
                      className="block text-sm font-medium text-gray-700 mb-1"
                    >
                      Start Date
                    </label>
                    <input
                      id="edit-start_at"
                      name="start_at"
                      type="date"
                      value={form.start_at}
                      onChange={handleChange}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-blue-500 focus:border-blue-500"
                      disabled={disableForm}
                    />
                  </div>

                  <div>
                    <label
                      htmlFor="edit-end_at"
                      className="block text-sm font-medium text-gray-700 mb-1"
                    >
                      End Date
                    </label>
                    <input
                      id="edit-end_at"
                      name="end_at"
                      type="date"
                      value={form.end_at}
                      onChange={handleChange}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-blue-500 focus:border-blue-500"
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
                      name="isActive"
                      value={form.isActive}
                      onChange={handleChange}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-blue-500 focus:border-blue-500"
                      disabled={disableForm}
                    >
                      <option value="active">{t('common.active')}</option>
                      <option value="inactive">{t('common.inactive')}</option>
                    </select>
                  </div>
                </div>
              </div>
            </>
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
