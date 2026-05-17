'use client'

import { useState } from 'react'

export type CustomerUploadedPhoto = {
  id: number
  resolved_url: string
  created_at?: string | null
}

type Props = {
  photos: CustomerUploadedPhoto[]
  bookingCode?: string | null
  className?: string
  /** Compact centered button for side-by-side grids (e.g. appointment settlement). */
  layout?: 'default' | 'tile'
  buttonLabel?: string
  modalTitle?: string
  modalDescription?: string
  emptyTitle?: string
  emptyDescription?: string
  gallerySectionTitle?: string
}

function GalleryTile({
  src,
  alt,
  onView,
}: {
  src: string
  alt: string
  onView: () => void
}) {
  return (
    <button
      type="button"
      onClick={onView}
      className="group relative aspect-square w-full overflow-hidden rounded-2xl bg-stone-100 ring-1 ring-stone-200/80 shadow-sm"
    >
      {src ? (
        <img
          src={src}
          alt={alt}
          className="h-full w-full object-cover transition duration-200 group-hover:scale-[1.02]"
        />
      ) : (
        <span className="flex h-full items-center justify-center px-2 text-center text-xs text-stone-500">
          Preview unavailable
        </span>
      )}
    </button>
  )
}

export default function CustomerUploadedPhotosModal({
  photos,
  bookingCode,
  className = '',
  layout = 'default',
  buttonLabel = 'Customer uploaded photos',
  modalTitle = 'Customer uploaded photos',
  modalDescription = 'Reference photos submitted by the customer when booking.',
  emptyTitle = 'No customer photos',
  emptyDescription = 'The customer has not uploaded any reference photos for this booking.',
  gallerySectionTitle = 'Photos from customer',
}: Props) {
  const isTile = layout === 'tile'
  const [open, setOpen] = useState(false)
  const [previewIndex, setPreviewIndex] = useState(0)
  const [previewOpen, setPreviewOpen] = useState(false)

  const photoCount = photos.length

  const openGallery = () => {
    setPreviewIndex(0)
    setPreviewOpen(false)
    setOpen(true)
  }

  const closeModal = () => {
    setOpen(false)
    setPreviewOpen(false)
  }

  const openPreviewAt = (index: number) => {
    setPreviewIndex(index)
    setPreviewOpen(true)
  }

  return (
    <>
      <button
        type="button"
        onClick={openGallery}
        className={
          isTile
            ? `group flex w-full min-h-[5.5rem] flex-col items-center justify-center gap-2 rounded-xl border border-violet-200/80 bg-gradient-to-b from-white to-violet-50/60 px-2 py-3 text-center shadow-sm transition hover:border-violet-300 hover:shadow-md ${className}`
            : `group flex w-full items-center gap-3 rounded-xl border border-violet-200/80 bg-gradient-to-r from-white to-violet-50/50 px-3.5 py-2.5 text-left shadow-sm transition hover:border-violet-300 hover:shadow-md ${className}`
        }
      >
        <span
          className={
            isTile
              ? 'flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-violet-100 text-violet-700 transition group-hover:bg-violet-200/80'
              : 'flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-violet-100 text-violet-700 transition group-hover:bg-violet-200/80'
          }
        >
          <i className="fa-solid fa-user-clock text-base" aria-hidden />
        </span>
        {isTile ? (
          <>
            <span className="px-1 text-[10px] font-bold uppercase leading-snug tracking-wide text-stone-800 sm:text-[11px]">
              {buttonLabel}
            </span>
            {photoCount > 0 ? (
              <span className="rounded-full bg-violet-600 px-2 py-0.5 text-[10px] font-bold text-white tabular-nums">
                {photoCount}
              </span>
            ) : (
              <span className="text-[10px] text-stone-500">None yet</span>
            )}
          </>
        ) : (
          <>
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-semibold text-stone-800">{buttonLabel}</span>
              <span className="block text-xs text-stone-500">
                {photoCount > 0
                  ? `${photoCount} photo${photoCount === 1 ? '' : 's'} · tap to view`
                  : 'No photos yet'}
              </span>
            </span>
            {photoCount > 0 ? (
              <span className="shrink-0 rounded-full bg-violet-600 px-2.5 py-1 text-xs font-bold text-white tabular-nums">
                {photoCount}
              </span>
            ) : (
              <span className="shrink-0 text-violet-600 opacity-70 transition group-hover:translate-x-0.5" aria-hidden>
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
          aria-labelledby="customer-uploaded-photos-title"
          onClick={closeModal}
        >
          <div
            className="flex max-h-[92vh] w-full max-w-lg flex-col overflow-hidden rounded-t-3xl bg-[#faf9f7] shadow-2xl sm:max-h-[88vh] sm:rounded-3xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="relative overflow-hidden px-5 pb-4 pt-5">
              <div
                className="pointer-events-none absolute inset-0 bg-gradient-to-br from-violet-100/90 via-rose-50/50 to-amber-50/40"
                aria-hidden
              />
              <div className="relative flex items-start gap-3">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white/80 text-violet-700 shadow-sm ring-1 ring-white/60">
                  <i className="fa-solid fa-images text-lg" aria-hidden />
                </div>
                <div className="min-w-0 flex-1 pr-8">
                  <h3 id="customer-uploaded-photos-title" className="text-lg font-semibold tracking-tight text-stone-800">
                    {modalTitle}
                  </h3>
                  <p className="mt-0.5 text-sm text-stone-600">{modalDescription}</p>
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
              {photoCount > 0 ? (
                <section>
                  <h4 className="mb-3 text-sm font-semibold text-stone-800">
                    {gallerySectionTitle}
                    <span className="ml-1.5 font-normal text-stone-500">({photoCount})</span>
                  </h4>
                  <div className="grid grid-cols-3 gap-2.5">
                    {photos.map((photo, index) => (
                      <GalleryTile
                        key={`customer-upload-${photo.id}`}
                        src={photo.resolved_url}
                        alt={`Customer photo ${index + 1}`}
                        onView={() => openPreviewAt(index)}
                      />
                    ))}
                  </div>
                  <p className="mt-3 text-center text-xs text-stone-400">Tap a photo to view full size</p>
                </section>
              ) : (
                <div className="flex flex-col items-center justify-center rounded-2xl border border-stone-200/80 bg-white px-6 py-12 text-center">
                  <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-100 to-rose-100 text-violet-700">
                    <i className="fa-regular fa-image text-2xl" aria-hidden />
                  </div>
                  <p className="text-sm font-semibold text-stone-800">{emptyTitle}</p>
                  <p className="mt-1 max-w-[260px] text-xs leading-relaxed text-stone-500">{emptyDescription}</p>
                </div>
              )}
            </div>

            <div className="border-t border-stone-200/80 bg-white/60 px-5 py-4">
              <button
                type="button"
                onClick={closeModal}
                className="w-full rounded-xl border border-stone-200 bg-white py-3 text-sm font-semibold text-stone-700 transition hover:bg-stone-50"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {previewOpen && photoCount > 0 ? (
        <div
          className="fixed inset-0 z-[180] flex flex-col items-center justify-center bg-stone-950/80 p-4 backdrop-blur-sm"
          onClick={() => setPreviewOpen(false)}
          role="dialog"
          aria-label="Photo preview"
        >
          <button
            type="button"
            onClick={() => setPreviewOpen(false)}
            className="absolute right-4 top-4 flex h-10 w-10 items-center justify-center rounded-full bg-white/15 text-white transition hover:bg-white/25 sm:right-6 sm:top-6"
            aria-label="Close preview"
          >
            <i className="fa-solid fa-xmark text-lg" aria-hidden />
          </button>
          <div className="max-h-[80vh] max-w-full px-2" onClick={(event) => event.stopPropagation()}>
            <img
              src={photos[previewIndex]?.resolved_url || ''}
              alt={`Customer photo ${previewIndex + 1}`}
              className="max-h-[72vh] w-auto max-w-full rounded-2xl object-contain shadow-2xl"
            />
            <div className="mt-4 flex items-center justify-center gap-3">
              <button
                type="button"
                onClick={() => setPreviewIndex((prev) => Math.max(0, prev - 1))}
                disabled={previewIndex <= 0}
                className="rounded-xl border border-white/20 bg-white/10 px-4 py-2 text-sm font-medium text-white disabled:opacity-40"
              >
                Previous
              </button>
              <span className="min-w-[4rem] text-center text-sm font-medium text-white/90 tabular-nums">
                {previewIndex + 1} / {photoCount}
              </span>
              <button
                type="button"
                onClick={() => setPreviewIndex((prev) => Math.min(photoCount - 1, prev + 1))}
                disabled={previewIndex >= photoCount - 1}
                className="rounded-xl border border-white/20 bg-white/10 px-4 py-2 text-sm font-medium text-white disabled:opacity-40"
              >
                Next
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  )
}
