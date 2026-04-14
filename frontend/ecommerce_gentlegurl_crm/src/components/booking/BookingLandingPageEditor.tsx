'use client'

import type { ReactNode } from 'react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

type HeadingConfig = { label: string; title: string; align: 'left' | 'center' | 'right' }
type GalleryItem = { src: string; caption: string }
type FaqItem = { question: string; answer: string }

type Sections = {
  hero: {
    is_active: boolean
    label: string
    title: string
    subtitle: string
    cta_label: string
    cta_link: string
  }
  gallery: { is_active: boolean; heading: HeadingConfig; items: GalleryItem[] }
  service_menu: { is_active: boolean; heading: HeadingConfig; items: GalleryItem[] }
  faqs: { is_active: boolean; heading: HeadingConfig; items: FaqItem[] }
  notes: { is_active: boolean; heading: HeadingConfig; items: string[] }
}

type LandingPageData = {
  id: number | null
  slug: string
  sections: Sections
}

const defaultSections: Sections = {
  hero: {
    is_active: true,
    label: 'Premium Salon Booking',
    title: 'Beauty appointments, made effortless.',
    subtitle: 'Discover signature services, reserve your slot instantly, and arrive confident with our trusted professional team.',
    cta_label: 'Book Appointment',
    cta_link: '/booking',
  },
  gallery: {
    is_active: true,
    heading: { label: 'GALLERY', title: 'Click to view services and pricing', align: 'center' },
    items: [],
  },
  service_menu: {
    is_active: true,
    heading: { label: 'Service Menu', title: 'Click to view services and pricing', align: 'center' },
    items: [],
  },
  faqs: {
    is_active: true,
    heading: { label: 'FAQ', title: 'You might be wondering', align: 'left' },
    items: [],
  },
  notes: {
    is_active: true,
    heading: { label: 'Notes', title: 'Policy & care', align: 'left' },
    items: [],
  },
}

