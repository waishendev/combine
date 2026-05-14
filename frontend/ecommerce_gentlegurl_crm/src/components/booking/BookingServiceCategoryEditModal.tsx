'use client'

import { ChangeEvent, FormEvent, useEffect, useRef, useState } from 'react'

import type { BookingServiceCategoryRowData } from './BookingServiceCategoryRow'
import {
  mapBookingServiceCategoryApiItemToRow,
  formatBookingCategorySubmitError,
  type BookingServiceCategoryApiItem,
} from './bookingServiceCategoryUtils'
import { useI18n } from '@/lib/i18n'
import { IMAGE_ACCEPT } from '@/components/mediaAccept'
import { BOOKING_SERVICE_COVER_IMAGE_SUGGESTED_SIZE_LINE } from './bookingServiceUtils'
import BookingCategoryServicesSection, {
  type BookingCategoryServiceOption,
} from './BookingCategoryServicesSection'

interface BookingServiceCategoryEditModalProps {
  categoryId: number
  onClose: () => void
  onSuccess: (category: BookingServiceCategoryRowData) => void
}

export default function BookingServiceCategoryEditModal({
  categoryId,
  onClose,
  onSuccess,
}: BookingServiceCategoryEditModalProps) {
  const { t } = useI18n()
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [name, setName] = useState('')
  const [cnName, setCnName] = useState('')
  const [slug, setSlug] = useState('')
  const [description, setDescription] = useState('')
  const [isActive, setIsActive] = useState(true)
  const [serviceIds, setServiceIds] = useState<number[]>([])
  const [services, setServices] = useState<BookingCategoryServiceOption[]>([])
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const [initialImageUrl, setInitialImageUrl] = useState<string | null>(null)
  const imageInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    let ignore = false
    const loadServices = async () => {
      try {
        const res = await fetch('/api/proxy/admin/booking/services?per_page=200', { cache: 'no-store' })
        if (!res.ok) return
        const json = await res.json().catch(() => null)
        const payload = json?.data?.data
        const rows = Array.isArray(payload) ? payload : []
        if (!ignore) {
          setServices(
            rows
              .map((r: { id?: unknown; name?: unknown }) => ({
                id: Number(r?.id),
                name: String(r?.name ?? ''),
              }))
              .filter((r: BookingCategoryServiceOption) => r.id > 0 && r.name),
          )
        }
      } catch {
        if (!ignore) setServices([])
      }
    }
    void loadServices()
    return () => {
      ignore = true
    }
  }, [])

  useEffect(() => {
    const controller = new AbortController()
    const load = async () => {
      setLoading(true)
      setError(null)
      try {
        const res = await fetch(`/api/proxy/admin/booking/categories/${categoryId}`, {
          cache: 'no-store',
          signal: controller.signal,
          headers: { Accept: 'application/json' },
        })
        const data = await res.json().catch(() => null)
        if (data?.success === false && data?.message === 'Unauthorized') {
          window.location.replace('/dashboard')
          return
        }
        if (!res.ok) {
          setError('Failed to load category')
          return
        }
        const raw = data?.data as
          | {
              name?: string
              cn_name?: string | null
              slug?: string
              description?: string | null
              is_active?: boolean
              image_url?: string | null
              service_ids?: number[]
            }
          | undefined
        if (!raw) {
          setError('Failed to load category')
          return
        }
        setName(String(raw.name ?? ''))
        setCnName(String(raw.cn_name ?? ''))
        setSlug(String(raw.slug ?? ''))
        setDescription(String(raw.description ?? ''))
        setIsActive(Boolean(raw.is_active))
        setServiceIds(Array.isArray(raw.service_ids) ? raw.service_ids.map((id) => Number(id)) : [])
        const existingUrl = typeof raw.image_url === 'string' ? raw.image_url : null
        setInitialImageUrl(existingUrl)
        setImagePreview(existingUrl)
        setImageFile(null)
      } catch (err) {
        if (!(err instanceof DOMException && err.name === 'AbortError')) {
          setError('Failed to load category')
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false)
      }
    }
    void load()
    return () => controller.abort()
  }, [categoryId])

  const toggleService = (id: number) => {
    setServiceIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    )
  }

  const handleImageChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) {
      setImageFile(null)
      setImagePreview(initialImageUrl)
      return
    }
    setImageFile(file)
    const reader = new FileReader()
    reader.onloadend = () => setImagePreview(reader.result as string)
    reader.readAsDataURL(file)
  }

  const handleImageClick = () => imageInputRef.current?.click()

  const handleRemoveImage = () => {
    setImageFile(null)
    setImagePreview(initialImageUrl)
    if (imageInputRef.current) imageInputRef.current.value = ''
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    const trimmedName = name.trim()
    if (!trimmedName) {
      setError('Name is required')
      return
    }
    setSubmitting(true)
    setError(null)
    try {
      const fd = new FormData()
      fd.append('_method', 'PUT')
      fd.append('name', trimmedName)
      fd.append('cn_name', cnName.trim())
      if (slug.trim()) fd.append('slug', slug.trim())
      fd.append('description', description.trim())
      fd.append('is_active', isActive ? '1' : '0')
      if (imageFile) fd.append('image', imageFile)
      serviceIds.forEach((id) => fd.append('service_ids[]', String(id)))

      const res = await fetch(`/api/proxy/admin/booking/categories/${categoryId}`, {
        method: 'POST',
        body: fd,
        headers: { Accept: 'application/json' },
      })
      const data = await res.json().catch(() => null)
      if (!res.ok) {
        setError(formatBookingCategorySubmitError(data, 'Failed to update category'))
        return
      }
      const payload = data?.data as BookingServiceCategoryApiItem | undefined
      const row = payload
        ? mapBookingServiceCategoryApiItemToRow(payload)
        : {
            id: categoryId,
            name: trimmedName,
            cnName: cnName.trim(),
            slug: slug.trim(),
            sortOrder: null,
            isActive,
          }
      onSuccess(row)
    } catch {
      setError('Failed to update category')
    } finally {
      setSubmitting(false)
    }
  }

  const disableForm = loading || submitting

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <form
        onSubmit={handleSubmit}
        className="mx-4 w-full max-w-5xl max-h-[90vh] overflow-y-auto rounded-lg bg-white p-6 shadow-lg"
      >
        <div className="mb-4 flex items-start justify-between border-b border-gray-200 pb-4">
          <h2 className="text-lg font-semibold">Edit Category</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded p-1 text-gray-500 hover:bg-gray-100 hover:text-gray-700"
            aria-label={t('common.close')}
            disabled={submitting}
          >
            <i className="fa-solid fa-xmark" />
          </button>
        </div>

        {loading ? (
          <div className="flex flex-col gap-6 py-6 lg:flex-row lg:items-start">
            <div className="w-full shrink-0 space-y-2 lg:w-[300px]">
              <div className="h-4 w-20 animate-pulse rounded bg-gray-200" />
              <div className="h-48 rounded-lg border-2 border-dashed border-gray-200 bg-gray-50" />
            </div>
            <div className="flex flex-1 items-center justify-center py-12 text-sm text-gray-500">
              {t('common.loadingDetails')}
            </div>
          </div>
        ) : (
          <>
            <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
              <div className="w-full shrink-0 space-y-2 lg:w-[300px]">
                <h3 className="text-sm font-medium text-gray-700">Image</h3>
                <p className="text-xs text-gray-500">{BOOKING_SERVICE_COVER_IMAGE_SUGGESTED_SIZE_LINE}</p>
                <div
                  role="button"
                  tabIndex={0}
                  onClick={() => !disableForm && handleImageClick()}
                  onKeyDown={(e) => {
                    if (disableForm) return
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault()
                      handleImageClick()
                    }
                  }}
                  className={`relative rounded-lg border-2 border-dashed p-4 transition-colors ${
                    disableForm ? 'cursor-not-allowed opacity-60' : 'cursor-pointer hover:border-blue-400'
                  } ${imagePreview ? 'border-gray-300' : 'border-gray-300'}`}
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
                        alt=""
                        className="mx-auto h-48 max-h-[220px] w-full max-w-[260px] rounded object-contain"
                      />
                      <div className="absolute right-2 top-2 flex gap-2 opacity-0 transition-opacity group-hover:opacity-100">
                        <button
                          type="button"
                          onClick={(ev) => {
                            ev.stopPropagation()
                            if (!disableForm) handleImageClick()
                          }}
                          disabled={disableForm}
                          className="flex h-8 w-8 items-center justify-center rounded-full border border-blue-400/30 bg-blue-500/95 text-white shadow-lg hover:bg-blue-600 disabled:opacity-50"
                          aria-label="Replace image"
                        >
                          <i className="fa-solid fa-image text-xs" />
                        </button>
                        <button
                          type="button"
                          onClick={(ev) => {
                            ev.stopPropagation()
                            if (!disableForm) handleRemoveImage()
                          }}
                          disabled={disableForm}
                          className="flex h-8 w-8 items-center justify-center rounded-full border border-red-400/30 bg-red-500/95 text-white shadow-lg hover:bg-red-600 disabled:opacity-50"
                          aria-label="Clear new image selection"
                        >
                          <i className="fa-solid fa-trash-can text-xs" />
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center py-10">
                      <i className="fa-solid fa-cloud-arrow-up mb-2 text-4xl text-gray-400" aria-hidden />
                      <p className="text-sm text-gray-600">Click to upload</p>
                    </div>
                  )}
                </div>
              </div>

              <div className="min-w-0 flex-1 space-y-4">
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">
                    English Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    required
                    disabled={disableForm}
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">Chinese Name</label>
                  <input
                    value={cnName}
                    onChange={(e) => setCnName(e.target.value)}
                    className="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    placeholder="中文分类名称"
                    disabled={disableForm}
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">Slug</label>
                  <input
                    value={slug}
                    onChange={(e) => setSlug(e.target.value)}
                    className="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    disabled={disableForm}
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">Description</label>
                  <textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    rows={3}
                    className="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    disabled={disableForm}
                  />
                </div>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={isActive}
                    onChange={(e) => setIsActive(e.target.checked)}
                    disabled={disableForm}
                  />
                  Active
                </label>
                <BookingCategoryServicesSection
                  services={services}
                  serviceIds={serviceIds}
                  onToggle={toggleService}
                  disabled={disableForm}
                />
              </div>
            </div>

            {error && (
              <div className="mt-4 rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">
                {error}
              </div>
            )}

            <div className="mt-6 flex items-center justify-end gap-2 border-t border-gray-200 pt-4">
              <button
                type="button"
                onClick={onClose}
                className="rounded border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                disabled={submitting}
              >
                {t('common.cancel')}
              </button>
              <button
                type="submit"
                className="rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60"
                disabled={disableForm}
              >
                {submitting ? t('common.saving') : 'Save changes'}
              </button>
            </div>
          </>
        )}
      </form>
    </div>
  )
}
