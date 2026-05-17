'use client'

import { useEffect, useRef, useState } from 'react'

import type { BookingServicePhoto } from '@/components/booking/BookingServicePhotosPanel'
import {
  resolveBookingServicePhotoUrl,
  useBookingServicePhotos,
} from '@/components/booking/useBookingServicePhotos'

type PendingUpload = {
  id: string
  file: File
  preview: string
}

type ModalStep = 'gallery' | 'upload'

type Props = {
  bookingId?: number | null
  bookingCode?: string | null
  initialPhotos?: BookingServicePhoto[]
  onChanged?: (photos: BookingServicePhoto[]) => void
  className?: string
  /** When false, gallery is view-only (no upload / delete). */
  canManage?: boolean
  /** Compact centered button for side-by-side grids (e.g. appointment settlement). */
  layout?: 'default' | 'tile'
  buttonLabel?: string
}

const IMAGE_ACCEPT = 'image/jpeg,image/png,image/webp'

function PhotoTile({
  src,
  alt,
  onView,
  onRemove,
  removeLabel,
  disabled,
  showRemove = true,
}: {
  src: string
  alt: string
  onView: () => void
  onRemove: () => void
  removeLabel: string
  disabled?: boolean
  showRemove?: boolean
}) {
  return (
    <div className="group relative aspect-square overflow-hidden rounded-2xl bg-stone-100 ring-1 ring-stone-200/80 shadow-sm">
      <button type="button" onClick={onView} className="block h-full w-full">
        {src ? (
          <img src={src} alt={alt} className="h-full w-full object-cover transition duration-200 group-hover:scale-[1.02]" />
        ) : (
          <span className="flex h-full items-center justify-center px-2 text-center text-xs text-stone-500">
            Preview unavailable
          </span>
        )}
      </button>
      {showRemove ? (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            onRemove()
          }}
          disabled={disabled}
          aria-label={removeLabel}
          className="absolute right-1.5 top-1.5 flex h-7 w-7 items-center justify-center rounded-full bg-stone-900/55 text-white backdrop-blur-sm transition hover:bg-rose-600 disabled:opacity-40"
        >
          <i className="fa-solid fa-xmark text-xs" aria-hidden />
        </button>
      ) : null}
    </div>
  )
}

