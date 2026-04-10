'use client'

import { useCallback, useEffect, useState } from 'react'

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

  const handleImageUpload = async (
    sectionKey: 'gallery' | 'service_menu',
    index: number,
    file: File,
  ) => {
    const url = await uploadImage(file, sectionKey)
    if (!url) return
    setSections((prev) => {
      const items = [...prev[sectionKey].items]
      items[index] = { ...items[index], src: url }
      return { ...prev, [sectionKey]: { ...prev[sectionKey], items } }
    })
  }

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
    setSections((prev) => ({
      ...prev,
      [sectionKey]: {
        ...prev[sectionKey],
        items: [...prev[sectionKey].items, { src: '', caption: '' }],
      },
    }))
  }

  const removeGalleryItem = (sectionKey: 'gallery' | 'service_menu', index: number) => {
    setSections((prev) => ({
      ...prev,
      [sectionKey]: {
        ...prev[sectionKey],
        items: prev[sectionKey].items.filter((_, i) => i !== index),
      },
    }))
  }

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

  if (loading) {
    return <div className="text-sm text-gray-500 py-12 text-center">Loading landing page data…</div>
  }

  const inputCls =
    'w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none'
  const textareaCls =
    'w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none resize-y'
  const cardCls = 'rounded-xl border border-gray-200 bg-white p-5 shadow-sm'
  const labelCls = 'block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1'

  const renderGallerySection = (sectionKey: 'gallery' | 'service_menu', label: string) => {
    const section = sections[sectionKey]
    return (
      <div className={cardCls}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-800">{label}</h3>
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input
              type="checkbox"
              checked={section.is_active}
              onChange={() => toggleSection(sectionKey)}
              disabled={!canEdit}
              className="rounded"
            />
            Active
          </label>
        </div>

        <div className="grid gap-3 sm:grid-cols-3 mb-4">
          <div>
            <label className={labelCls}>Heading Label</label>
            <input
              className={inputCls}
              value={section.heading.label}
              onChange={(e) => updateHeading(sectionKey, 'label', e.target.value)}
              disabled={!canEdit}
            />
          </div>
          <div>
            <label className={labelCls}>Heading Title</label>
            <input
              className={inputCls}
              value={section.heading.title}
              onChange={(e) => updateHeading(sectionKey, 'title', e.target.value)}
              disabled={!canEdit}
            />
          </div>
          <div>
            <label className={labelCls}>Align</label>
            <select
              className={inputCls}
              value={section.heading.align}
              onChange={(e) => updateHeading(sectionKey, 'align', e.target.value)}
              disabled={!canEdit}
            >
              <option value="left">Left</option>
              <option value="center">Center</option>
              <option value="right">Right</option>
            </select>
          </div>
        </div>

        <div className="space-y-3">
          {section.items.map((item, idx) => (
            <div key={idx} className="flex items-start gap-3 p-3 rounded-lg bg-gray-50 border border-gray-100">
              <div className="flex-1 space-y-2">
                <div className="flex gap-2">
                  <div className="flex-1">
                    <label className={labelCls}>Image URL / Path</label>
                    <input
                      className={inputCls}
                      value={item.src}
                      onChange={(e) => updateGalleryItem(sectionKey, idx, 'src', e.target.value)}
                      placeholder="/images/example.webp"
                      disabled={!canEdit}
                    />
                  </div>
                  {canEdit && (
                    <div className="pt-5">
                      <label className="inline-flex items-center gap-1.5 rounded-lg bg-blue-50 px-3 py-2 text-xs font-medium text-blue-700 cursor-pointer hover:bg-blue-100 transition">
                        <i className="fa-solid fa-upload text-[10px]" />
                        Upload
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={(e) => {
                            const file = e.target.files?.[0]
                            if (file) void handleImageUpload(sectionKey, idx, file)
                          }}
                        />
                      </label>
                    </div>
                  )}
                </div>
                <div>
                  <label className={labelCls}>Caption</label>
                  <input
                    className={inputCls}
                    value={item.caption}
                    onChange={(e) => updateGalleryItem(sectionKey, idx, 'caption', e.target.value)}
                    disabled={!canEdit}
                  />
                </div>
              </div>
              {item.src && (
                <div className="w-16 h-20 rounded-lg overflow-hidden border border-gray-200 bg-gray-100 flex-shrink-0">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={item.src} alt={item.caption || ''} className="w-full h-full object-cover" />
                </div>
              )}
              {canEdit && (
                <button
                  type="button"
                  onClick={() => removeGalleryItem(sectionKey, idx)}
                  className="mt-5 text-red-400 hover:text-red-600 text-sm"
                  title="Remove"
                >
                  <i className="fa-solid fa-trash" />
                </button>
              )}
            </div>
          ))}
        </div>

        {canEdit && (
          <button
            type="button"
            onClick={() => addGalleryItem(sectionKey)}
            className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-gray-100 px-4 py-2 text-xs font-medium text-gray-700 hover:bg-gray-200 transition"
          >
            <i className="fa-solid fa-plus text-[10px]" />
            Add Image
          </button>
        )}
      </div>
    )
  }

  return (
    <div className="space-y-6 max-w-4xl">
      {message && (
        <div className="rounded-lg bg-green-50 border border-green-200 px-4 py-3 text-sm text-green-700">
          {message}
        </div>
      )}
      {error && (
        <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">{error}</div>
      )}

      {/* Hero Section */}
      <div className={cardCls}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-800">Hero Section</h3>
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input
              type="checkbox"
              checked={sections.hero.is_active}
              onChange={() => toggleSection('hero')}
              disabled={!canEdit}
              className="rounded"
            />
            Active
          </label>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className={labelCls}>Label</label>
            <input className={inputCls} value={sections.hero.label} onChange={(e) => updateHero('label', e.target.value)} disabled={!canEdit} />
          </div>
          <div>
            <label className={labelCls}>CTA Button Label</label>
            <input className={inputCls} value={sections.hero.cta_label} onChange={(e) => updateHero('cta_label', e.target.value)} disabled={!canEdit} />
          </div>
          <div className="sm:col-span-2">
            <label className={labelCls}>Title</label>
            <input className={inputCls} value={sections.hero.title} onChange={(e) => updateHero('title', e.target.value)} disabled={!canEdit} />
          </div>
          <div className="sm:col-span-2">
            <label className={labelCls}>Subtitle</label>
            <textarea className={textareaCls} rows={2} value={sections.hero.subtitle} onChange={(e) => updateHero('subtitle', e.target.value)} disabled={!canEdit} />
          </div>
          <div>
            <label className={labelCls}>CTA Link</label>
            <input className={inputCls} value={sections.hero.cta_link} onChange={(e) => updateHero('cta_link', e.target.value)} disabled={!canEdit} />
          </div>
        </div>
      </div>

      {/* Gallery */}
      {renderGallerySection('gallery', 'Gallery Section')}

      {/* Service Menu */}
      {renderGallerySection('service_menu', 'Service Menu Section')}

      {/* FAQ */}
      <div className={cardCls}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-800">FAQ Section</h3>
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input
              type="checkbox"
              checked={sections.faqs.is_active}
              onChange={() => toggleSection('faqs')}
              disabled={!canEdit}
              className="rounded"
            />
            Active
          </label>
        </div>

        <div className="grid gap-3 sm:grid-cols-3 mb-4">
          <div>
            <label className={labelCls}>Heading Label</label>
            <input className={inputCls} value={sections.faqs.heading.label} onChange={(e) => updateHeading('faqs', 'label', e.target.value)} disabled={!canEdit} />
          </div>
          <div>
            <label className={labelCls}>Heading Title</label>
            <input className={inputCls} value={sections.faqs.heading.title} onChange={(e) => updateHeading('faqs', 'title', e.target.value)} disabled={!canEdit} />
          </div>
          <div>
            <label className={labelCls}>Align</label>
            <select className={inputCls} value={sections.faqs.heading.align} onChange={(e) => updateHeading('faqs', 'align', e.target.value)} disabled={!canEdit}>
              <option value="left">Left</option>
              <option value="center">Center</option>
              <option value="right">Right</option>
            </select>
          </div>
        </div>

        <div className="space-y-3">
          {sections.faqs.items.map((item, idx) => (
            <div key={idx} className="p-3 rounded-lg bg-gray-50 border border-gray-100 space-y-2">
              <div className="flex gap-2">
                <div className="flex-1">
                  <label className={labelCls}>Question</label>
                  <input className={inputCls} value={item.question} onChange={(e) => updateFaqItem(idx, 'question', e.target.value)} disabled={!canEdit} />
                </div>
                {canEdit && (
                  <button type="button" onClick={() => removeFaqItem(idx)} className="mt-5 text-red-400 hover:text-red-600 text-sm" title="Remove">
                    <i className="fa-solid fa-trash" />
                  </button>
                )}
              </div>
              <div>
                <label className={labelCls}>Answer</label>
                <textarea className={textareaCls} rows={3} value={item.answer} onChange={(e) => updateFaqItem(idx, 'answer', e.target.value)} disabled={!canEdit} />
              </div>
            </div>
          ))}
        </div>

        {canEdit && (
          <button type="button" onClick={addFaqItem} className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-gray-100 px-4 py-2 text-xs font-medium text-gray-700 hover:bg-gray-200 transition">
            <i className="fa-solid fa-plus text-[10px]" />
            Add FAQ
          </button>
        )}
      </div>

      {/* Notes */}
      <div className={cardCls}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-800">Policy & Notes Section</h3>
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input
              type="checkbox"
              checked={sections.notes.is_active}
              onChange={() => toggleSection('notes')}
              disabled={!canEdit}
              className="rounded"
            />
            Active
          </label>
        </div>

        <div className="grid gap-3 sm:grid-cols-3 mb-4">
          <div>
            <label className={labelCls}>Heading Label</label>
            <input className={inputCls} value={sections.notes.heading.label} onChange={(e) => updateHeading('notes', 'label', e.target.value)} disabled={!canEdit} />
          </div>
          <div>
            <label className={labelCls}>Heading Title</label>
            <input className={inputCls} value={sections.notes.heading.title} onChange={(e) => updateHeading('notes', 'title', e.target.value)} disabled={!canEdit} />
          </div>
          <div>
            <label className={labelCls}>Align</label>
            <select className={inputCls} value={sections.notes.heading.align} onChange={(e) => updateHeading('notes', 'align', e.target.value)} disabled={!canEdit}>
              <option value="left">Left</option>
              <option value="center">Center</option>
              <option value="right">Right</option>
            </select>
          </div>
        </div>

        <div className="space-y-3">
          {sections.notes.items.map((note, idx) => (
            <div key={idx} className="flex gap-2 items-start">
              <div className="flex-1">
                <textarea className={textareaCls} rows={2} value={note} onChange={(e) => updateNoteItem(idx, e.target.value)} disabled={!canEdit} />
              </div>
              {canEdit && (
                <button type="button" onClick={() => removeNoteItem(idx)} className="mt-1 text-red-400 hover:text-red-600 text-sm" title="Remove">
                  <i className="fa-solid fa-trash" />
                </button>
              )}
            </div>
          ))}
        </div>

        {canEdit && (
          <button type="button" onClick={addNoteItem} className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-gray-100 px-4 py-2 text-xs font-medium text-gray-700 hover:bg-gray-200 transition">
            <i className="fa-solid fa-plus text-[10px]" />
            Add Note
          </button>
        )}
      </div>

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
