'use client'

import { ChangeEvent, FormEvent, useEffect, useMemo, useState } from 'react'

import type { BookingServiceCategoryRowData } from './BookingServiceCategoryRow'
import {
  mapBookingServiceCategoryApiItemToRow,
  type BookingServiceCategoryApiItem,
} from './bookingServiceCategoryUtils'
import { useI18n } from '@/lib/i18n'
import { IMAGE_ACCEPT } from '@/components/mediaAccept'

type ServiceOption = { id: number; name: string }

interface BookingServiceCategoryCreateModalProps {
  onClose: () => void
  onSuccess: (category: BookingServiceCategoryRowData) => void
}

export default function BookingServiceCategoryCreateModal({
  onClose,
  onSuccess,
}: BookingServiceCategoryCreateModalProps) {
  const { t } = useI18n()
  const [name, setName] = useState('')
  const [slug, setSlug] = useState('')
  const [description, setDescription] = useState('')
  const [isActive, setIsActive] = useState(true)
  const [serviceIds, setServiceIds] = useState<number[]>([])
  const [services, setServices] = useState<ServiceOption[]>([])
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let ignore = false
    const load = async () => {
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
              .filter((r: ServiceOption) => r.id > 0 && r.name),
          )
        }
      } catch {
        if (!ignore) setServices([])
      }
    }
    void load()
    return () => {
      ignore = true
    }
  }, [])

  const selectedLabel = useMemo(
    () => services.filter((s) => serviceIds.includes(s.id)).map((s) => s.name).join(', '),
    [services, serviceIds],
  )

  const toggleService = (id: number) => {
    setServiceIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    )
  }

  const handleImageChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) {
      setImageFile(null)
      setImagePreview(null)
      return
    }
    setImageFile(file)
    const reader = new FileReader()
    reader.onloadend = () => setImagePreview(reader.result as string)
    reader.readAsDataURL(file)
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
      fd.append('name', trimmedName)
      if (slug.trim()) fd.append('slug', slug.trim())
      fd.append('description', description.trim())
      fd.append('is_active', isActive ? '1' : '0')
      if (imageFile) fd.append('image', imageFile)
      serviceIds.forEach((id) => fd.append('service_ids[]', String(id)))

      const res = await fetch('/api/proxy/admin/booking/categories', {
        method: 'POST',
        body: fd,
        headers: { Accept: 'application/json' },
      })
      const data = await res.json().catch(() => null)
      if (!res.ok) {
        const msg =
          data && typeof data === 'object' && typeof (data as { message?: string }).message === 'string'
            ? (data as { message: string }).message
            : 'Failed to create category'
        setError(msg)
        return
      }
      const payload = data?.data as BookingServiceCategoryApiItem | undefined
      const row = payload
        ? mapBookingServiceCategoryApiItemToRow(payload)
        : {
            id: 0,
            name: trimmedName,
            slug: slug.trim() || '',
            sortOrder: null,
            isActive,
          }
      onSuccess(row)
    } catch {
      setError('Failed to create category')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-lg bg-white p-6 shadow-lg"
      >
        <div className="mb-4 flex items-start justify-between">
          <h2 className="text-lg font-semibold">Create Category</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded p-1 text-gray-500 hover:bg-gray-100 hover:text-gray-700"
            aria-label={t('common.close')}
          >
            <i className="fa-solid fa-xmark" />
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              Name <span className="text-red-500">*</span>
            </label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              placeholder="Category name"
              required
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Slug (optional)</label>
            <input
              value={slug}
              onChange={(e) => setSlug(e.target.value)}
              className="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              placeholder="auto-generated if empty"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              className="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              placeholder="Description"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Image</label>
            <input
              type="file"
              accept={IMAGE_ACCEPT}
              onChange={handleImageChange}
              className="text-sm"
            />
            {imagePreview ? (
              <img src={imagePreview} alt="" className="mt-2 h-24 w-24 rounded border object-cover" />
            ) : null}
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={isActive}
              onChange={(e) => setIsActive(e.target.checked)}
            />
            Active
          </label>
          <div className="rounded-lg border border-gray-200 p-3">
            <p className="text-sm font-medium text-gray-900">Services</p>
            <p className="text-xs text-gray-500 mb-2">{selectedLabel || 'No services selected'}</p>
            <div className="grid max-h-40 grid-cols-2 gap-2 overflow-auto md:grid-cols-3">
              {services.map((svc) => (
                <label key={svc.id} className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={serviceIds.includes(svc.id)}
                    onChange={() => toggleService(svc.id)}
                  />
                  {svc.name}
                </label>
              ))}
            </div>
          </div>
        </div>

        {error && (
          <div className="mt-4 rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">
            {error}
          </div>
        )}

        <div className="mt-6 flex items-center justify-end gap-2">
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
            disabled={submitting}
          >
            {submitting ? t('common.creating') : t('common.create')}
          </button>
        </div>
      </form>
    </div>
  )
}