export default function BookingServicePhotosModal({
  bookingId,
  bookingCode,
  initialPhotos,
  onChanged,
  className = '',
  canManage = true,
  layout = 'default',
  buttonLabel = 'Service photos',
}: Props) {
  const isTile = layout === 'tile'
  const inputRef = useRef<HTMLInputElement | null>(null)
  const [open, setOpen] = useState(false)
  const [step, setStep] = useState<ModalStep>('gallery')
  const [caption, setCaption] = useState('')
  const [pendingUploads, setPendingUploads] = useState<PendingUpload[]>([])
  const [preview, setPreview] = useState<BookingServicePhoto | null>(null)
  const [pendingPreviewUrl, setPendingPreviewUrl] = useState<string | null>(null)

  const { resolvedPhotos, loading, busy, error, setError, load, uploadFiles, removePhoto } =
    useBookingServicePhotos({
      bookingId,
      initialPhotos,
      onChanged,
    })

  useEffect(() => {
    if (!open) return
    void load()
  }, [load, open])

  useEffect(() => {
    return () => {
      pendingUploads.forEach((item) => URL.revokeObjectURL(item.preview))
    }
  }, [pendingUploads])

  const clearPending = () => {
    pendingUploads.forEach((item) => URL.revokeObjectURL(item.preview))
    setPendingUploads([])
  }

  const resetUploadDraft = () => {
    clearPending()
    setCaption('')
    setPendingPreviewUrl(null)
  }

  const closeModal = () => {
    setOpen(false)
    setStep('gallery')
    setPreview(null)
    resetUploadDraft()
    setError(null)
  }

  const openUploadStep = () => {
    if (!canManage) return
    resetUploadDraft()
    setError(null)
    setStep('upload')
  }

  const backToGallery = () => {
    if (busy) return
    resetUploadDraft()
    setError(null)
    setStep('gallery')
  }

  const onPickFiles = (files: FileList | null) => {
    if (!files?.length) return
    const selected = Array.from(files)
    if (selected.some((file) => !['image/jpeg', 'image/png', 'image/webp'].includes(file.type))) {
      setError('Please choose JPG, PNG, or WEBP images only.')
      return
    }
    setError(null)
    setPendingUploads((prev) => [
      ...prev,
      ...selected.map((file) => ({
        id: crypto.randomUUID(),
        file,
        preview: URL.createObjectURL(file),
      })),
    ])
  }

  const removePending = (id: string) => {
    setPendingUploads((prev) => {
      const target = prev.find((item) => item.id === id)
      if (target?.preview) URL.revokeObjectURL(target.preview)
      return prev.filter((item) => item.id !== id)
    })
  }

  const submitPending = async () => {
    if (pendingUploads.length === 0) return
    const ok = await uploadFiles(
      pendingUploads.map((item) => item.file),
      caption,
    )
    if (ok) {
      resetUploadDraft()
      setError(null)
      setStep('gallery')
    }
  }

  if (!bookingId) return null

  const photoCount = resolvedPhotos.length
  const isGallery = step === 'gallery'
  const isUpload = step === 'upload'

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={
          isTile
            ? `group flex w-full min-h-[5.5rem] flex-col items-center justify-center gap-2 rounded-xl border border-cyan-200/80 bg-gradient-to-b from-white to-cyan-50/60 px-2 py-3 text-center shadow-sm transition hover:border-cyan-300 hover:shadow-md ${className}`
            : `group flex w-full items-center gap-3 rounded-xl border border-cyan-200/80 bg-gradient-to-r from-white to-cyan-50/50 px-3.5 py-2.5 text-left shadow-sm transition hover:border-cyan-300 hover:shadow-md ${className}`
        }
      >
        <span
          className={
            isTile
              ? 'flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-cyan-100 text-cyan-700 transition group-hover:bg-cyan-200/80'
              : 'flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-cyan-100 text-cyan-700 transition group-hover:bg-cyan-200/80'
          }
        >
          <i className="fa-solid fa-camera text-base" aria-hidden />
        </span>
        {isTile ? (
          <>
            <span className="px-1 text-[10px] font-bold uppercase leading-snug tracking-wide text-stone-800 sm:text-[11px]">
              {buttonLabel}
            </span>
            {photoCount > 0 ? (
              <span className="rounded-full bg-cyan-600 px-2 py-0.5 text-[10px] font-bold text-white tabular-nums">
                {photoCount}
              </span>
            ) : (
              <span className="text-[10px] text-stone-500">Add photos</span>
            )}
          </>
        ) : (
          <>
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-semibold text-stone-800">{buttonLabel}</span>
              <span className="block text-xs text-stone-500">
                {photoCount > 0
                  ? `${photoCount} photo${photoCount === 1 ? '' : 's'} saved · tap to view or add more`
                  : 'Add photos from this visit'}
              </span>
            </span>
            {photoCount > 0 ? (
              <span className="shrink-0 rounded-full bg-cyan-600 px-2.5 py-1 text-xs font-bold text-white tabular-nums">
                {photoCount}
              </span>
            ) : (
              <span className="shrink-0 text-cyan-600 opacity-70 transition group-hover:translate-x-0.5" aria-hidden>
                <i className="fa-solid fa-chevron-right text-sm" />
              </span>
            )}
          </>
        )}
      </button>

      {open ? (
        <div
          className="fixed inset-0 z-[170] flex items-end justify-center bg-stone-900/40 p-0 backdrop-blur-[2px] sm:items-center sm:p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="salon-service-photos-title"
          onClick={closeModal}
        >
          <div
            className="flex max-h-[92vh] w-full max-w-lg flex-col overflow-hidden rounded-t-3xl bg-[#faf9f7] shadow-2xl sm:max-h-[88vh] sm:rounded-3xl"
            onClick={(event) => event.stopPropagation()}
          >
            {/* —— Step 1: Gallery —— */}
            {isGallery ? (
              <>
                <div className="relative overflow-hidden px-5 pb-4 pt-5">
                  <div
                    className="pointer-events-none absolute inset-0 bg-gradient-to-br from-cyan-100/90 via-rose-50/50 to-amber-50/40"
                    aria-hidden
                  />
                  <div className="relative flex items-start gap-3">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white/80 text-cyan-700 shadow-sm ring-1 ring-white/60">
                      <i className="fa-solid fa-spa text-lg" aria-hidden />
                    </div>
                    <div className="min-w-0 flex-1 pr-8">
                      <h3 id="salon-service-photos-title" className="text-lg font-semibold tracking-tight text-stone-800">
                        Service photos
                      </h3>
                      <p className="mt-0.5 text-sm text-stone-600">Photos saved for this appointment.</p>
                      {bookingCode ? (
                        <span className="mt-2 inline-flex items-center rounded-full bg-white/70 px-2.5 py-0.5 text-xs font-medium text-stone-600 ring-1 ring-stone-200/60">
                          {bookingCode}
                        </span>
                      ) : null}
                    </div>
                    <button
                      type="button"
                      onClick={closeModal}
                      className="absolute right-0 top-0 flex h-9 w-9 items-center justify-center rounded-full bg-white/80 text-stone-500 shadow-sm ring-1 ring-stone-200/60 transition hover:bg-white hover:text-stone-800"
                      aria-label="Close"
                    >
                      <i className="fa-solid fa-xmark" aria-hidden />
                    </button>
                  </div>
                </div>

                <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-2">
                  {error ? (
                    <div className="mb-4 flex gap-2 rounded-2xl border border-rose-200 bg-rose-50 px-3.5 py-3 text-sm text-rose-800">
                      <i className="fa-solid fa-circle-exclamation mt-0.5 shrink-0 text-rose-500" aria-hidden />
                      <p>{error}</p>
                    </div>
                  ) : null}

                  {loading ? (
                    <div className="flex flex-col items-center justify-center py-14 text-stone-500">
                      <div className="mb-3 h-9 w-9 animate-spin rounded-full border-2 border-cyan-200 border-t-cyan-600" />
                      <p className="text-sm">Loading photos…</p>
                    </div>
                  ) : photoCount > 0 ? (
                    <section>
                      <h4 className="mb-3 text-sm font-semibold text-stone-800">
                        Saved for this visit
                        <span className="ml-1.5 font-normal text-stone-500">({photoCount})</span>
                      </h4>
                      <div className="grid grid-cols-3 gap-2.5">
                        {resolvedPhotos.map((photo, index) => (
                          <div key={`service-photo-${photo.id}`} className="space-y-1">
                            <PhotoTile
                              src={photo.resolved_url}
                              alt={photo.caption || `Service photo ${index + 1}`}
                              disabled={busy}
                              showRemove={canManage}
                              removeLabel="Delete photo"
                              onView={() => setPreview(photo)}
                              onRemove={() => void removePhoto(photo.id)}
                            />
                            {photo.caption ? (
                              <p className="truncate px-0.5 text-[11px] text-stone-500">{photo.caption}</p>
                            ) : null}
                          </div>
                        ))}
                      </div>
                    </section>
                  ) : (
                    <div className="flex flex-col items-center justify-center rounded-2xl border border-stone-200/80 bg-white px-6 py-12 text-center">
                      <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-cyan-100 to-rose-100 text-cyan-700">
                        <i className="fa-regular fa-image text-2xl" aria-hidden />
                      </div>
                      <p className="text-sm font-semibold text-stone-800">No photos yet</p>
                      <p className="mt-1 max-w-[240px] text-xs leading-relaxed text-stone-500">
                        {canManage
                          ? 'Tap Upload Photo below to add pictures from this service.'
                          : 'No salon service photos have been saved for this visit yet.'}
                      </p>
                    </div>
                  )}
                </div>

                <div className="space-y-2 border-t border-stone-200/80 bg-white/60 px-5 py-4">
                  {canManage ? (
                    <button
                      type="button"
                      onClick={openUploadStep}
                      disabled={loading}
                      className="flex w-full items-center justify-center gap-2 rounded-xl bg-cyan-600 py-3 text-sm font-semibold text-white shadow-md transition hover:bg-cyan-700 disabled:opacity-50"
                    >
                      <i className="fa-solid fa-cloud-arrow-up" aria-hidden />
                      Upload Photo
                    </button>
                  ) : null}
                  <button
                    type="button"
                    onClick={closeModal}
                    className="w-full rounded-xl border border-stone-200 bg-white py-2.5 text-sm font-medium text-stone-600 transition hover:bg-stone-50"
                  >
                    Done
                  </button>
                </div>
              </>
            ) : null}

            {/* —— Step 2: Upload (nested screen) —— */}
            {isUpload ? (
              <>
                <div className="border-b border-stone-200/80 bg-white/50 px-5 py-4">
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={backToGallery}
                      disabled={busy}
                      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-stone-200 bg-white text-stone-600 transition hover:bg-stone-50 disabled:opacity-50"
                      aria-label="Back to gallery"
                    >
                      <i className="fa-solid fa-arrow-left text-sm" aria-hidden />
                    </button>
                    <div className="min-w-0 flex-1">
                      <h3 className="text-lg font-semibold text-stone-800">Upload photos</h3>
                      <p className="text-xs text-stone-500">Choose images, then tap Upload to save.</p>
                    </div>
                    <button
                      type="button"
                      onClick={closeModal}
                      disabled={busy}
                      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-stone-400 transition hover:bg-stone-100 hover:text-stone-700 disabled:opacity-50"
                      aria-label="Close"
                    >
                      <i className="fa-solid fa-xmark" aria-hidden />
                    </button>
                  </div>
                </div>

                <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
                  {error ? (
                    <div className="mb-4 flex gap-2 rounded-2xl border border-rose-200 bg-rose-50 px-3.5 py-3 text-sm text-rose-800">
                      <i className="fa-solid fa-circle-exclamation mt-0.5 shrink-0 text-rose-500" aria-hidden />
                      <p>{error}</p>
                    </div>
                  ) : null}

                  <input
                    ref={inputRef}
                    type="file"
                    accept={IMAGE_ACCEPT}
                    multiple
                    className="sr-only"
                    onChange={(event) => {
                      onPickFiles(event.currentTarget.files)
                      event.currentTarget.value = ''
                    }}
                  />

                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => inputRef.current?.click()}
                    className="mb-4 flex w-full flex-col items-center justify-center rounded-2xl border-2 border-dashed border-cyan-300/90 bg-white px-4 py-10 text-center transition hover:border-cyan-500 hover:bg-cyan-50/40 disabled:opacity-50"
                  >
                    <span className="mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-cyan-100 text-cyan-700">
                      <i className="fa-solid fa-plus text-xl" aria-hidden />
                    </span>
                    <span className="text-sm font-semibold text-stone-800">Choose photos</span>
                    <span className="mt-1 text-xs text-stone-500">JPG, PNG or WEBP · multiple allowed</span>
                  </button>

                  {pendingUploads.length > 0 ? (
                    <div className="space-y-4">
                      <p className="text-xs font-medium text-stone-600">
                        {pendingUploads.length} photo{pendingUploads.length === 1 ? '' : 's'} selected
                      </p>
                      <div className="grid grid-cols-3 gap-2.5">
                        {pendingUploads.map((item, index) => (
                          <PhotoTile
                            key={item.id}
                            src={item.preview}
                            alt={`Selected photo ${index + 1}`}
                            disabled={busy}
                            removeLabel="Remove photo"
                            onView={() => setPendingPreviewUrl(item.preview)}
                            onRemove={() => removePending(item.id)}
                          />
                        ))}
                      </div>
                      <label className="block">
                        <span className="mb-1 block text-xs font-medium text-stone-700">Note (optional)</span>
                        <input
                          type="text"
                          value={caption}
                          onChange={(event) => setCaption(event.target.value)}
                          placeholder="e.g. Before / after, colour reference…"
                          className="w-full rounded-xl border border-stone-200 bg-white px-3 py-2.5 text-sm text-stone-800 placeholder:text-stone-400 focus:border-cyan-400 focus:outline-none focus:ring-2 focus:ring-cyan-200/50"
                          disabled={busy}
                        />
                      </label>
                    </div>
                  ) : (
                    <p className="text-center text-xs text-stone-400">No photos selected yet.</p>
                  )}
                </div>

                <div className="space-y-2 border-t border-stone-200/80 bg-white/60 px-5 py-4">
                  <button
                    type="button"
                    onClick={() => void submitPending()}
                    disabled={busy || pendingUploads.length === 0}
                    className="flex w-full items-center justify-center gap-2 rounded-xl bg-cyan-600 py-3 text-sm font-semibold text-white shadow-md transition hover:bg-cyan-700 disabled:cursor-not-allowed disabled:opacity-45"
                  >
                    {busy ? (
                      <>
                        <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                        Uploading…
                      </>
                    ) : (
                      <>
                        <i className="fa-solid fa-cloud-arrow-up" aria-hidden />
                        Upload
                        {pendingUploads.length > 0
                          ? ` (${pendingUploads.length})`
                          : ''}
                      </>
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={backToGallery}
                    disabled={busy}
                    className="w-full rounded-xl border border-stone-200 bg-white py-2.5 text-sm font-medium text-stone-600 transition hover:bg-stone-50 disabled:opacity-50"
                  >
                    Cancel
                  </button>
                </div>
              </>
            ) : null}
          </div>
        </div>
      ) : null}

      {preview || pendingPreviewUrl ? (
        <div
          className="fixed inset-0 z-[180] flex flex-col items-center justify-center bg-stone-950/80 p-4 backdrop-blur-sm"
          onClick={() => {
            setPreview(null)
            setPendingPreviewUrl(null)
          }}
          role="dialog"
          aria-label="Photo preview"
        >
          <button
            type="button"
            onClick={() => {
              setPreview(null)
              setPendingPreviewUrl(null)
            }}
            className="absolute right-4 top-4 flex h-10 w-10 items-center justify-center rounded-full bg-white/15 text-white transition hover:bg-white/25 sm:right-6 sm:top-6"
            aria-label="Close preview"
          >
            <i className="fa-solid fa-xmark text-lg" aria-hidden />
          </button>
          <div className="max-h-[80vh] max-w-full" onClick={(event) => event.stopPropagation()}>
            <img
              src={
                pendingPreviewUrl
                  ? pendingPreviewUrl
                  : resolveBookingServicePhotoUrl(preview!.image_url, preview!.image_path)
              }
              alt={preview?.caption || 'Service photo'}
              className="max-h-[78vh] w-auto max-w-full rounded-2xl object-contain shadow-2xl"
            />
            {preview?.caption ? (
              <p className="mt-3 text-center text-sm text-white/90">{preview.caption}</p>
            ) : null}
          </div>
        </div>
      ) : null}
    </>
  )
}
