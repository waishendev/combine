'use client'

import { useMemo, useState } from 'react'

type PaymentProof = {
  id?: number | string | null
  file_url?: string | null
  url?: string | null
  payment_proof_url?: string | null
  uploaded_at?: string | null
  created_at?: string | null
  payment_method?: string | null
  method?: string | null
  note?: string | null
  status?: string | null
}

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

export default function PaymentProofPreview({
  proofs,
  emptyText = 'No payment proof uploaded',
}: {
  proofs?: PaymentProof[] | null
  emptyText?: string
}) {
  const [lightbox, setLightbox] = useState<{ url: string; title: string } | null>(null)
  const items = useMemo(() => (Array.isArray(proofs) ? proofs.filter((proof) => resolveUrl(proof)) : []), [proofs])

  if (items.length === 0) {
    return <p className="rounded-lg bg-slate-50 px-3 py-4 text-center text-xs text-slate-500">{emptyText}</p>
  }

  return (
    <>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((proof, index) => {
          const url = resolveUrl(proof)
          const image = isImageUrl(url)
          const title = filenameFromUrl(url)
          const uploadedAt = formatDateTime(proof.uploaded_at ?? proof.created_at)
          const method = labelize(proof.payment_method ?? proof.method)

          return (
            <div key={`${proof.id ?? url}-${index}`} className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
              {image ? (
                <button
                  type="button"
                  onClick={() => setLightbox({ url, title })}
                  className="block w-full bg-slate-50 text-left focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                  aria-label={`Preview payment proof ${index + 1}`}
                >
                  <img src={url} alt={`Payment proof ${index + 1}`} className="h-36 w-full object-cover transition hover:scale-[1.01]" />
                </button>
              ) : (
                <a href={url} target="_blank" rel="noreferrer" className="flex h-36 flex-col items-center justify-center gap-2 bg-slate-50 px-4 text-center text-sm font-semibold text-blue-700 hover:bg-blue-50">
                  <i className="fa-regular fa-file-lines text-2xl" />
                  Open proof file
                </a>
              )}
              <div className="space-y-1 px-3 py-2 text-xs text-slate-600">
                {method ? <p><span className="font-semibold text-slate-500">Method:</span> {method}</p> : null}
                {uploadedAt ? <p><span className="font-semibold text-slate-500">Uploaded:</span> {uploadedAt}</p> : null}
                {proof.note ? <p className="line-clamp-2"><span className="font-semibold text-slate-500">Note:</span> {proof.note}</p> : null}
                <a href={url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 font-semibold text-blue-700 hover:text-blue-900">
                  Open original <i className="fa-solid fa-arrow-up-right-from-square text-[10px]" />
                </a>
              </div>
            </div>
          )
        })}
      </div>

      {lightbox ? (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/80 p-4" role="dialog" aria-modal="true">
          <button type="button" onClick={() => setLightbox(null)} className="absolute right-4 top-4 inline-flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20" aria-label="Close payment proof preview">
            <i className="fa-solid fa-xmark" />
          </button>
          <img src={lightbox.url} alt={lightbox.title} className="max-h-[88vh] max-w-[92vw] rounded-xl object-contain shadow-2xl" />
        </div>
      ) : null}
    </>
  )
}

export type { PaymentProof }
