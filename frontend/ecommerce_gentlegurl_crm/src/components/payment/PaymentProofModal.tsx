'use client'

import { useMemo, useState } from 'react'

import type { PaymentProof } from '@/components/payment/PaymentProofPreview'

const imageExtensions = new Set(['jpg', 'jpeg', 'png', 'gif', 'webp', 'avif', 'bmp', 'svg'])

const resolveUrl = (proof: PaymentProof) => proof.file_url || proof.url || proof.payment_proof_url || ''

const filenameFromUrl = (url: string) => {
  try {
    const pathname = new URL(url, 'http://localhost').pathname
    return decodeURIComponent(pathname.split('/').filter(Boolean).pop() || 'payment-proof')
  } catch {
    return url.split('/').filter(Boolean).pop() || 'payment-proof'
  }
}

const isImageUrl = (url: string) => {
  const clean = url.split('?')[0]?.split('#')[0] || ''
  const ext = clean.split('.').pop()?.toLowerCase() || ''
  return imageExtensions.has(ext)
}

const formatDateTime = (value?: string | null) => {
  if (!value) return null
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleString('en-MY', { dateStyle: 'medium', timeStyle: 'short' })
}

const labelize = (value?: string | null) => {
  const text = String(value ?? '').trim()
  if (!text) return null
  return text.replaceAll('_', ' ').replace(/\b\w/g, (char) => char.toUpperCase())
}

type ResolvedProof = PaymentProof & {
  resolved_url: string
  isImage: boolean
  title: string
  methodLabel: string | null
  uploadedLabel: string | null
}

type Props = {
  proofs?: PaymentProof[] | null
  bookingCode?: string | null
  className?: string
  layout?: 'default' | 'tile' | 'icon'
  overlayZIndexClass?: string
  previewZIndexClass?: string
}

