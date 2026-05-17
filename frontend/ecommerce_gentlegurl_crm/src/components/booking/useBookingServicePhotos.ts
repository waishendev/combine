'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import type { BookingServicePhoto } from '@/components/booking/BookingServicePhotosPanel'

const EMPTY_PHOTOS: BookingServicePhoto[] = []

export function resolveBookingServicePhotoUrl(imageUrl?: string | null, imagePath?: string | null) {
  if (imageUrl && /^https?:\/\//i.test(imageUrl)) return imageUrl
  if (imagePath && /^https?:\/\//i.test(imagePath)) return imagePath
  const path = (imageUrl || imagePath || '').trim()
  if (!path) return ''
  const normalized = path.startsWith('/') ? path : `/${path}`
  if (normalized.startsWith('/storage/')) return normalized
  return `/storage${normalized}`
}

export function normalizeBookingServicePhotosResponse(json: unknown): BookingServicePhoto[] {
  const data = (
    json && typeof json === 'object' && 'data' in json ? (json as { data?: unknown }).data : json
  ) as { service_photos?: unknown } | null
  return Array.isArray(data?.service_photos) ? (data.service_photos as BookingServicePhoto[]) : []
}

function photosSignature(photos: BookingServicePhoto[] | undefined) {
  return (photos ?? EMPTY_PHOTOS)
    .map((photo) =>
      [photo.id, photo.image_url ?? photo.image_path ?? '', photo.caption ?? '', photo.updated_at ?? photo.created_at ?? ''].join(
        ':',
      ),
    )
    .join('|')
}

type Options = {
  bookingId?: number | null
  initialPhotos?: BookingServicePhoto[]
  onChanged?: (photos: BookingServicePhoto[]) => void
}

export function useBookingServicePhotos({ bookingId, initialPhotos, onChanged }: Options) {
  const onChangedRef = useRef(onChanged)
  const initialPhotoList = initialPhotos ?? EMPTY_PHOTOS
  const initialPhotoSignature = photosSignature(initialPhotos)

  const [photos, setPhotos] = useState<BookingServicePhoto[]>(initialPhotoList)
  const [loading, setLoading] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    onChangedRef.current = onChanged
  }, [onChanged])

  useEffect(() => {
    setPhotos((current) => (photosSignature(current) === initialPhotoSignature ? current : initialPhotoList))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bookingId ?? null, initialPhotoSignature])

  const load = useCallback(async () => {
    if (!bookingId) return
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/proxy/admin/bookings/${bookingId}/service-photos`, { cache: 'no-store' })
      const json = await res.json().catch(() => null)
      if (!res.ok) throw new Error(json?.message ?? 'Unable to load service photos.')
      const next = normalizeBookingServicePhotosResponse(json)
      setPhotos((current) => (photosSignature(current) === photosSignature(next) ? current : next))
      onChangedRef.current?.(next)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load service photos.')
    } finally {
      setLoading(false)
    }
  }, [bookingId])

  useEffect(() => {
    if (!bookingId) return
    const controller = new AbortController()
    void (async () => {
      setLoading(true)
      setError(null)
      try {
        const res = await fetch(`/api/proxy/admin/bookings/${bookingId}/service-photos`, {
          cache: 'no-store',
          signal: controller.signal,
        })
        const json = await res.json().catch(() => null)
        if (!res.ok) throw new Error(json?.message ?? 'Unable to load service photos.')
        const next = normalizeBookingServicePhotosResponse(json)
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
    })()
    return () => controller.abort()
  }, [bookingId])

  const resolvedPhotos = useMemo(
    () =>
      photos.map((photo) => ({
        ...photo,
        resolved_url: resolveBookingServicePhotoUrl(photo.image_url, photo.image_path),
      })),
    [photos],
  )

  const uploadFiles = useCallback(
    async (files: File[], caption?: string) => {
      if (!bookingId || files.length === 0) return false
      if (files.some((file) => !['image/jpeg', 'image/png', 'image/webp'].includes(file.type))) {
        setError('Only JPG, PNG, or WEBP images are allowed.')
        return false
      }
      const form = new FormData()
      files.forEach((file) => form.append('photos[]', file))
      if (caption?.trim()) form.append('caption', caption.trim())
      setBusy(true)
      setError(null)
      try {
        const res = await fetch(`/api/proxy/admin/bookings/${bookingId}/service-photos`, {
          method: 'POST',
          body: form,
        })
        const json = await res.json().catch(() => null)
        if (!res.ok) throw new Error(json?.message ?? 'Unable to upload service photos.')
        const next = normalizeBookingServicePhotosResponse(json)
        setPhotos(next)
        onChangedRef.current?.(next)
        return true
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unable to upload service photos.')
        return false
      } finally {
        setBusy(false)
      }
    },
    [bookingId],
  )

  const removePhoto = useCallback(
    async (photoId: number) => {
      if (!bookingId || busy) return false
      setBusy(true)
      setError(null)
      try {
        const res = await fetch(`/api/proxy/admin/bookings/${bookingId}/service-photos/${photoId}`, {
          method: 'DELETE',
        })
        const json = await res.json().catch(() => null)
        if (!res.ok) throw new Error(json?.message ?? 'Unable to delete service photo.')
        const next = normalizeBookingServicePhotosResponse(json)
        setPhotos(next)
        onChangedRef.current?.(next)
        return true
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unable to delete service photo.')
        return false
      } finally {
        setBusy(false)
      }
    },
    [bookingId, busy],
  )

  return {
    photos,
    resolvedPhotos,
    loading,
    busy,
    error,
    setError,
    load,
    uploadFiles,
    removePhoto,
  }
}
