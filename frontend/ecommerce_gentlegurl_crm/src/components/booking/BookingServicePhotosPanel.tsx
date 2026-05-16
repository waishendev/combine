'use client'

import { useEffect, useMemo, useRef, useState } from 'react'

export type BookingServicePhoto = {
  id: number
  booking_id?: number | null
  image_path?: string | null
  image_url?: string | null
  caption?: string | null
  created_at?: string | null
  updated_at?: string | null
}

type Props = {
  bookingId?: number | null
  initialPhotos?: BookingServicePhoto[]
  title?: string
  compact?: boolean
  canManage?: boolean
  onChanged?: (photos: BookingServicePhoto[]) => void
}

const EMPTY_PHOTOS: BookingServicePhoto[] = []

function resolveImageUrl(imageUrl?: string | null, imagePath?: string | null) {
  if (imageUrl && /^https?:\/\//i.test(imageUrl)) return imageUrl
  if (imagePath && /^https?:\/\//i.test(imagePath)) return imagePath
  const path = (imageUrl || imagePath || '').trim()
  if (!path) return ''
  const normalized = path.startsWith('/') ? path : `/${path}`
  if (normalized.startsWith('/storage/')) return normalized
  return `/storage${normalized}`
}

function normalizeResponse(json: unknown): BookingServicePhoto[] {
  const data = (json && typeof json === 'object' && 'data' in json ? (json as { data?: unknown }).data : json) as { service_photos?: unknown } | null
  return Array.isArray(data?.service_photos) ? data.service_photos as BookingServicePhoto[] : []
}

function photosSignature(photos: BookingServicePhoto[] | undefined) {
  return (photos ?? EMPTY_PHOTOS)
    .map((photo) => [photo.id, photo.image_url ?? photo.image_path ?? '', photo.caption ?? '', photo.updated_at ?? photo.created_at ?? ''].join(':'))
    .join('|')
}

export default function BookingServicePhotosPanel({
  bookingId,
  initialPhotos,
  title = 'Salon Service Photos',
  compact = false,
  canManage = true,
  onChanged,
}: Props) {
  const inputRef = useRef<HTMLInputElement | null>(null)
  const onChangedRef = useRef<Props['onChanged']>(onChanged)
  const initialPhotoList = initialPhotos ?? EMPTY_PHOTOS
  const initialPhotoSignature = photosSignature(initialPhotos)
  const [photos, setPhotos] = useState<BookingServicePhoto[]>(initialPhotoList)
  const [caption, setCaption] = useState('')
  const [loading, setLoading] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [preview, setPreview] = useState<BookingServicePhoto | null>(null)

  useEffect(() => {
    onChangedRef.current = onChanged
  }, [onChanged])

  useEffect(() => {
    setPhotos((current) => (photosSignature(current) === initialPhotoSignature ? current : initialPhotoList))
    // Depend on primitive booking/signature only. Some callers create fallback arrays inline.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bookingId ?? null, initialPhotoSignature])

  useEffect(() => {
    if (!bookingId) return

    const controller = new AbortController()
    const load = async () => {
      setLoading(true)
      setError(null)
      try {
        const res = await fetch(`/api/proxy/admin/bookings/${bookingId}/service-photos`, {
          cache: 'no-store',
          signal: controller.signal,
        })
        const json = await res.json().catch(() => null)
        if (!res.ok) throw new Error(json?.message ?? 'Unable to load service photos.')
        const next = normalizeResponse(json)
        if (!controller.signal.aborted) {
          setPhotos((current) => (photosSignature(current) === photosSignature(next) ? current : next))
          onChangedRef.current?.(next)
        }
      } catch (err) {
        if (!controller.signal.aborted) {
          setError(err instanceof Error ? err.message : 'Unable to load service photos.')
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false)
      }
    }

    void load()

    return () => controller.abort()
  }, [bookingId])

  const resolvedPhotos = useMemo(
    () => photos.map((photo) => ({ ...photo, resolved_url: resolveImageUrl(photo.image_url, photo.image_path) })),
    [photos],
  )

  const upload = async (files: FileList | null) => {
    if (!bookingId || !files?.length) return
    const selected = Array.from(files)
    if (selected.some((file) => !['image/jpeg', 'image/png', 'image/webp'].includes(file.type))) {
      setError('Only JPG, PNG, or WEBP images are allowed.')
      return
    }
    const form = new FormData()
    selected.forEach((file) => form.append('photos[]', file))
    if (caption.trim()) form.append('caption', caption.trim())
    setBusy(true)
    setError(null)
    try {
      const res = await fetch(`/api/proxy/admin/bookings/${bookingId}/service-photos`, { method: 'POST', body: form })
      const json = await res.json().catch(() => null)
      if (!res.ok) throw new Error(json?.message ?? 'Unable to upload service photos.')
      const next = normalizeResponse(json)
      setPhotos(next)
      setCaption('')
      onChangedRef.current?.(next)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to upload service photos.')
    } finally {
      setBusy(false)
    }
  }

  const remove = async (photoId: number) => {
    if (!bookingId || busy) return
    setBusy(true)
    setError(null)
    try {
      const res = await fetch(`/api/proxy/admin/bookings/${bookingId}/service-photos/${photoId}`, { method: 'DELETE' })
      const json = await res.json().catch(() => null)
      if (!res.ok) throw new Error(json?.message ?? 'Unable to delete service photo.')
      const next = normalizeResponse(json)
      setPhotos(next)
      onChangedRef.current?.(next)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to delete service photo.')
    } finally {
      setBusy(false)
    }
  }

  if (!bookingId) return null

  return (
    <section className={`rounded-xl border border-slate-200 bg-white ${compact ? '' : 'shadow-sm'}`}>
      <div className="flex items-center justify-between gap-2 border-b border-slate-100 px-3 py-2">
        <h4 className="text-[11px] font-semibold uppercase tracking-wide text-slate-600">{title}</h4>
        {canManage ? (
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={busy || loading}
            className="rounded-md border border-blue-200 bg-blue-50 px-2 py-1 text-[11px] font-semibold text-blue-700 disabled:opacity-50"
          >
            {busy ? 'Uploading…' : 'Upload Photos'}
          </button>
        ) : null}
      </div>
      <div className="space-y-2 p-3">
        {canManage ? (
          <>
            <input ref={inputRef} type="file" accept="image/jpeg,image/png,image/webp" multiple className="sr-only" onChange={(event) => { void upload(event.currentTarget.files); event.currentTarget.value = '' }} />
            <input
              type="text"
              value={caption}
              onChange={(event) => setCaption(event.target.value)}
              placeholder="Optional caption for uploaded photos"
              className="w-full rounded-lg border border-slate-200 px-2 py-1.5 text-xs"
            />
          </>
        ) : null}
        {error ? <p className="rounded-md bg-rose-50 px-2 py-1 text-xs text-rose-700">{error}</p> : null}
        {loading ? <p className="py-2 text-center text-xs text-slate-500">Loading photos…</p> : null}
        {!loading && resolvedPhotos.length === 0 ? (
          <p className="py-2 text-center text-xs text-slate-500">No salon service photos yet.</p>
        ) : (
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
            {resolvedPhotos.map((photo, index) => (
              <div key={`service-photo-${photo.id}`} className="group relative overflow-hidden rounded-lg border border-slate-200 bg-slate-50">
                <button type="button" onClick={() => setPreview(photo)} className="block w-full">
                  {photo.resolved_url ? (
                    <img src={photo.resolved_url} alt={photo.caption || `Service photo ${index + 1}`} className="h-20 w-full object-cover" />
                  ) : (
                    <span className="flex h-20 items-center justify-center px-2 text-center text-[11px] text-slate-500">Image unavailable</span>
                  )}
                </button>
                {photo.caption ? <p className="truncate px-1.5 py-1 text-[10px] text-slate-600">{photo.caption}</p> : null}
                {canManage ? (
                  <button type="button" onClick={() => void remove(photo.id)} disabled={busy} className="absolute right-1 top-1 rounded bg-rose-600/90 px-1.5 py-0.5 text-[10px] font-bold text-white opacity-0 shadow transition group-hover:opacity-100 disabled:opacity-50">
                    Delete
                  </button>
                ) : null}
              </div>
            ))}
          </div>
        )}
      </div>
      {preview ? (
        <div className="fixed inset-0 z-[160] flex items-center justify-center bg-black/75 p-4" onClick={() => setPreview(null)}>
          <div className="max-w-4xl" onClick={(event) => event.stopPropagation()}>
            <img src={resolveImageUrl(preview.image_url, preview.image_path)} alt={preview.caption || 'Service photo preview'} className="max-h-[82vh] w-auto rounded-xl object-contain shadow-2xl" />
            {preview.caption ? <p className="mt-2 rounded-lg bg-white/90 px-3 py-2 text-center text-sm text-slate-800">{preview.caption}</p> : null}
          </div>
        </div>
      ) : null}
    </section>
  )
}
