'use client'

import { ChangeEvent, FormEvent, useState } from 'react'

import type { MarqueeRowData } from './MarqueeRow'
import { mapMarqueeApiItemToRow, type MarqueeApiItem } from './marqueeUtils'
import { useI18n } from '@/lib/i18n'

interface MarqueeCreateModalProps {
  onClose: () => void
  onSuccess: (marquee: MarqueeRowData) => void
}

interface FormState {
  text: string
  startAt: string
  endAt: string
}

const initialFormState: FormState = {
  text: '',
  startAt: '',
  endAt: '',
}

export default function MarqueeCreateModal({
  onClose,
  onSuccess,
}: MarqueeCreateModalProps) {
  const { t } = useI18n()
  const [form, setForm] = useState<FormState>({ ...initialFormState })
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleChange = (
    event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
  ) => {
    const { name, value } = event.target
    setForm((prev) => ({ ...prev, [name]: value }))
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    if (!form.text.trim() || !form.startAt || !form.endAt) {
      setError(t('common.allFieldsRequired'))
      return
    }

    setSubmitting(true)
    setError(null)

    try {
      const res = await fetch('/api/proxy/ecommerce/marquees', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({
          text: form.text.trim(),
          start_at: form.startAt,
          end_at: form.endAt,
          is_active: 1, // Automatically pass as 1
        }),
      })

      const data = await res.json().catch(() => null)

      if (!res.ok) {
        let message = 'Failed to create marquee'
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
          ? ((data as { data?: MarqueeApiItem | null }).data ?? null)
          : null

      const marqueeRow: MarqueeRowData = payload
        ? mapMarqueeApiItemToRow(payload)
        : {
            id: 0,
            text: form.text.trim(),
            startAt: form.startAt,
            endAt: form.endAt,
            isActive: true,
            sortOrder: null,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          }

      setForm({ ...initialFormState })
      onSuccess(marqueeRow)
    } catch (err) {
      console.error(err)
      setError('Failed to create marquee')
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
      <div className="relative w-full max-w-lg mx-auto bg-white rounded-lg shadow-lg">
        <div className="flex items-center justify-between border-b border-gray-300 px-5 py-4">
          <h2 className="text-lg font-semibold">Create Marquee</h2>
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
              htmlFor="text"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              Text <span className="text-red-500">*</span>
            </label>
            <textarea
              id="text"
              name="text"
              value={form.text}
              onChange={handleChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-blue-500 focus:border-blue-500"
              placeholder="Special promotion! Get 20% off on all products today!"
              disabled={submitting}
              rows={3}
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label
                htmlFor="startAt"
                className="block text-sm font-medium text-gray-700 mb-1"
              >
                Start Date <span className="text-red-500">*</span>
              </label>
              <input
                id="startAt"
                name="startAt"
                type="date"
                value={form.startAt}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-blue-500 focus:border-blue-500"
                disabled={submitting}
                required
              />
            </div>

            <div>
              <label
                htmlFor="endAt"
                className="block text-sm font-medium text-gray-700 mb-1"
              >
                End Date <span className="text-red-500">*</span>
              </label>
              <input
                id="endAt"
                name="endAt"
                type="date"
                value={form.endAt}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-blue-500 focus:border-blue-500"
                disabled={submitting}
                required
              />
            </div>
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

