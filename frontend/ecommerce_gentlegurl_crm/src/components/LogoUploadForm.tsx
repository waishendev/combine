'use client'

import { ChangeEvent, FormEvent, useEffect, useMemo, useRef, useState } from 'react'

import { IMAGE_ACCEPT } from './mediaAccept'

type BrandingPayload = {
  shop_logo_url?: string | null
  crm_logo_url?: string | null
  shop_favicon_url?: string | null
  crm_favicon_url?: string | null
}

type BrandingResponse = {
  data?: BrandingPayload | null
  message?: string | null
  success?: boolean
}

type FeedbackState = {
  type: 'success' | 'error'
  message: string
}

type LogoUploadFormProps = {
  canEdit: boolean
  title: string
  description: string
  logoKey: 'shop_logo_url' | 'crm_logo_url' | 'shop_favicon_url' | 'crm_favicon_url'
  uploadEndpoint: string
  helperText?: string
  recommendation?: string
  fileLabel?: string
  previewAlt?: string
  accept?: string
}

export default function LogoUploadForm({
  canEdit,
  title,
  description,
  logoKey,
  uploadEndpoint,
  helperText,
  recommendation,
  fileLabel,
  previewAlt,
  accept,
}: LogoUploadFormProps) {
  const [logoUrl, setLogoUrl] = useState<string | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [logoFile, setLogoFile] = useState<File | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [feedback, setFeedback] = useState<FeedbackState | null>(null)
  const inputRef = useRef<HTMLInputElement | null>(null)
  const storageKey = `branding.${logoKey}`

  const currentLogo = previewUrl ?? logoUrl

  const resolvedHelperText = useMemo(() => {
    if (helperText) {
      return helperText
    }

    if (logoKey === 'shop_logo_url') {
      return 'Upload a storefront logo that appears on the Ecommerce Shop header.'
    }
    if (logoKey === 'shop_favicon_url' || logoKey === 'crm_favicon_url') {
      return 'Upload a favicon used in browser tabs and bookmarks.'
    }
    return 'Upload a CRM logo that appears in the admin header.'
  }, [helperText, logoKey])

  const recommendationText = useMemo(() => {
    if (recommendation) {
      return recommendation
    }

    if (logoKey === 'shop_favicon_url' || logoKey === 'crm_favicon_url') {
      return 'Recommended size: 64x64px or 128x128px. Only PNG or ICO is supported.'
    }

    return 'Recommended size: 240x80px. PNG or WebP with transparent background looks best.'
  }, [logoKey, recommendation])

  useEffect(() => {
    let abort = false
    const controller = new AbortController()

    const fetchBranding = async () => {
      try {
        if (typeof window !== 'undefined') {
          const cachedLogo = window.sessionStorage.getItem(storageKey)
          if (cachedLogo) {
            setLogoUrl(cachedLogo)
          }
        }
        const response = await fetch('/api/proxy/ecommerce/branding', {
          cache: 'no-store',
          signal: controller.signal,
        })

        if (!response.ok) {
          throw new Error('Failed to load current logo.')
        }

        const payload: BrandingResponse = await response.json()
        const logoValue = payload?.data?.[logoKey] ?? null

        if (!abort) {
          setLogoUrl(logoValue)
          setPreviewUrl(null)
          setFeedback(null)
        }
      } catch (error) {
        if (!abort) {
          setFeedback({
            type: 'error',
            message:
              error instanceof Error
                ? error.message
                : 'Unable to fetch the current logo.',
          })
        }
      } finally {
        if (!abort) {
          setLoading(false)
        }
      }
    }

    fetchBranding()

    return () => {
      abort = true
      controller.abort()
    }
  }, [logoKey])

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    setLogoFile(file)
    const reader = new FileReader()
    reader.onload = () => {
      setPreviewUrl(reader.result as string)
    }
    reader.readAsDataURL(file)
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!canEdit || !logoFile) {
      setFeedback({
        type: 'error',
        message: 'Please choose a logo file to upload.',
      })
      return
    }

    setSaving(true)
    setFeedback(null)

    try {
      const formData = new FormData()
      formData.append('logo_file', logoFile)

      const response = await fetch(uploadEndpoint, {
        method: 'POST',
        body: formData,
      })

      const payload: BrandingResponse & {
        errors?: Record<string, string[] | string>
      } = await response.json().catch(() => ({
        success: false,
        message: 'Unable to parse response from server.',
      }))

      if (!response.ok || payload?.success === false) {
        // Check for validation errors
        if (payload?.errors && typeof payload.errors === 'object') {
          const errorMessages: string[] = []
          
          // Iterate through all error fields
          for (const [field, messages] of Object.entries(payload.errors)) {
            if (Array.isArray(messages)) {
              // If it's an array of messages, add all of them
              errorMessages.push(...messages)
            } else if (typeof messages === 'string') {
              // If it's a single string, add it
              errorMessages.push(messages)
            }
          }
          
          // Join all error messages with newlines or show the first one
          const errorMessage = errorMessages.length > 0
            ? errorMessages.join('\n')
            : payload?.message || 'Failed to upload logo.'
          
          throw new Error(errorMessage)
        }
        
        throw new Error(payload?.message || 'Failed to upload logo.')
      }

      const updatedLogo = payload?.data?.[logoKey] ?? null
      setLogoUrl(updatedLogo)
      setPreviewUrl(null)
      setLogoFile(null)
      if (inputRef.current) {
        inputRef.current.value = ''
      }

      setFeedback({
        type: 'success',
        message: payload?.message || 'Logo updated successfully.',
      })
      if (typeof window !== 'undefined' && updatedLogo) {
        window.sessionStorage.setItem(storageKey, updatedLogo)
      }
      if (typeof window !== 'undefined') {
        window.dispatchEvent(
          new CustomEvent('branding:updated', {
            detail: {
              logoKey,
              logoUrl: updatedLogo,
            },
          })
        )
      }
    } catch (error) {
      setFeedback({
        type: 'error',
        message:
          error instanceof Error
            ? error.message
            : 'Unable to update the logo right now.',
      })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="text-xl font-semibold text-slate-900">{title}</h3>
          <p className="mt-2 text-sm text-slate-500">{description}</p>
          <p className="mt-3 text-xs text-slate-400">{resolvedHelperText}</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="mt-6 space-y-6">
        <div className="grid gap-4 md:grid-cols-[220px_1fr]">
          <div className="flex h-36 w-36 items-center justify-center overflow-hidden rounded-2xl border border-dashed border-slate-200 bg-slate-50">
            {currentLogo ? (
              <img
                src={currentLogo}
                alt={previewAlt ?? 'Logo preview'}
                className="h-full w-full object-contain"
              />
            ) : (
              <div className="text-center text-xs text-slate-400">
                No logo uploaded yet
              </div>
            )}
          </div>

          <div className="space-y-3">
            <label className="block text-sm font-medium text-slate-700">
              {fileLabel ?? 'Upload new logo'}
            </label>
            <input
              ref={inputRef}
              type="file"
              accept={accept ?? IMAGE_ACCEPT}
              onChange={handleFileChange}
              disabled={!canEdit}
              className="block w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-600 file:mr-4 file:rounded-lg file:border-0 file:bg-slate-100 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-slate-700 hover:file:bg-slate-200"
            />
            <p className="text-xs text-slate-400">{recommendationText}</p>
          </div>
        </div>

        {feedback && (
          <div
            className={`rounded-lg px-4 py-3 text-sm ${
              feedback.type === 'success'
                ? 'border border-green-200 bg-green-50 text-green-700'
                : 'border border-red-200 bg-red-50 text-red-700'
            }`}
          >
            <div className="whitespace-pre-line">{feedback.message}</div>
          </div>
        )}

        <div className="flex items-center gap-3">
          <button
            type="submit"
            disabled={!canEdit || saving || loading}
            className={`inline-flex items-center justify-center rounded-lg px-5 py-2 text-sm font-semibold text-white transition ${
              !canEdit || saving || loading
                ? 'cursor-not-allowed bg-slate-300'
                : 'bg-slate-900 hover:bg-slate-800'
            }`}
          >
            {saving ? 'Uploading...' : 'Save Logo'}
          </button>
          {loading && <span className="text-xs text-slate-400">Loading...</span>}
        </div>
      </form>
    </div>
  )
}