export default function PaymentProofModal({
  proofs,
  bookingCode,
  className = '',
  layout = 'default',
  overlayZIndexClass = 'z-[170]',
  previewZIndexClass = 'z-[180]',
}: Props) {
  const [open, setOpen] = useState(false)
  const [previewIndex, setPreviewIndex] = useState(0)
  const [previewOpen, setPreviewOpen] = useState(false)

  const items = useMemo<ResolvedProof[]>(() => {
    const list = Array.isArray(proofs) ? proofs : []
    return list
      .map((proof) => {
        const resolved_url = resolveUrl(proof)
        if (!resolved_url) return null
        return {
          ...proof,
          resolved_url,
          isImage: isImageUrl(resolved_url),
          title: filenameFromUrl(resolved_url),
          methodLabel: labelize(proof.payment_method ?? proof.method),
          uploadedLabel: formatDateTime(proof.uploaded_at ?? proof.created_at),
        }
      })
      .filter((item): item is ResolvedProof => item !== null)
  }, [proofs])

  const imageItems = useMemo(() => items.filter((item) => item.isImage), [items])
  const proofCount = items.length
  const isTile = layout === 'tile'
  const isIcon = layout === 'icon'

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
        title={
          isIcon
            ? proofCount > 0
              ? `View ${proofCount} payment proof${proofCount === 1 ? '' : 's'}`
              : 'No payment proof uploaded yet — tap for details'
            : undefined
        }
        className={
          isIcon
            ? `relative inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-violet-200 bg-white text-violet-800 shadow-sm transition hover:border-violet-300 hover:bg-violet-50 ${className}`
            : isTile
            ? `group flex w-full min-h-[5.5rem] flex-col items-center justify-center gap-2 rounded-xl border border-amber-200/80 bg-gradient-to-b from-white to-amber-50/60 px-2 py-3 text-center shadow-sm transition hover:border-amber-300 hover:shadow-md ${className}`
            : `group flex w-full items-center gap-3 rounded-xl border border-amber-200/80 bg-gradient-to-r from-white to-amber-50/50 px-3.5 py-2.5 text-left shadow-sm transition hover:border-amber-300 hover:shadow-md ${className}`
        }
      >
        {isIcon ? (
          <>
            <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={1.75} viewBox="0 0 24 24" aria-hidden>
              <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1 1 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            {proofCount > 0 ? (
              <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-violet-700 px-1 text-[10px] font-bold text-white ring-2 ring-white">
                {proofCount > 9 ? '9+' : proofCount}
              </span>
            ) : null}
          </>
        ) : (
        <>
        <span
          className={
            isTile
              ? 'flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-amber-100 text-amber-800 transition group-hover:bg-amber-200/80'
              : 'flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-100 text-amber-800 transition group-hover:bg-amber-200/80'
          }
        >
          <i className="fa-solid fa-receipt text-base" aria-hidden />
        </span>
        {isTile ? (
          <>
            <span className="px-1 text-[10px] font-bold uppercase leading-snug tracking-wide text-stone-800 sm:text-[11px]">
              Payment proof (optional)
            </span>
            {proofCount > 0 ? (
              <span className="rounded-full bg-amber-600 px-2 py-0.5 text-[10px] font-bold text-white tabular-nums">
                {proofCount}
              </span>
            ) : (
              <span className="text-[10px] text-stone-500">Optional</span>
            )}
          </>
        ) : (
          <>
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-semibold text-stone-800">Payment proof (optional)</span>
              <span className="block text-xs text-stone-500">
                {proofCount > 0
                  ? `${proofCount} file${proofCount === 1 ? '' : 's'} · tap to view`
                  : 'No payment proof uploaded'}
              </span>
            </span>
            {proofCount > 0 ? (
              <span className="shrink-0 rounded-full bg-amber-600 px-2.5 py-1 text-xs font-bold text-white tabular-nums">
                {proofCount}
              </span>
            ) : (
              <span className="shrink-0 text-amber-700 opacity-70 transition group-hover:translate-x-0.5" aria-hidden>
                <i className="fa-solid fa-chevron-right text-sm" />
              </span>
            )}
          </>
        )}
        </>
        )}
      </button>

      {open ? (
        <div
          className={`fixed inset-0 ${overlayZIndexClass} flex items-end justify-center bg-stone-900/40 p-0 backdrop-blur-[2px] sm:items-center sm:p-4`}
          role="dialog"
          aria-modal="true"
          aria-labelledby="payment-proof-modal-title"
          onClick={closeModal}
        >
          <div
            className="flex max-h-[92vh] w-full max-w-lg flex-col overflow-hidden rounded-t-3xl bg-[#faf9f7] shadow-2xl sm:max-h-[88vh] sm:rounded-3xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="relative overflow-hidden px-5 pb-4 pt-5">
              <div
                className="pointer-events-none absolute inset-0 bg-gradient-to-br from-amber-100/90 via-orange-50/50 to-stone-50/40"
                aria-hidden
              />
              <div className="relative flex items-start gap-3">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white/80 text-amber-800 shadow-sm ring-1 ring-white/60">
                  <i className="fa-solid fa-receipt text-lg" aria-hidden />
                </div>
                <div className="min-w-0 flex-1 pr-8">
                  <h3 id="payment-proof-modal-title" className="text-lg font-semibold tracking-tight text-stone-800">
                    Payment proof
                  </h3>
                  <p className="mt-0.5 text-sm text-stone-600">
                    {isIcon
                      ? 'Transfer slip or QRPay screenshot uploaded by the customer.'
                      : 'Optional payment receipts or transfer screenshots.'}
                  </p>
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
              {proofCount > 0 ? (
                <div className="space-y-3">
                  {items.map((proof, index) => (
                    <article
                      key={`payment-proof-${proof.id ?? proof.resolved_url}-${index}`}
                      className="overflow-hidden rounded-2xl border border-stone-200/80 bg-white shadow-sm"
                    >
                      {proof.isImage ? (
                        <button
                          type="button"
                          onClick={() => {
                            const imageIndex = imageItems.findIndex(
                              (item) => item.resolved_url === proof.resolved_url && item.id === proof.id,
                            )
                            openPreviewAt(imageIndex >= 0 ? imageIndex : 0)
                          }}
                          className="block w-full bg-stone-50"
                        >
                          <img
                            src={proof.resolved_url}
                            alt={proof.title}
                            className="max-h-48 w-full object-cover"
                          />
                        </button>
                      ) : (
                        <a
                          href={proof.resolved_url}
                          target="_blank"
                          rel="noreferrer"
                          className="flex h-28 flex-col items-center justify-center gap-2 bg-stone-50 px-4 text-center text-sm font-semibold text-amber-800 hover:bg-amber-50"
                        >
                          <i className="fa-regular fa-file-lines text-2xl" aria-hidden />
                          Open proof file
                        </a>
                      )}
                      <div className="space-y-1 px-3 py-2.5 text-xs text-stone-600">
                        {proof.methodLabel ? (
                          <p>
                            <span className="font-semibold text-stone-500">Method:</span> {proof.methodLabel}
                          </p>
                        ) : null}
                        {proof.uploadedLabel ? (
                          <p>
                            <span className="font-semibold text-stone-500">Uploaded:</span> {proof.uploadedLabel}
                          </p>
                        ) : null}
                        {proof.note ? (
                          <p className="line-clamp-3">
                            <span className="font-semibold text-stone-500">Note:</span> {proof.note}
                          </p>
                        ) : null}
                        <a
                          href={proof.resolved_url}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 font-semibold text-amber-800 hover:text-amber-950"
                        >
                          Open original <i className="fa-solid fa-arrow-up-right-from-square text-[10px]" aria-hidden />
                        </a>
                      </div>
                    </article>
                  ))}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center rounded-2xl border border-stone-200/80 bg-white px-6 py-12 text-center">
                  <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-100 to-orange-100 text-amber-800">
                    <i className="fa-regular fa-file-lines text-2xl" aria-hidden />
                  </div>
                  <p className="text-sm font-semibold text-stone-800">No payment proof</p>
                  <p className="mt-1 max-w-[280px] text-xs leading-relaxed text-stone-500">
                    {isIcon
                      ? 'Customer has not uploaded a slip yet. Proof appears after Manual Transfer upload on shop Orders, or after booking deposit slip upload.'
                      : 'No payment proof has been uploaded for this booking.'}
                  </p>
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

      {previewOpen && imageItems.length > 0 ? (
        <div
          className={`fixed inset-0 ${previewZIndexClass} flex flex-col items-center justify-center bg-stone-950/80 p-4 backdrop-blur-sm`}
          onClick={() => setPreviewOpen(false)}
          role="dialog"
          aria-label="Payment proof preview"
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
              src={imageItems[previewIndex]?.resolved_url || ''}
              alt={imageItems[previewIndex]?.title || 'Payment proof'}
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
                {previewIndex + 1} / {imageItems.length}
              </span>
              <button
                type="button"
                onClick={() => setPreviewIndex((prev) => Math.min(imageItems.length - 1, prev + 1))}
                disabled={previewIndex >= imageItems.length - 1}
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
