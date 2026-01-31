'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'

import { ServicesPageLayout } from '@/components/services/ServicesPageLayout'
import PreviewHeader from './PreviewHeader'

const previewKey = (menuId: number) => `services-page-preview-${menuId}`

type ServicesPagePreviewData = {
  title: string
  subtitle: string
  services: { title: string; description: string }[]
  gallery: { src: string; alt?: string; caption?: string; captionAlign?: 'left' | 'center' | 'right' }[]
  pricing: { label: string; price: string }[]
  faqs: { question: string; answer: string }[]
  notes: string[]
  servicesActive: boolean
  galleryActive: boolean
  pricingActive: boolean
  faqsActive: boolean
  notesActive: boolean
  heroActive: boolean
  heroImage?: string
  heroSlides?: {
    src: string
    mobileSrc?: string
    alt?: string
    title?: string
    subtitle?: string
    description?: string
    buttonLabel?: string
    buttonHref?: string
    sort_order?: number
  }[]
  servicesHeading?: { label: string; title: string; align?: 'left' | 'center' | 'right' }
  galleryHeading?: { label: string; title: string; align?: 'left' | 'center' | 'right' }
  galleryFooterText?: string
  galleryFooterAlign?: 'left' | 'center' | 'right'
  galleryLayout?: 'auto' | 'fixed'
  pricingHeading?: { label: string; title: string; align?: 'left' | 'center' | 'right' }
  faqHeading?: { label: string; title: string; align?: 'left' | 'center' | 'right' }
  notesHeading?: { label: string; title: string; align?: 'left' | 'center' | 'right' }
}

type PreviewMode = 'desktop' | 'mobile'

export default function PreviewClient({ menuId }: { menuId: number }) {
  const [previewData, setPreviewData] = useState<ServicesPagePreviewData | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [mode, setMode] = useState<PreviewMode>('desktop')

  useEffect(() => {
    const stored = localStorage.getItem(previewKey(menuId))
    if (!stored) {
      setError('No preview data found. Please return to the editor and click Preview again.')
      return
    }
    try {
      const parsed = JSON.parse(stored) as ServicesPagePreviewData
      setPreviewData(parsed)
    } catch {
      setError('Preview data is invalid. Please regenerate the preview from the editor.')
    }
  }, [menuId])

  const previewContainerClass = useMemo(() => {
    if (mode === 'mobile') {
      return 'mx-auto w-full max-w-[420px] overflow-hidden rounded-[32px] border border-[var(--card-border)] bg-white shadow-xl'
    }
    return 'w-full'
  }, [mode])

  if (error) {
    return (
      <div className="min-h-screen bg-[var(--background-soft)]">
        <PreviewHeader />
        <div className="px-6 py-10">
          <div className="mx-auto max-w-2xl rounded-lg border border-[var(--card-border)] bg-white p-6 shadow-sm">
            <h1 className="text-xl font-semibold text-[var(--foreground)]">Preview unavailable</h1>
            <p className="mt-2 text-sm text-[var(--text-muted)]">{error}</p>
            <Link
              href={`/services-pages/${menuId}`}
              className="mt-4 inline-flex items-center gap-2 rounded bg-[var(--accent-strong)] px-4 py-2 text-sm font-medium text-white hover:bg-[var(--accent-stronger)]"
            >
              <i className="fa-solid fa-arrow-left" />
              Back to editor
            </Link>
          </div>
        </div>
      </div>
    )
  }

  if (!previewData) {
    return (
      <div className="min-h-screen bg-[var(--background-soft)]">
        <PreviewHeader />
        <div className="px-6 py-10">
          <div className="mx-auto max-w-2xl rounded-lg border border-[var(--card-border)] bg-white p-6 shadow-sm">
            <p className="text-sm text-[var(--text-muted)]">Loading preview...</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[var(--background-soft)]">
      <div className="sticky top-0 z-30 border-b border-[var(--card-border)] bg-[var(--background)]/90 backdrop-blur">
        <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center justify-between gap-4 px-6 py-4">
          <div>
            <p className="text-xs uppercase tracking-wide text-[var(--text-muted)]">Preview</p>
            <h1 className="text-lg font-semibold text-[var(--foreground)]">{previewData.title}</h1>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="inline-flex items-center rounded-lg border border-[var(--card-border)] bg-white p-1">
              <button
                type="button"
                onClick={() => setMode('desktop')}
                className={`inline-flex items-center gap-2 rounded-md px-3 py-1.5 text-xs font-medium transition ${
                  mode === 'desktop'
                    ? 'bg-[var(--foreground)] text-white'
                    : 'text-[var(--text-muted)] hover:text-[var(--foreground)]'
                }`}
              >
                <i className="fa-solid fa-desktop" />
                Desktop
              </button>
              <button
                type="button"
                onClick={() => setMode('mobile')}
                className={`inline-flex items-center gap-2 rounded-md px-3 py-1.5 text-xs font-medium transition ${
                  mode === 'mobile'
                    ? 'bg-[var(--foreground)] text-white'
                    : 'text-[var(--text-muted)] hover:text-[var(--foreground)]'
                }`}
              >
                <i className="fa-solid fa-mobile-screen" />
                Mobile
              </button>
            </div>
            <Link
              href={`/services-pages/${menuId}`}
              className="inline-flex items-center gap-2 rounded border border-[var(--card-border)] px-3 py-2 text-xs font-semibold text-[var(--foreground)] transition hover:bg-[var(--background-soft)]"
            >
              <i className="fa-solid fa-pen" />
              Back to editor
            </Link>
          </div>
        </div>
      </div>
      <PreviewHeader />
      <div className="mx-auto w-full max-w-6xl px-4 py-8">
        <div className={previewContainerClass}>
          <ServicesPageLayout
            title={previewData.title}
            subtitle={previewData.subtitle}
            services={previewData.services}
            gallery={previewData.gallery}
            pricing={previewData.pricing}
            faqs={previewData.faqs}
            notes={previewData.notes}
            servicesActive={previewData.servicesActive}
            galleryActive={previewData.galleryActive}
            pricingActive={previewData.pricingActive}
            faqsActive={previewData.faqsActive}
            notesActive={previewData.notesActive}
            heroActive={previewData.heroActive}
            heroImage={previewData.heroImage}
            heroSlides={previewData.heroSlides}
            servicesHeading={previewData.servicesHeading}
            galleryHeading={previewData.galleryHeading}
            galleryFooterText={previewData.galleryFooterText}
            galleryFooterAlign={previewData.galleryFooterAlign}
            galleryLayout={previewData.galleryLayout}
            pricingHeading={previewData.pricingHeading}
            faqHeading={previewData.faqHeading}
            notesHeading={previewData.notesHeading}
          />
        </div>
      </div>
    </div>
  )
}
