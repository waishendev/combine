'use client'

import { FormEvent, useEffect, useMemo, useState } from 'react'

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
      const response = await fetch('/api/proxy/ecommerce/seo-global', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          default_title: formState.default_title,
          default_description: formState.default_description,
          default_keywords: formState.default_keywords,
          default_og_image: formState.default_og_image || null,
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
    setFeedback(null)
  }

  const inputDisabled = !canEdit || saving

  return (
    <div className="bg-white border border-slate-200 rounded-2xl shadow-sm">
      <div className="border-b border-slate-200 px-6 py-4 flex items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-gray-500">SEO</p>
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
          <div className="grid grid-cols-1 gap-6">
            <div className="grid grid-cols-1 gap-2">
              <label className="text-sm font-medium text-slate-700" htmlFor="default_title">
                Default title
              </label>
              <input
                id="default_title"
                name="default_title"
                value={formState.default_title}
                onChange={(event) =>
                  setFormState((prev) => ({ ...prev, default_title: event.target.value }))
                }
                className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm shadow-sm focus:border-slate-400 focus:outline-none"
                placeholder="e.g. My Shop — Modern ecommerce"
                disabled={inputDisabled}
                required
              />
              <p className="text-xs text-slate-500">
                Appears as the base title for pages without a custom meta title.
              </p>
            </div>

            <div className="grid grid-cols-1 gap-2">
              <label className="text-sm font-medium text-slate-700" htmlFor="default_description">
                Default description
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
                className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm shadow-sm focus:border-slate-400 focus:outline-none min-h-[110px]"
                placeholder="Concise description that summarizes your storefront for search engines."
                disabled={inputDisabled}
                required
              />
              <p className="text-xs text-slate-500">
                Keep this between 140-160 characters for the best search snippet quality.
              </p>
            </div>

            <div className="grid grid-cols-1 gap-2">
              <label className="text-sm font-medium text-slate-700" htmlFor="default_keywords">
                Default keywords
              </label>
              <input
                id="default_keywords"
                name="default_keywords"
                value={formState.default_keywords}
                onChange={(event) =>
                  setFormState((prev) => ({ ...prev, default_keywords: event.target.value }))
                }
                className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm shadow-sm focus:border-slate-400 focus:outline-none"
                placeholder="myshop, ecommerce, shopping"
                disabled={inputDisabled}
              />
              <p className="text-xs text-slate-500">
                Comma-separated keywords that help describe your catalog and brand.
              </p>
            </div>

            <div className="grid grid-cols-1 gap-2">
              <label className="text-sm font-medium text-slate-700" htmlFor="default_og_image">
                Default Open Graph image URL
              </label>
              <input
                id="default_og_image"
                name="default_og_image"
                value={formState.default_og_image ?? ''}
                onChange={(event) =>
                  setFormState((prev) => ({ ...prev, default_og_image: event.target.value }))
                }
                className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm shadow-sm focus:border-slate-400 focus:outline-none"
                placeholder="/uploads/seo/default-og.jpg"
                disabled={inputDisabled}
              />
              <p className="text-xs text-slate-500">
                Used for social previews when a page does not have its own Open Graph image.
              </p>
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
