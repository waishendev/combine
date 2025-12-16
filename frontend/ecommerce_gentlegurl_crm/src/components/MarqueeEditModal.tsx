'use client'

import { ChangeEvent, FormEvent, useEffect, useState } from 'react'

import type { MarqueeRowData } from './MarqueeRow'
import { mapMarqueeApiItemToRow, type MarqueeApiItem } from './marqueeUtils'
import { useI18n } from '@/lib/i18n'

interface MarqueeEditModalProps {
  marqueeId: number
  onClose: () => void
  onSuccess: (marquee: MarqueeRowData) => void
}

interface FormState {
  text: string
  startAt: string
  endAt: string
  isActive: 'active' | 'inactive'
}

const initialFormState: FormState = {
  text: '',
  startAt: '',
  endAt: '',
  isActive: 'active',
}

export default function MarqueeEditModal({
  marqueeId,
  onClose,
  onSuccess,
}: MarqueeEditModalProps) {
  const { t } = useI18n()
  const [form, setForm] = useState<FormState>({ ...initialFormState })
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loadedMarquee, setLoadedMarquee] = useState<MarqueeRowData | null>(null)

  useEffect(() => {
    const controller = new AbortController()

    const loadMarquee = async () => {
      setLoading(true)
      setError(null)
      try {
        const res = await fetch(`/api/proxy/ecommerce/marquees/${marqueeId}`, {
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
          setError('Failed to load marquee')
          return
        }

        const marquee = data?.data as MarqueeApiItem | undefined
        if (!marquee || typeof marquee !== 'object') {
          setError('Failed to load marquee')
          return
        }

        const mappedMarquee = mapMarqueeApiItemToRow(marquee)
        setLoadedMarquee(mappedMarquee)

        // Format dates for date input (YYYY-MM-DD)
        const formatDateForInput = (dateStr: string | null | undefined): string => {
          if (!dateStr || dateStr === '-') return ''
          try {
            const date = new Date(dateStr)
            return date.toISOString().split('T')[0]
          } catch {
            return ''
          }
        }

        setForm({
          text: typeof marquee.text === 'string' ? marquee.text : '',
          startAt: formatDateForInput(marquee.start_at),
          endAt: formatDateForInput(marquee.end_at),
          isActive:
            marquee.is_active === true || marquee.is_active === 'true' || marquee.is_active === 1
              ? 'active'
              : 'inactive',
        })
      } catch (err) {
        if (!(err instanceof DOMException && err.name === 'AbortError')) {
          setError('Failed to load marquee')
        }
      } finally {
        setLoading(false)
      }
    }

    loadMarquee().catch(() => {
      setLoading(false)
      setError('Failed to load marquee')
    })

    return () => controller.abort()
  }, [marqueeId])

  const handleChange = (
    event: ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>,
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
      const payload: Record<string, unknown> = {
        text: form.text.trim(),
        start_at: form.startAt,
        end_at: form.endAt,
        is_active: form.isActive === 'active' ? 1 : 0,
      }

      const res = await fetch(`/api/proxy/ecommerce/marquees/${marqueeId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          'Accept-Language': 'en',
        },
        body: JSON.stringify(payload),
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
        setError('Failed to update marquee')
        return
      }

      const payloadData =
        data && typeof data === 'object' && 'data' in data
          ? ((data as { data?: MarqueeApiItem | null }).data ?? null)
          : null

      const marqueeRow: MarqueeRowData = payloadData
        ? mapMarqueeApiItemToRow(payloadData)
        : {
            id: loadedMarquee?.id ?? marqueeId,
            text: form.text.trim(),
            startAt: form.startAt,
            endAt: form.endAt,
            isActive: form.isActive === 'active',
            sortOrder: loadedMarquee?.sortOrder ?? null,
            createdAt: loadedMarquee?.createdAt ?? '',
            updatedAt: new Date().toISOString(),
          }

      setLoadedMarquee(marqueeRow)
      onSuccess(marqueeRow)
    } catch (err) {
      console.error(err)
      setError('Failed to update marquee')
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
      <div className="relative w-full max-w-lg mx-auto bg-white rounded-lg shadow-lg">
        <div className="flex items-center justify-between border-b border-gray-300 px-5 py-4">
          <h2 className="text-lg font-semibold">Edit Marquee</h2>
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
          {loading ? (
            <div className="py-8 text-center text-sm text-gray-500">{t('common.loadingDetails')}</div>
          ) : (
            <>
              <div>
                <label
                  htmlFor="edit-text"
                  className="block text-sm font-medium text-gray-700 mb-1"
                >
                  Text <span className="text-red-500">*</span>
                </label>
                <textarea
                  id="edit-text"
                  name="text"
                  value={form.text}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Special promotion! Get 20% off on all products today!"
                  disabled={disableForm}
                  rows={3}
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label
                    htmlFor="edit-startAt"
                    className="block text-sm font-medium text-gray-700 mb-1"
                  >
                    Start Date <span className="text-red-500">*</span>
                  </label>
                  <input
                    id="edit-startAt"
                    name="startAt"
                    type="date"
                    value={form.startAt}
                    onChange={handleChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-blue-500 focus:border-blue-500"
                    disabled={disableForm}
                    required
                  />
                </div>

                <div>
                  <label
                    htmlFor="edit-endAt"
                    className="block text-sm font-medium text-gray-700 mb-1"
                  >
                    End Date <span className="text-red-500">*</span>
                  </label>
                  <input
                    id="edit-endAt"
                    name="endAt"
                    type="date"
                    value={form.endAt}
                    onChange={handleChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-blue-500 focus:border-blue-500"
                    disabled={disableForm}
                    required
                  />
                </div>
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
            </>
          )}

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

