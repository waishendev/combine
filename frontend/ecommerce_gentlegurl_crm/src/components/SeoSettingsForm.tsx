'use client'

import { ChangeEvent, FormEvent, useEffect, useMemo, useRef, useState } from 'react'

import { IMAGE_ACCEPT } from './mediaAccept'

type SeoSettings = {
  default_title: string
  default_description: string
  default_keywords: string
  default_og_image: string | null
  updated_at?: string
}

type SeoApiResponse = {
  data?: SeoSettings | null
  message?: string | null
  success?: boolean
}

type FeedbackState = {
  type: 'success' | 'error'
  message: string
}

type SeoSettingsFormProps = {
  canEdit: boolean
}

export default function SeoSettingsForm({ canEdit }: SeoSettingsFormProps) {
  const [formState, setFormState] = useState<SeoSettings>({
    default_title: '',
    default_description: '',
    default_keywords: '',
    default_og_image: '',
    updated_at: undefined,
  })
  const [initialState, setInitialState] = useState<SeoSettings | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [feedback, setFeedback] = useState<FeedbackState | null>(null)
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const [imageFile, setImageFile] = useState<File | null>(null)
  const imageInputRef = useRef<HTMLInputElement | null>(null)

  const lastUpdatedLabel = useMemo(() => {
    if (!formState.updated_at) return null
    const updated = new Date(formState.updated_at)
    if (Number.isNaN(updated.getTime())) return null
    return updated.toLocaleString()
  }, [formState.updated_at])

  useEffect(() => {
    let abort = false
    const fetchSeoSettings = async () => {
      try {
        const response = await fetch('/api/proxy/ecommerce/seo-global', {
          cache: 'no-store',
        })

        if (!response.ok) {
          throw new Error('Failed to load SEO settings')
        }

        const payload: SeoApiResponse = await response.json()
        const data = payload?.data

        if (!data) {
          throw new Error('No SEO settings returned')
        }

        if (!abort) {
          setFormState({
            default_title: data.default_title ?? '',
            default_description: data.default_description ?? '',
            default_keywords: data.default_keywords ?? '',
            default_og_image: data.default_og_image ?? '',
            updated_at: data.updated_at,
          })
          setInitialState({
            default_title: data.default_title ?? '',
            default_description: data.default_description ?? '',
            default_keywords: data.default_keywords ?? '',
            default_og_image: data.default_og_image ?? '',
            updated_at: data.updated_at,
          })
          if (data.default_og_image) {
            setImagePreview(data.default_og_image)
          }
          setFeedback(null)
        }
      } catch (error) {
        if (!abort) {
          setFeedback({
            type: 'error',
            message:
              error instanceof Error
                ? error.message
                : 'Unable to fetch SEO settings right now.',
          })
        }
      } finally {
        if (!abort) {
          setLoading(false)
        }
      }
    }

    fetchSeoSettings()
    return () => {
      abort = true
    }
  }, [])

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!canEdit) return

    setSaving(true)
    setFeedback(null)

    try {
      // If there's a new image file, upload it first
      let ogImageUrl = formState.default_og_image || null
      
      if (imageFile) {
        const formData = new FormData()
        formData.append('image_file', imageFile)
        
        const uploadResponse = await fetch('/api/proxy/ecommerce/seo-global/upload-image', {
          method: 'POST',
          body: formData,
        })
        
        if (uploadResponse.ok) {
          const uploadData = await uploadResponse.json()
          ogImageUrl = uploadData?.data?.image_url || uploadData?.image_url || null
        } else {
          throw new Error('Failed to upload image')
        }
      }

      const response = await fetch('/api/proxy/ecommerce/seo-global', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          default_title: formState.default_title,
          default_description: formState.default_description,
          default_keywords: formState.default_keywords,
          default_og_image: ogImageUrl,
        }),
      })

      const payload: SeoApiResponse = await response.json().catch(() => ({
        success: false,
        message: 'Unable to parse response from server.',
      }))

      if (!response.ok || payload?.success === false) {
        throw new Error(payload?.message || 'Failed to update SEO settings')
      }

      const updatedData = payload?.data
      if (updatedData) {
        setFormState((prev) => ({
          ...prev,
          ...updatedData,
        }))
        setInitialState({
          default_title: updatedData.default_title ?? '',
          default_description: updatedData.default_description ?? '',
          default_keywords: updatedData.default_keywords ?? '',
          default_og_image: updatedData.default_og_image ?? '',
          updated_at: updatedData.updated_at,
        })
        if (updatedData.default_og_image) {
          setImagePreview(updatedData.default_og_image)
        }
        setImageFile(null)
        if (imageInputRef.current) {
          imageInputRef.current.value = ''
        }
      }

      setFeedback({
        type: 'success',
        message: payload?.message || 'SEO settings updated successfully.',
      })
    } catch (error) {
      setFeedback({
        type: 'error',
        message:
          error instanceof Error
            ? error.message
            : 'Unable to update SEO settings right now.',
      })
    } finally {
      setSaving(false)
    }
  }

  const handleReset = () => {
    if (!initialState) return
    setFormState(initialState)
    setImagePreview(initialState.default_og_image || null)
    setImageFile(null)
    if (imageInputRef.current) {
      imageInputRef.current.value = ''
    }
    setFeedback(null)
  }

  const handleImageChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] || null
    setImageFile(file)
    
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
    if (!inputDisabled) {
      imageInputRef.current?.click()
    }
  }

  const handleRemoveImage = () => {
    if (inputDisabled) return
    setImageFile(null)
    setImagePreview(null)
    setFormState((prev) => ({ ...prev, default_og_image: '' }))
    if (imageInputRef.current) {
      imageInputRef.current.value = ''
    }
  }

  const inputDisabled = !canEdit || saving

  return (
    <div className="bg-white border border-slate-200 rounded-2xl shadow-sm">
      <div className="border-b border-slate-200 px-6 py-4 flex items-center justify-between">
        <div>
          <h3 className="text-xl font-semibold text-slate-900">Default metadata</h3>
          <p className="text-sm text-slate-500 mt-1">
            Define the fallback metadata for every page across your ecommerce
            experience.
          </p>
        </div>
        {lastUpdatedLabel && (
          <div className="text-right">
            <p className="text-[11px] uppercase tracking-[0.16em] text-slate-400">Last updated</p>
            <p className="text-sm font-medium text-slate-700">{lastUpdatedLabel}</p>
          </div>
        )}
      </div>

      <form className="px-6 py-6 space-y-5" onSubmit={handleSubmit}>
        {feedback && (
          <div
            className={`rounded-lg border px-4 py-3 text-sm ${
              feedback.type === 'success'
                ? 'border-green-200 bg-green-50 text-green-800'
                : 'border-rose-200 bg-rose-50 text-rose-800'
            }`}
          >
            <div className="flex items-start">
              <i
                className={`fa-solid ${
                  feedback.type === 'success' ? 'fa-circle-check' : 'fa-circle-exclamation'
                } mr-2 mt-[2px]`}
              />
              <p>{feedback.message}</p>
            </div>
          </div>
        )}

        {loading ? (
          <div className="space-y-3">
            <div className="h-4 w-32 bg-slate-100 rounded animate-pulse" />
            <div className="h-11 w-full bg-slate-100 rounded-lg animate-pulse" />
            <div className="h-4 w-52 bg-slate-100 rounded animate-pulse" />
            <div className="h-28 w-full bg-slate-100 rounded-lg animate-pulse" />
            <div className="h-4 w-40 bg-slate-100 rounded animate-pulse" />
            <div className="h-11 w-full bg-slate-100 rounded-lg animate-pulse" />
          </div>
        ) : (
          <div className="flex flex-col gap-6 lg:flex-row mb-4">
            {/* Left Column - Image Upload */}
            <div className="w-full lg:w-1/2 space-y-1">
              <h3 className="text-sm font-medium text-gray-700">Default Open Graph Image</h3>
              <p className="text-xs text-red-500 mb-2">Suggested size: 1200 x 630</p>
              <div
                onClick={handleImageClick}
                className={`relative border-2 border-dashed rounded-lg p-4 cursor-pointer transition-colors ${
                  imagePreview
                    ? 'border-gray-300'
                    : 'border-gray-300 hover:border-blue-400'
                } ${inputDisabled ? 'cursor-not-allowed opacity-60' : ''}`}
              >
                <input
                  ref={imageInputRef}
                  id="ogImageFile"
                  name="ogImageFile"
                  type="file"
                  accept={IMAGE_ACCEPT}
                  onChange={handleImageChange}
                  className="hidden"
                  disabled={inputDisabled}
                />
                {imagePreview ? (
                  <div className="relative group">
                    <img
                      src={imagePreview}
                      alt="Open Graph Preview"
                      className="w-full h-64 object-contain rounded"
                    />
                    {!inputDisabled && (
                      <div className="absolute top-2 right-2 flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                        <button
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation()
                            handleImageClick()
                          }}
                          className="w-8 h-8 bg-blue-500/95 backdrop-blur-md text-white rounded-full flex items-center justify-center shadow-lg border border-blue-400/30 hover:bg-blue-600 hover:shadow-xl hover:scale-110 transition-all duration-200"
                          aria-label="Replace image"
                          disabled={inputDisabled}
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
                          disabled={inputDisabled}
                        >
                          <i className="fa-solid fa-trash-can text-xs" />
                        </button>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-16">
                    <i className="fa-solid fa-cloud-arrow-up text-4xl text-gray-400 mb-2" />
                    <p className="text-sm text-gray-600">Click to upload</p>
                  </div>
                )}
              </div>
              <p className="text-xs text-slate-500 mt-2">
                Used for social previews when a page does not have its own Open Graph image.
              </p>
            </div>

            {/* Right Column - Form Fields */}
            <div className="w-full lg:w-1/2 space-y-4">
              <div>
                <label
                  htmlFor="default_title"
                  className="block text-sm font-medium text-gray-700 mb-1"
                >
                  Default title <span className="text-red-500">*</span>
                </label>
                <input
                  id="default_title"
                  name="default_title"
                  value={formState.default_title}
                  onChange={(event) =>
                    setFormState((prev) => ({ ...prev, default_title: event.target.value }))
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-blue-500 focus:border-blue-500"
                  placeholder="e.g. My Shop — Modern ecommerce"
                  disabled={inputDisabled}
                  required
                />
                <p className="text-xs text-slate-500 mt-1">
                  Appears as the base title for pages without a custom meta title.
                </p>
              </div>

              <div>
                <label
                  htmlFor="default_description"
                  className="block text-sm font-medium text-gray-700 mb-1"
                >
                  Default description <span className="text-red-500">*</span>
                </label>
                <textarea
                  id="default_description"
                  name="default_description"
                  value={formState.default_description}
                  onChange={(event) =>
                    setFormState((prev) => ({
                      ...prev,
                      default_description: event.target.value,
                    }))
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Concise description that summarizes your storefront for search engines."
                  disabled={inputDisabled}
                  required
                  rows={4}
                />
                <p className="text-xs text-slate-500 mt-1">
                  Keep this between 140-160 characters for the best search snippet quality.
                </p>
              </div>

              <div>
                <label
                  htmlFor="default_keywords"
                  className="block text-sm font-medium text-gray-700 mb-1"
                >
                  Default keywords
                </label>
                <input
                  id="default_keywords"
                  name="default_keywords"
                  value={formState.default_keywords}
                  onChange={(event) =>
                    setFormState((prev) => ({ ...prev, default_keywords: event.target.value }))
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-blue-500 focus:border-blue-500"
                  placeholder="myshop, ecommerce, shopping"
                  disabled={inputDisabled}
                />
                <p className="text-xs text-slate-500 mt-1">
                  Comma-separated keywords that help describe your catalog and brand.
                </p>
              </div>
            </div>
          </div>
        )}

        <div className="flex flex-wrap justify-between gap-3 pt-2">
          <div className="text-xs text-slate-500 flex items-center gap-2">
            <i className="fa-regular fa-shield-check" />
            {canEdit ? 'You can edit these settings.' : 'You can view but not edit SEO defaults.'}
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleReset}
              disabled={!canEdit || saving || !initialState}
              className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
            >
              Reset changes
            </button>
            <button
              type="submit"
              disabled={!canEdit || saving}
              className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {saving && <i className="fa-solid fa-spinner fa-spin" aria-hidden="true" />}
              Save defaults
            </button>
          </div>
        </div>
      </form>
    </div>
  )
}