export default function BookingLandingPageEditor({ canEdit }: { canEdit: boolean }) {
  const [data, setData] = useState<LandingPageData | null>(null)
  const [sections, setSections] = useState<Sections>(defaultSections)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [collapsedSections, setCollapsedSections] = useState<Record<string, boolean>>({})
  const [galleryPreviews, setGalleryPreviews] = useState<(string | null)[]>([])
  const [serviceMenuPreviews, setServiceMenuPreviews] = useState<(string | null)[]>([])
  const galleryImageInputRefs = useRef<Map<number, HTMLInputElement>>(new Map())
  const serviceMenuImageInputRefs = useRef<Map<number, HTMLInputElement>>(new Map())

  const fetchData = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/proxy/admin/booking/landing-page')
      const json = await res.json()
      const pageData = json?.data ?? json
      setData(pageData)
      if (pageData?.sections) {
        setSections({ ...defaultSections, ...pageData.sections })
        const galleryCount = Array.isArray(pageData.sections?.gallery?.items) ? pageData.sections.gallery.items.length : 0
        const serviceMenuCount = Array.isArray(pageData.sections?.service_menu?.items) ? pageData.sections.service_menu.items.length : 0
        setGalleryPreviews(Array(galleryCount).fill(null))
        setServiceMenuPreviews(Array(serviceMenuCount).fill(null))
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load landing page data')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void fetchData()
  }, [fetchData])

  const handleSave = async () => {
    setSaving(true)
    setMessage(null)
    setError(null)
    try {
      const res = await fetch('/api/proxy/admin/booking/landing-page', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sections }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json?.message || 'Save failed')
      const pageData = json?.data ?? json
      setData(pageData)
      if (pageData?.sections) {
        setSections({ ...defaultSections, ...pageData.sections })
        const galleryCount = Array.isArray(pageData.sections?.gallery?.items) ? pageData.sections.gallery.items.length : 0
        const serviceMenuCount = Array.isArray(pageData.sections?.service_menu?.items) ? pageData.sections.service_menu.items.length : 0
        setGalleryPreviews(Array(galleryCount).fill(null))
        setServiceMenuPreviews(Array(serviceMenuCount).fill(null))
      }
      setMessage('Landing page saved successfully!')
      setTimeout(() => setMessage(null), 3000)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save')
    } finally {
      setSaving(false)
    }
  }

  const uploadImage = async (file: File, section: string): Promise<string | null> => {
    const formData = new FormData()
    formData.append('image', file)
    formData.append('section', section)
    try {
      const res = await fetch('/api/proxy/admin/booking/landing-page/upload-image', {
        method: 'POST',
        body: formData,
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json?.message || 'Upload failed')
      const d = json?.data ?? json
      return d?.url || d?.path || null
    } catch {
      return null
    }
  }

  const ensureArrayLength = useCallback(<T,>(items: (T | null)[], length: number) => {
    if (items.length >= length) return [...items]
    return [...items, ...Array(length - items.length).fill(null)]
  }, [])

  const handleImageUpload = useCallback(async (
    sectionKey: 'gallery' | 'service_menu',
    index: number,
    file: File,
  ) => {
    const previewUrl = URL.createObjectURL(file)
    if (sectionKey === 'gallery') {
      setGalleryPreviews((prev) => {
        const next = ensureArrayLength(prev, index + 1)
        next[index] = previewUrl
        return next
      })
    } else {
      setServiceMenuPreviews((prev) => {
        const next = ensureArrayLength(prev, index + 1)
        next[index] = previewUrl
        return next
      })
    }

    const url = await uploadImage(file, sectionKey)
    if (!url) return

    setSections((prev) => {
      const items = [...prev[sectionKey].items]
      items[index] = { ...items[index], src: url }
      return { ...prev, [sectionKey]: { ...prev[sectionKey], items } }
    })
  }, [ensureArrayLength])

  const updateHero = (field: string, value: string | boolean) => {
    setSections((prev) => ({
      ...prev,
      hero: { ...prev.hero, [field]: value },
    }))
  }

  const updateHeading = (sectionKey: keyof Sections, field: string, value: string) => {
    setSections((prev) => {
      const section = prev[sectionKey] as { heading: HeadingConfig; [key: string]: unknown }
      return {
        ...prev,
        [sectionKey]: {
          ...section,
          heading: { ...section.heading, [field]: value },
        },
      }
    })
  }

  const toggleSection = (sectionKey: keyof Sections) => {
    setSections((prev) => ({
      ...prev,
      [sectionKey]: { ...prev[sectionKey], is_active: !prev[sectionKey].is_active },
    }))
  }

  const toggleSectionCollapsed = (sectionKey: string) => {
    setCollapsedSections((prev) => ({
      ...prev,
      [sectionKey]: !prev[sectionKey],
    }))
  }

  const updateGalleryItem = (
    sectionKey: 'gallery' | 'service_menu',
    index: number,
    field: keyof GalleryItem,
    value: string,
  ) => {
    setSections((prev) => {
      const items = [...prev[sectionKey].items]
      items[index] = { ...items[index], [field]: value }
      return { ...prev, [sectionKey]: { ...prev[sectionKey], items } }
    })
  }

  const addGalleryItem = (sectionKey: 'gallery' | 'service_menu') => {
    setSections((prev) => {
      const next = {
        ...prev,
        [sectionKey]: {
          ...prev[sectionKey],
          items: [...prev[sectionKey].items, { src: '', caption: '' }],
        },
      }
      return next
    })
    if (sectionKey === 'gallery') {
      setGalleryPreviews((prev) => [...prev, null])
    } else {
      setServiceMenuPreviews((prev) => [...prev, null])
    }
  }

  const removeGalleryItem = (sectionKey: 'gallery' | 'service_menu', index: number) => {
    setSections((prev) => ({
      ...prev,
      [sectionKey]: {
        ...prev[sectionKey],
        items: prev[sectionKey].items.filter((_, i) => i !== index),
      },
    }))
    if (sectionKey === 'gallery') {
      setGalleryPreviews((prev) => prev.filter((_, i) => i !== index))
    } else {
      setServiceMenuPreviews((prev) => prev.filter((_, i) => i !== index))
    }
  }

  const reorder = useCallback(<T,>(items: T[], index: number, targetIndex: number) => {
    const next = [...items]
    const [moved] = next.splice(index, 1)
    next.splice(targetIndex, 0, moved)
    return next
  }, [])

  const moveGalleryItem = useCallback((sectionKey: 'gallery' | 'service_menu', index: number, direction: -1 | 1) => {
    setSections((prev) => {
      const targetIndex = index + direction
      const section = prev[sectionKey]
      if (targetIndex < 0 || targetIndex >= section.items.length) return prev
      const items = reorder(section.items, index, targetIndex)
      return { ...prev, [sectionKey]: { ...section, items } }
    })

    if (sectionKey === 'gallery') {
      setGalleryPreviews((prev) => {
        const targetIndex = index + direction
        if (targetIndex < 0 || targetIndex >= prev.length) return prev
        return reorder(prev, index, targetIndex)
      })
    } else {
      setServiceMenuPreviews((prev) => {
        const targetIndex = index + direction
        if (targetIndex < 0 || targetIndex >= prev.length) return prev
        return reorder(prev, index, targetIndex)
      })
    }
  }, [reorder])

  const updateFaqItem = (index: number, field: keyof FaqItem, value: string) => {
    setSections((prev) => {
      const items = [...prev.faqs.items]
      items[index] = { ...items[index], [field]: value }
      return { ...prev, faqs: { ...prev.faqs, items } }
    })
  }

  const addFaqItem = () => {
    setSections((prev) => ({
      ...prev,
      faqs: { ...prev.faqs, items: [...prev.faqs.items, { question: '', answer: '' }] },
    }))
  }

  const removeFaqItem = (index: number) => {
    setSections((prev) => ({
      ...prev,
      faqs: { ...prev.faqs, items: prev.faqs.items.filter((_, i) => i !== index) },
    }))
  }

  const updateNoteItem = (index: number, value: string) => {
    setSections((prev) => {
      const items = [...prev.notes.items]
      items[index] = value
      return { ...prev, notes: { ...prev.notes, items } }
    })
  }

  const addNoteItem = () => {
    setSections((prev) => ({
      ...prev,
      notes: { ...prev.notes, items: [...prev.notes.items, ''] },
    }))
  }

  const removeNoteItem = (index: number) => {
    setSections((prev) => ({
      ...prev,
      notes: { ...prev.notes, items: prev.notes.items.filter((_, i) => i !== index) },
    }))
  }

  const inputCls = useMemo(
    () => 'w-full rounded border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500',
    [],
  )
  const textareaCls = useMemo(
    () => 'w-full rounded border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500',
    [],
  )

  const gallerySectionsMeta = useMemo(() => ({
    gallery: {
      title: 'Gallery section',
      description: 'Upload images to appear on the booking landing page gallery.',
      inputRefs: galleryImageInputRefs,
      previews: galleryPreviews,
      setPreviews: setGalleryPreviews,
    },
    service_menu: {
      title: 'Service Menu section',
      description: 'Upload images to appear under the service menu section.',
      inputRefs: serviceMenuImageInputRefs,
      previews: serviceMenuPreviews,
      setPreviews: setServiceMenuPreviews,
    },
  }), [galleryPreviews, serviceMenuPreviews])

  if (loading) {
    return <div className="rounded-lg border border-gray-200 bg-white p-6 text-sm text-gray-500">Loading landing page...</div>
  }

  const renderMediaSection = (sectionKey: 'gallery' | 'service_menu') => {
    const section = sections[sectionKey]
    const meta = gallerySectionsMeta[sectionKey]
    const collapsed = collapsedSections[sectionKey] ?? false

    const handleImageClick = (index: number) => {
      meta.inputRefs.current.get(index)?.click()
    }

    return (
      <SectionCard
        sectionKey={sectionKey}
        title={meta.title}
        description={meta.description}
        active={section.is_active}
        onToggle={(value) => setSections((prev) => ({ ...prev, [sectionKey]: { ...prev[sectionKey], is_active: value } }))}
        canUpdate={canEdit}
        collapsed={collapsed}
        onToggleCollapse={() => toggleSectionCollapsed(sectionKey)}
      >
        <div className="space-y-4">
          <SectionHeadingFields
            heading={section.heading}
            onChange={(heading) => setSections((prev) => ({ ...prev, [sectionKey]: { ...prev[sectionKey], heading } }))}
            canUpdate={canEdit}
          />

          {section.items.length === 0 ? (
            <div className="rounded-lg border border-dashed border-gray-200 bg-gray-50 px-4 py-6 text-center text-sm text-gray-500">
              No images yet. Add images to build the section grid.
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {section.items.map((item, index) => (
                <div key={`${sectionKey}-${index}`} className="rounded-lg border border-gray-100 bg-gray-50/60 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <p className="text-sm font-semibold text-gray-900">Image {index + 1}</p>
                      <p className="text-xs text-gray-500">Suggested size: 900 x 1200 (3:4)</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => moveGalleryItem(sectionKey, index, -1)}
                        disabled={!canEdit || index === 0}
                        className="rounded border border-gray-300 px-2 py-1 text-xs text-gray-600 hover:bg-gray-50 disabled:opacity-50"
                        aria-label="Move image up"
                      >
                        <i className="fa-solid fa-arrow-up" />
                      </button>
                      <button
                        type="button"
                        onClick={() => moveGalleryItem(sectionKey, index, 1)}
                        disabled={!canEdit || index === section.items.length - 1}
                        className="rounded border border-gray-300 px-2 py-1 text-xs text-gray-600 hover:bg-gray-50 disabled:opacity-50"
                        aria-label="Move image down"
                      >
                        <i className="fa-solid fa-arrow-down" />
                      </button>
                      <button
                        type="button"
                        onClick={() => removeGalleryItem(sectionKey, index)}
                        disabled={!canEdit}
                        className="rounded border border-red-200 px-2 py-1 text-xs text-red-600 hover:bg-red-50 disabled:opacity-50"
                      >
                        <i className="fa-solid fa-trash" />
                      </button>
                    </div>
                  </div>

                  <div className="mt-3 space-y-3">
                    <div
                      onClick={() => canEdit && handleImageClick(index)}
                      className={`relative border-2 border-dashed rounded-lg p-3 cursor-pointer transition-colors ${
                        (meta.previews[index] ?? item.src)
                          ? 'border-gray-300'
                          : 'border-gray-300 hover:border-blue-400'
                      } ${!canEdit ? 'cursor-not-allowed opacity-50' : ''}`}
                    >
                      <input
                        ref={(el) => {
                          if (el) {
                            meta.inputRefs.current.set(index, el)
                          } else {
                            meta.inputRefs.current.delete(index)
                          }
                        }}
                        type="file"
                        accept="image/*"
                        onChange={(e) => {
                          const file = e.target.files?.[0]
                          if (file) void handleImageUpload(sectionKey, index, file)
                        }}
                        className="hidden"
                        disabled={!canEdit}
                      />
                      {(meta.previews[index] ?? item.src) ? (
                        <div className="relative group h-48 flex items-center justify-center bg-gray-50 rounded">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={meta.previews[index] ?? item.src}
                            alt={item.caption || `Image ${index + 1}`}
                            className="max-w-full max-h-full object-contain rounded"
                          />
                          <div className="absolute top-2 right-2 flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                            <button
                              type="button"
                              onClick={(ev) => {
                                ev.stopPropagation()
                                handleImageClick(index)
                              }}
                              className="w-8 h-8 bg-blue-500/95 backdrop-blur-md text-white rounded-full flex items-center justify-center shadow-lg border border-blue-400/30 hover:bg-blue-600 hover:shadow-xl hover:scale-110 transition-all duration-200"
                              aria-label="Replace image"
                              disabled={!canEdit}
                            >
                              <i className="fa-solid fa-image text-xs" />
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex flex-col items-center justify-center h-48">
                          <i className="fa-solid fa-cloud-arrow-up text-3xl text-gray-400 mb-2" />
                          <p className="text-sm text-gray-600">Click to upload</p>
                        </div>
                      )}
                    </div>

                    <div className="grid gap-2">
                      <input
                        value={item.src}
                        onChange={(e) => updateGalleryItem(sectionKey, index, 'src', e.target.value)}
                        placeholder="/images/example.webp"
                        className={inputCls}
                        disabled={!canEdit}
                      />
                      <input
                        value={item.caption}
                        onChange={(e) => updateGalleryItem(sectionKey, index, 'caption', e.target.value)}
                        placeholder="Caption"
                        className={inputCls}
                        disabled={!canEdit}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="flex items-center justify-between text-xs text-gray-500">
            <span>{section.items.length} images</span>
            <button
              type="button"
              onClick={() => addGalleryItem(sectionKey)}
              disabled={!canEdit}
              className="inline-flex items-center gap-2 rounded border border-indigo-600 bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <i className="fa-solid fa-plus" />
              Add image
            </button>
          </div>
        </div>
      </SectionCard>
    )
  }

  return (
    <div className="space-y-6">
      {message && (
        <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
          {message}
        </div>
      )}
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
      )}

      {/* Hero Section */}
      <SectionCard
        sectionKey="hero"
        title="Hero section"
        description="Controls the hero content on the booking landing page."
        active={sections.hero.is_active}
        onToggle={(value) => setSections((prev) => ({ ...prev, hero: { ...prev.hero, is_active: value } }))}
        canUpdate={canEdit}
        collapsed={collapsedSections.hero ?? false}
        onToggleCollapse={() => toggleSectionCollapsed('hero')}
      >
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-1 text-sm text-gray-700">
            <span className="text-xs font-medium uppercase tracking-wide text-gray-500">Label</span>
            <input className={inputCls} value={sections.hero.label} onChange={(e) => updateHero('label', e.target.value)} disabled={!canEdit} />
          </div>
          <div className="space-y-1 text-sm text-gray-700">
            <span className="text-xs font-medium uppercase tracking-wide text-gray-500">CTA button label</span>
            <input className={inputCls} value={sections.hero.cta_label} onChange={(e) => updateHero('cta_label', e.target.value)} disabled={!canEdit} />
          </div>
          <div className="space-y-1 text-sm text-gray-700 md:col-span-2">
            <span className="text-xs font-medium uppercase tracking-wide text-gray-500">Title</span>
            <input className={inputCls} value={sections.hero.title} onChange={(e) => updateHero('title', e.target.value)} disabled={!canEdit} />
          </div>
          <div className="space-y-1 text-sm text-gray-700 md:col-span-2">
            <span className="text-xs font-medium uppercase tracking-wide text-gray-500">Subtitle</span>
            <textarea className={textareaCls} rows={2} value={sections.hero.subtitle} onChange={(e) => updateHero('subtitle', e.target.value)} disabled={!canEdit} />
          </div>
          <div className="space-y-1 text-sm text-gray-700">
            <span className="text-xs font-medium uppercase tracking-wide text-gray-500">CTA link</span>
            <input className={inputCls} value={sections.hero.cta_link} onChange={(e) => updateHero('cta_link', e.target.value)} disabled={!canEdit} />
          </div>
        </div>
      </SectionCard>

      {/* Gallery */}
      {renderMediaSection('gallery')}

      {/* Service Menu */}
      {renderMediaSection('service_menu')}

      {/* FAQ */}
      <SectionCard
        sectionKey="faqs"
        title="FAQ section"
        description="Pairs each question with an expandable answer."
        active={sections.faqs.is_active}
        onToggle={(value) => setSections((prev) => ({ ...prev, faqs: { ...prev.faqs, is_active: value } }))}
        canUpdate={canEdit}
        collapsed={collapsedSections.faqs ?? false}
        onToggleCollapse={() => toggleSectionCollapsed('faqs')}
      >
        <SectionHeadingFields
          heading={sections.faqs.heading}
          onChange={(heading) => setSections((prev) => ({ ...prev, faqs: { ...prev.faqs, heading } }))}
          canUpdate={canEdit}
        />
        <div className="mt-4 space-y-3">
          {sections.faqs.items.map((item, idx) => (
            <div key={idx} className="rounded-lg border border-gray-100 bg-gray-50/60 p-3">
              <div className="mb-2 flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wide text-gray-400">Item {idx + 1}</span>
                <button
                  type="button"
                  onClick={() => removeFaqItem(idx)}
                  disabled={!canEdit}
                  className="rounded border border-red-200 px-2 py-1 text-xs text-red-600 hover:bg-red-50 disabled:opacity-50"
                >
                  <i className="fa-solid fa-trash" />
                </button>
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                <input className={inputCls} value={item.question} onChange={(e) => updateFaqItem(idx, 'question', e.target.value)} disabled={!canEdit} placeholder="Question" />
                <input className={inputCls} value={item.answer} onChange={(e) => updateFaqItem(idx, 'answer', e.target.value)} disabled={!canEdit} placeholder="Answer" />
              </div>
            </div>
          ))}
          <button
            type="button"
            onClick={addFaqItem}
            disabled={!canEdit}
            className="inline-flex items-center gap-2 rounded border border-indigo-600 bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <i className="fa-solid fa-plus" />
            Add item
          </button>
        </div>
      </SectionCard>

      {/* Notes */}
      <SectionCard
        sectionKey="notes"
        title="Notes section"
        description="Shows the policy & care notes list."
        active={sections.notes.is_active}
        onToggle={(value) => setSections((prev) => ({ ...prev, notes: { ...prev.notes, is_active: value } }))}
        canUpdate={canEdit}
        collapsed={collapsedSections.notes ?? false}
        onToggleCollapse={() => toggleSectionCollapsed('notes')}
      >
        <SectionHeadingFields
          heading={sections.notes.heading}
          onChange={(heading) => setSections((prev) => ({ ...prev, notes: { ...prev.notes, heading } }))}
          canUpdate={canEdit}
        />
        <div className="mt-4 space-y-3">
          {sections.notes.items.map((note, idx) => (
            <div key={idx} className="flex gap-2 items-start">
              <div className="flex-1">
                <textarea className={textareaCls} rows={2} value={note} onChange={(e) => updateNoteItem(idx, e.target.value)} disabled={!canEdit} />
              </div>
              <button
                type="button"
                onClick={() => removeNoteItem(idx)}
                disabled={!canEdit}
                className="rounded border border-red-200 px-2 py-1 text-xs text-red-600 hover:bg-red-50 disabled:opacity-50"
                title="Remove"
              >
                <i className="fa-solid fa-trash" />
              </button>
            </div>
          ))}
          <button
            type="button"
            onClick={addNoteItem}
            disabled={!canEdit}
            className="inline-flex items-center gap-2 rounded border border-indigo-600 bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <i className="fa-solid fa-plus" />
            Add item
          </button>
        </div>
      </SectionCard>

      {/* Save Button */}
      {canEdit && (
        <div className="flex justify-end pb-10">
          <button
            type="button"
            onClick={() => void handleSave()}
            disabled={saving}
            className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-6 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 disabled:opacity-50 transition"
          >
            {saving ? (
              <>
                <i className="fa-solid fa-spinner fa-spin text-xs" />
                Saving…
              </>
            ) : (
              <>
                <i className="fa-solid fa-floppy-disk text-xs" />
                Save All Changes
              </>
            )}
          </button>
        </div>
      )}
    </div>
  )
}

function SectionCard({
  sectionKey,
  title,
  description,
  active,
  onToggle,
  canUpdate,
  children,
  collapsed,
  onToggleCollapse,
}: {
  sectionKey: string
  title: string
  description: string
  active: boolean
  onToggle: (value: boolean) => void
  canUpdate: boolean
  children: ReactNode
  collapsed: boolean
  onToggleCollapse: () => void
}) {
  return (
    <section className="rounded-lg border border-gray-200 bg-white p-6">
      <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div className="space-y-1">
          <h3 className="text-base font-semibold text-gray-900">{title}</h3>
          <p className="text-xs text-gray-500">{description}</p>
        </div>
        <div className="flex items-center justify-between gap-2 md:justify-end">
          <label className="inline-flex items-center gap-2 text-sm text-gray-700">
            <input
              type="checkbox"
              checked={active}
              onChange={(e) => onToggle(e.target.checked)}
              disabled={!canUpdate}
              className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            Enabled
          </label>
          <button
            type="button"
            onClick={onToggleCollapse}
            aria-expanded={!collapsed}
            aria-controls={`${sectionKey}-section-content`}
            className="rounded border border-gray-300 px-2 py-1 text-xs text-gray-600 hover:bg-gray-50"
          >
            <i className={`fa-solid ${collapsed ? 'fa-chevron-down' : 'fa-chevron-up'}`} />
          </button>
        </div>
      </div>
      {!collapsed && <div id={`${sectionKey}-section-content`}>{children}</div>}
    </section>
  )
}

function SectionHeadingFields({
  heading,
  onChange,
  canUpdate,
}: {
  heading: HeadingConfig
  onChange: (heading: HeadingConfig) => void
  canUpdate: boolean
}) {
  return (
    <div className="space-y-3">
      <div className="grid gap-3 md:grid-cols-3">
        <label className="space-y-1 text-xs uppercase tracking-wide text-gray-500">
          <span className="font-medium">Label</span>
          <input
            value={heading.label}
            onChange={(e) => onChange({ ...heading, label: e.target.value })}
            placeholder="Label"
            className="w-full rounded border border-gray-300 px-3 py-2 text-sm text-gray-700 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            disabled={!canUpdate}
          />
        </label>
        <label className="space-y-1 text-xs uppercase tracking-wide text-gray-500 md:col-span-2">
          <span className="font-medium">Title</span>
          <input
            value={heading.title}
            onChange={(e) => onChange({ ...heading, title: e.target.value })}
            placeholder="Title"
            className="w-full rounded border border-gray-300 px-3 py-2 text-sm text-gray-700 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            disabled={!canUpdate}
          />
        </label>
      </div>
      <div className="grid gap-3 md:grid-cols-1">
        <label className="space-y-1 text-xs uppercase tracking-wide text-gray-500">
          <span className="font-medium">Alignment</span>
          <select
            value={heading.align}
            onChange={(e) => onChange({ ...heading, align: e.target.value as HeadingConfig['align'] })}
            className="w-full rounded border border-gray-300 px-3 py-2 text-sm text-gray-700 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            disabled={!canUpdate}
          >
            <option value="left">Left</option>
            <option value="center">Center</option>
            <option value="right">Right</option>
          </select>
        </label>
      </div>
    </div>
  )
}
