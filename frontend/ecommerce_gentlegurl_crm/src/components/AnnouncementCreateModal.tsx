'use client'

import { ChangeEvent, FormEvent, useState } from 'react'

import type { AnnouncementRowData } from './AnnouncementRow'
import { mapAnnouncementApiItemToRow, type AnnouncementApiItem } from './announcementUtils'
import { useI18n } from '@/lib/i18n'

interface AnnouncementCreateModalProps {
  onClose: () => void
  onSuccess: (announcement: AnnouncementRowData) => void
}

interface FormState {
  key: string
  title: string
  subtitle: string
  bodyText: string
  buttonLabel: string
  buttonLink: string
  startAt: string
  endAt: string
  showOncePerSession: 'true' | 'false'
  imageFile: File | null
}

const initialFormState: FormState = {
  key: '',
  title: '',
  subtitle: '',
  bodyText: '',
  buttonLabel: '',
  buttonLink: '',
  startAt: '',
  endAt: '',
  showOncePerSession: 'true',
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

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    if (!form.key.trim() || !form.title.trim()) {
      setError(t('common.allFieldsRequired'))
      return
    }

    setSubmitting(true)
    setError(null)

    try {
      const formData = new FormData()
      formData.append('key', form.key.trim())
      formData.append('title', form.title.trim())
      formData.append('subtitle', form.subtitle.trim())
      formData.append('body_text', form.bodyText.trim())
      formData.append('button_label', form.buttonLabel.trim())
      formData.append('button_link', form.buttonLink.trim())
      formData.append('start_at', form.startAt)
      formData.append('end_at', form.endAt)
      formData.append('show_once_per_session', form.showOncePerSession)
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
            key: form.key.trim(),
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
            showOncePerSession: form.showOncePerSession === 'true',
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
      <div className="relative w-full max-w-2xl mx-auto bg-white rounded-lg shadow-lg max-h-[90vh] overflow-y-auto">
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

        <form onSubmit={handleSubmit} className="px-5 py-4 space-y-4">
          <div>
            <label
              htmlFor="key"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              Key <span className="text-red-500">*</span>
            </label>
            <input
              id="key"
              name="key"
              type="text"
              value={form.key}
              onChange={handleChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-blue-500 focus:border-blue-500"
              placeholder="welcome_banner"
              disabled={submitting}
              required
            />
          </div>

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

          <div>
            <label
              htmlFor="buttonLabel"
              className="block text-sm font-medium text-gray-700 mb-1"
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

          <div>
            <label
              htmlFor="buttonLink"
              className="block text-sm font-medium text-gray-700 mb-1"
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

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label
                htmlFor="startAt"
                className="block text-sm font-medium text-gray-700 mb-1"
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

            <div>
              <label
                htmlFor="endAt"
                className="block text-sm font-medium text-gray-700 mb-1"
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

          <div>
            <label
              htmlFor="showOncePerSession"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              Show Once Per Session
            </label>
            <select
              id="showOncePerSession"
              name="showOncePerSession"
              value={form.showOncePerSession}
              onChange={handleChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-blue-500 focus:border-blue-500"
              disabled={submitting}
            >
              <option value="true">True</option>
              <option value="false">False</option>
            </select>
          </div>

          <div>
            <label
              htmlFor="imageFile"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              Image File
            </label>
            <input
              id="imageFile"
              name="imageFile"
              type="file"
              accept="image/*"
              onChange={handleImageChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-blue-500 focus:border-blue-500"
              disabled={submitting}
            />
            {imagePreview && (
              <div className="mt-2">
                <img
                  src={imagePreview}
                  alt="Preview"
                  className="max-w-xs max-h-48 rounded border border-gray-300"
                />
              </div>
            )}
          </div>

          {error && (
            <div className="text-sm text-red-600" role="alert">
              {error}
            </div>
          )}

          <div className="flex items-center justify-end gap-3 pt-2">
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

