'use client'

import type { ReactNode } from 'react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

type HeadingConfig = { label: string; title: string; align: 'left' | 'center' | 'right' }
type GalleryItem = { src: string; caption: string }
type ArtistItem = { src: string; caption: string; text: string; text_align: 'left' | 'center' | 'right'; link_url: string }
type NailAcademyItem = {
  src: string
  duration_badge: string
  title: string
  target_audience: string
  curriculum: string[]
  details_link: string
  details_label: string
  text_align: 'left' | 'center' | 'right'
}
type FaqItem = { question: string; answer: string }
type OpeningHoursRow = { day_range: string; time_range: string }

type Sections = {
  hero: {
    is_active: boolean
    label: string
    title: string
    subtitle: string
    title_2: string
    subtitle_2: string
    cta_label: string
    cta_link: string
    decorations_enabled: boolean
  }
  gallery: { is_active: boolean; heading: HeadingConfig; items: GalleryItem[] }
  service_menu: { is_active: boolean; heading: HeadingConfig; items: GalleryItem[] }
  our_artists: { is_active: boolean; heading: HeadingConfig; items: ArtistItem[] }
  nail_academy: {
    is_active: boolean
    heading: HeadingConfig
    target_label: string
    curriculum_label: string
    items: NailAcademyItem[]
  }
  faqs: { is_active: boolean; heading: HeadingConfig; items: FaqItem[] }
  notes: { is_active: boolean; heading: HeadingConfig; items: string[] }
  visit_studio: {
    is_active: boolean
    heading: HeadingConfig
    studio_name: string
    address: string
    google_maps_url: string
    waze_url: string
    whatsapp_phone: string
    whatsapp_message: string
    google_maps_label: string
    waze_label: string
    whatsapp_label: string
    opening_hours_heading: string
    opening_hours: OpeningHoursRow[]
    bottom_label: string
    column_order: 'contact_left' | 'hours_left'
  }
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
    title_2: '',
    subtitle_2: '',
    cta_label: 'Book Appointment',
    cta_link: '/booking',
    decorations_enabled: true,
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
  our_artists: {
    is_active: true,
    heading: { label: 'Our Artists', title: 'Meet our creative professionals', align: 'center' },
    items: [],
  },
  nail_academy: {
    is_active: true,
    heading: {
      label: 'EXCELLENCE IN JAPANESE NAIL ART EDUCATION',
      title: 'Nail Academy',
      align: 'center',
    },
    target_label: '面向对象',
    curriculum_label: '教学核心',
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
  visit_studio: {
    is_active: true,
    heading: { label: '', title: 'Visit Our Studio', align: 'left' },
    studio_name: '',
    address: '',
    google_maps_url: '',
    waze_url: '',
    whatsapp_phone: '',
    whatsapp_message: 'Hi! I would like to get in touch about your salon services.',
    google_maps_label: 'GOOGLE MAPS',
    waze_label: 'OPEN WAZE',
    whatsapp_label: 'MESSAGE US ON WHATSAPP',
    opening_hours_heading: 'Opening Hours',
    opening_hours: [],
    bottom_label: '',
    column_order: 'contact_left',
  },
}

function asText(value: unknown, fallback = ''): string {
  if (value == null) return fallback
  return String(value)
}

function createEmptyNailAcademyItem(): NailAcademyItem {
  return {
    src: '',
    duration_badge: '',
    title: '',
    target_audience: '',
    curriculum: [],
    details_link: '',
    details_label: 'CLICK FOR MORE DETAILS →',
    text_align: 'left',
  }
}

function parseCurriculumFromUnknown(raw: unknown): string[] {
  if (Array.isArray(raw)) {
    return raw.map((x) => String(x).trim()).filter((x) => x.length > 0)
  }
  if (typeof raw === 'string') {
    return raw
      .split('\n')
      .map((s) => s.trim())
      .filter((s) => s.length > 0)
  }
  return []
}

function normalizeNailAcademyItem(raw: Record<string, unknown>): NailAcademyItem {
  const base = createEmptyNailAcademyItem()
  const align = raw.text_align === 'center' || raw.text_align === 'right' ? raw.text_align : 'left'
  return {
    ...base,
    src: asText(raw.src),
    duration_badge: asText(raw.duration_badge),
    title: asText(raw.title),
    target_audience: asText(raw.target_audience),
    curriculum: parseCurriculumFromUnknown(raw.curriculum),
    details_link: asText(raw.details_link),
    details_label: asText(raw.details_label, base.details_label),
    text_align: align,
  }
}

function normalizeNailAcademySection(raw: unknown): Sections['nail_academy'] {
  const base = defaultSections.nail_academy
  if (!raw || typeof raw !== 'object') return base
  const o = raw as Record<string, unknown>
  const heading =
    o.heading && typeof o.heading === 'object'
      ? { ...base.heading, ...(o.heading as HeadingConfig) }
      : base.heading
  const items = Array.isArray(o.items)
    ? o.items.map((it) =>
        normalizeNailAcademyItem((it && typeof it === 'object' ? it : {}) as Record<string, unknown>),
      )
    : base.items
  return {
    ...base,
    heading,
    target_label: asText(o.target_label, base.target_label),
    curriculum_label: asText(o.curriculum_label, base.curriculum_label),
    items,
    is_active: Boolean(o.is_active ?? base.is_active),
  }
}

/** Migrate older saves that used separate legal fields into one bottom_label. */
function composeBottomLabelFromLegacyFields(o: Record<string, unknown>): string {
  const ob = String(o.operated_by ?? '').trim()
  const reg = String(o.registration_number ?? '').trim()
  const cy = String(o.copyright_year ?? '').trim()
  const cb = String(o.copyright_brand ?? '').trim()
  const lines: string[] = []
  if (ob || reg) {
    let l = 'Operated by'
    if (ob) l += ` ${ob}`
    if (reg) l += ` (${reg})`
    lines.push(l)
  }
  if (cy || cb) {
    const y = cy || String(new Date().getFullYear())
    lines.push(`© ${y}${cb ? ` ${cb}` : ''}`.trim())
  }
  return lines.join('\n')
}

function extractPhoneFromWhatsAppUrl(url: string): string {
  const trimmed = url.trim()
  if (!trimmed) return ''
  const waMe = trimmed.match(/wa\.me\/(\d+)/i)
  if (waMe?.[1]) return waMe[1]
  const apiPhone = trimmed.match(/[?&]phone=(\d+)/i)
  if (apiPhone?.[1]) return apiPhone[1]
  if (/^[\d+\s\-()]+$/.test(trimmed)) {
    return trimmed.replace(/[^\d+]/g, '')
  }
  return ''
}

function extractMessageFromWhatsAppUrl(url: string): string {
  const trimmed = url.trim()
  if (!trimmed) return ''
  try {
    const parsed = new URL(trimmed.startsWith('http') ? trimmed : `https://${trimmed}`)
    const text = parsed.searchParams.get('text')
    return text ? decodeURIComponent(text.replace(/\+/g, ' ')) : ''
  } catch {
    return ''
  }
}

function normalizeVisitStudioFromApi(raw: unknown): Sections['visit_studio'] {
  const base = defaultSections.visit_studio
  if (!raw || typeof raw !== 'object') return base
  const o = raw as Record<string, unknown>
  const oh = Array.isArray(o.opening_hours)
    ? o.opening_hours.map((row) => ({
        day_range: String((row as Record<string, unknown>).day_range ?? ''),
        time_range: String((row as Record<string, unknown>).time_range ?? ''),
      }))
    : base.opening_hours
  const heading =
    o.heading && typeof o.heading === 'object'
      ? { ...base.heading, ...(o.heading as HeadingConfig) }
      : base.heading
  const column_order = o.column_order === 'hours_left' ? 'hours_left' : 'contact_left'
  let bottom_label = String(o.bottom_label ?? '').trim()
  if (!bottom_label) {
    bottom_label = composeBottomLabelFromLegacyFields(o)
  }
  const legacyUrl = String(o.whatsapp_url ?? '').trim()
  let whatsapp_phone = String(o.whatsapp_phone ?? '').trim()
  let whatsapp_message = String(o.whatsapp_message ?? '').trim()
  if (!whatsapp_phone && legacyUrl) {
    whatsapp_phone = extractPhoneFromWhatsAppUrl(legacyUrl)
  }
  if (!whatsapp_message) {
    const fromUrl = legacyUrl ? extractMessageFromWhatsAppUrl(legacyUrl) : ''
    whatsapp_message = fromUrl || base.whatsapp_message
  }
  return {
    ...base,
    heading,
    opening_hours: oh,
    column_order,
    studio_name: String(o.studio_name ?? ''),
    address: String(o.address ?? ''),
    google_maps_url: String(o.google_maps_url ?? ''),
    waze_url: String(o.waze_url ?? ''),
    whatsapp_phone,
    whatsapp_message,
    google_maps_label: String(o.google_maps_label ?? base.google_maps_label),
    waze_label: String(o.waze_label ?? base.waze_label),
    whatsapp_label: String(o.whatsapp_label ?? base.whatsapp_label),
    opening_hours_heading: String(o.opening_hours_heading ?? base.opening_hours_heading),
    bottom_label,
    is_active: Boolean(o.is_active ?? base.is_active),
  }
}

function mergeSectionsFromApi(raw: Partial<Sections> & Record<string, unknown>): Sections {
  const merged = { ...defaultSections, ...raw } as Sections
  const hero = raw.hero as Partial<Sections['hero']> | undefined
  if (hero) {
    merged.hero = {
      ...defaultSections.hero,
      ...hero,
      title_2: String(hero.title_2 ?? ''),
      subtitle_2: String(hero.subtitle_2 ?? ''),
      decorations_enabled:
        typeof hero.decorations_enabled === 'boolean' ? hero.decorations_enabled : defaultSections.hero.decorations_enabled,
    }
  }
  const na = raw.nail_academy
  if (na !== undefined) {
    merged.nail_academy = normalizeNailAcademySection(na)
  }
  if (raw.visit_studio !== undefined) {
    merged.visit_studio = normalizeVisitStudioFromApi(raw.visit_studio)
  }
  return merged
}

export default function BookingLandingPageEditor({ canEdit }: { canEdit: boolean }) {
  const [data, setData] = useState<LandingPageData | null>(null)
  const [sections, setSections] = useState<Sections>(defaultSections)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [saveToast, setSaveToast] = useState<{ tone: 'success' | 'error'; text: string } | null>(null)
  const [collapsedSections, setCollapsedSections] = useState<Record<string, boolean>>({})
  const [galleryPreviews, setGalleryPreviews] = useState<(string | null)[]>([])
  const [serviceMenuPreviews, setServiceMenuPreviews] = useState<(string | null)[]>([])
  const [artistsPreviews, setArtistsPreviews] = useState<(string | null)[]>([])
  const [nailAcademyPreviews, setNailAcademyPreviews] = useState<(string | null)[]>([])
  const galleryImageInputRefs = useRef<Map<number, HTMLInputElement>>(new Map())
  const serviceMenuImageInputRefs = useRef<Map<number, HTMLInputElement>>(new Map())
  const artistsImageInputRefs = useRef<Map<number, HTMLInputElement>>(new Map())
  const nailAcademyImageInputRefs = useRef<Map<number, HTMLInputElement>>(new Map())

  const fetchData = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/proxy/admin/booking/landing-page')
      const json = await res.json()
      const pageData = json?.data ?? json
      setData(pageData)
      if (pageData?.sections) {
        setSections(mergeSectionsFromApi(pageData.sections))
        const galleryCount = Array.isArray(pageData.sections?.gallery?.items) ? pageData.sections.gallery.items.length : 0
        const serviceMenuCount = Array.isArray(pageData.sections?.service_menu?.items) ? pageData.sections.service_menu.items.length : 0
        const artistsCount = Array.isArray(pageData.sections?.our_artists?.items) ? pageData.sections.our_artists.items.length : 0
        const nailCount = Array.isArray(pageData.sections?.nail_academy?.items) ? pageData.sections.nail_academy.items.length : 0
        setGalleryPreviews(Array(galleryCount).fill(null))
        setServiceMenuPreviews(Array(serviceMenuCount).fill(null))
        setArtistsPreviews(Array(artistsCount).fill(null))
        setNailAcademyPreviews(Array(nailCount).fill(null))
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

  useEffect(() => {
    if (!saveToast) return
    const timer = window.setTimeout(() => setSaveToast(null), saveToast.tone === 'success' ? 4000 : 6000)
    return () => window.clearTimeout(timer)
  }, [saveToast])

  const handleSave = async () => {
    setSaving(true)
    setMessage(null)
    setError(null)
    setSaveToast(null)
    const payload = {
      ...sections,
      nail_academy: normalizeNailAcademySection(sections.nail_academy),
      visit_studio: normalizeVisitStudioFromApi(sections.visit_studio),
    }
    try {
      const res = await fetch('/api/proxy/admin/booking/landing-page', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sections: payload }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json?.message || 'Save failed')
      const pageData = json?.data ?? json
      setData(pageData)
      if (pageData?.sections) {
        setSections(mergeSectionsFromApi(pageData.sections))
        const galleryCount = Array.isArray(pageData.sections?.gallery?.items) ? pageData.sections.gallery.items.length : 0
        const serviceMenuCount = Array.isArray(pageData.sections?.service_menu?.items) ? pageData.sections.service_menu.items.length : 0
        const artistsCount = Array.isArray(pageData.sections?.our_artists?.items) ? pageData.sections.our_artists.items.length : 0
        const nailCount = Array.isArray(pageData.sections?.nail_academy?.items) ? pageData.sections.nail_academy.items.length : 0
        setGalleryPreviews(Array(galleryCount).fill(null))
        setServiceMenuPreviews(Array(serviceMenuCount).fill(null))
        setArtistsPreviews(Array(artistsCount).fill(null))
        setNailAcademyPreviews(Array(nailCount).fill(null))
      }
      setMessage('Landing page saved successfully!')
      setSaveToast({ tone: 'success', text: 'Landing page saved successfully!' })
    } catch (err) {
      const saveError = err instanceof Error ? err.message : 'Failed to save'
      setError(saveError)
      setSaveToast({ tone: 'error', text: saveError })
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
    sectionKey: 'gallery' | 'service_menu' | 'our_artists',
    index: number,
    file: File,
  ) => {
    const previewUrl = URL.createObjectURL(file)
    const setPreviews =
      sectionKey === 'gallery'
        ? setGalleryPreviews
        : sectionKey === 'our_artists'
          ? setArtistsPreviews
          : setServiceMenuPreviews
    setPreviews((prev) => {
      const next = ensureArrayLength(prev, index + 1)
      next[index] = previewUrl
      return next
    })

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
    sectionKey: 'gallery' | 'service_menu' | 'our_artists',
    index: number,
    field: string,
    value: string,
  ) => {
    setSections((prev) => {
      const items = [...prev[sectionKey].items]
      items[index] = { ...items[index], [field]: value }
      return { ...prev, [sectionKey]: { ...prev[sectionKey], items } }
    })
  }

  const addGalleryItem = (sectionKey: 'gallery' | 'service_menu' | 'our_artists') => {
    setSections((prev) => {
      const next = {
        ...prev,
        [sectionKey]: {
          ...prev[sectionKey],
          items: [...prev[sectionKey].items, sectionKey === 'our_artists'
            ? { src: '', caption: '', text: '', text_align: 'center', link_url: '' }
            : { src: '', caption: '' }],
        },
      }
      return next
    })
    if (sectionKey === 'gallery') {
      setGalleryPreviews((prev) => [...prev, null])
    } else if (sectionKey === 'our_artists') {
      setArtistsPreviews((prev) => [...prev, null])
    } else {
      setServiceMenuPreviews((prev) => [...prev, null])
    }
  }

  const removeGalleryItem = (sectionKey: 'gallery' | 'service_menu' | 'our_artists', index: number) => {
    setSections((prev) => ({
      ...prev,
      [sectionKey]: {
        ...prev[sectionKey],
        items: prev[sectionKey].items.filter((_, i) => i !== index),
      },
    }))
    if (sectionKey === 'gallery') {
      setGalleryPreviews((prev) => prev.filter((_, i) => i !== index))
    } else if (sectionKey === 'our_artists') {
      setArtistsPreviews((prev) => prev.filter((_, i) => i !== index))
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

  const moveGalleryItem = useCallback((sectionKey: 'gallery' | 'service_menu' | 'our_artists', index: number, direction: -1 | 1) => {
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
    } else if (sectionKey === 'our_artists') {
      setArtistsPreviews((prev) => {
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

  const handleNailAcademyImageUpload = async (index: number, file: File) => {
    const previewUrl = URL.createObjectURL(file)
    setNailAcademyPreviews((prev) => {
      const next = ensureArrayLength(prev, index + 1)
      next[index] = previewUrl
      return next
    })
    const url = await uploadImage(file, 'nail_academy')
    if (!url) return
    setSections((prev) => {
      const items = [...prev.nail_academy.items]
      while (items.length <= index) {
        items.push(createEmptyNailAcademyItem())
      }
      const existing = items[index] ?? createEmptyNailAcademyItem()
      items[index] = { ...createEmptyNailAcademyItem(), ...existing, src: url }
      return { ...prev, nail_academy: { ...prev.nail_academy, items } }
    })
  }

  const updateNailAcademyItem = (index: number, partial: Partial<NailAcademyItem>) => {
    setSections((prev) => {
      const items = [...prev.nail_academy.items]
      const existing = items[index] ?? createEmptyNailAcademyItem()
      items[index] = { ...createEmptyNailAcademyItem(), ...existing, ...partial }
      return { ...prev, nail_academy: { ...prev.nail_academy, items } }
    })
  }

  const moveNailAcademyItem = useCallback(
    (index: number, direction: -1 | 1) => {
      setSections((prev) => {
        const targetIndex = index + direction
        const section = prev.nail_academy
        if (targetIndex < 0 || targetIndex >= section.items.length) return prev
        const items = reorder(section.items, index, targetIndex)
        return { ...prev, nail_academy: { ...section, items } }
      })
      setNailAcademyPreviews((prev) => {
        const targetIndex = index + direction
        if (targetIndex < 0 || targetIndex >= prev.length) return prev
        return reorder(prev, index, targetIndex)
      })
    },
    [reorder],
  )

  const addNailAcademyItem = () => {
    setSections((prev) => ({
      ...prev,
      nail_academy: {
        ...prev.nail_academy,
        items: [...prev.nail_academy.items, createEmptyNailAcademyItem()],
      },
    }))
    setNailAcademyPreviews((prev) => [...prev, null])
  }

  const removeNailAcademyItem = (index: number) => {
    setSections((prev) => ({
      ...prev,
      nail_academy: {
        ...prev.nail_academy,
        items: prev.nail_academy.items.filter((_, i) => i !== index),
      },
    }))
    setNailAcademyPreviews((prev) => prev.filter((_, i) => i !== index))
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

  const updateVisitStudio = (partial: Partial<Sections['visit_studio']>) => {
    setSections((prev) => ({
      ...prev,
      visit_studio: { ...prev.visit_studio, ...partial },
    }))
  }

  const updateOpeningHourRow = (index: number, field: keyof OpeningHoursRow, value: string) => {
    setSections((prev) => {
      const rows = [...prev.visit_studio.opening_hours]
      rows[index] = { ...rows[index], [field]: value }
      return { ...prev, visit_studio: { ...prev.visit_studio, opening_hours: rows } }
    })
  }

  const addOpeningHourRow = () => {
    setSections((prev) => ({
      ...prev,
      visit_studio: {
        ...prev.visit_studio,
        opening_hours: [...prev.visit_studio.opening_hours, { day_range: '', time_range: '' }],
      },
    }))
  }

  const removeOpeningHourRow = (index: number) => {
    setSections((prev) => ({
      ...prev,
      visit_studio: {
        ...prev.visit_studio,
        opening_hours: prev.visit_studio.opening_hours.filter((_, i) => i !== index),
      },
    }))
  }

  const moveOpeningHourRow = (index: number, direction: -1 | 1) => {
    setSections((prev) => {
      const targetIndex = index + direction
      const rows = prev.visit_studio.opening_hours
      if (targetIndex < 0 || targetIndex >= rows.length) return prev
      const next = [...rows]
      const [moved] = next.splice(index, 1)
      next.splice(targetIndex, 0, moved)
      return { ...prev, visit_studio: { ...prev.visit_studio, opening_hours: next } }
    })
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
    our_artists: {
      title: 'Our Artists section',
      description: 'Upload artist cards with optional CTA link.',
      inputRefs: artistsImageInputRefs,
      previews: artistsPreviews,
      setPreviews: setArtistsPreviews,
    },
  }), [artistsPreviews, galleryPreviews, serviceMenuPreviews])

  if (loading) {
    return <div className="rounded-lg border border-gray-200 bg-white p-6 text-sm text-gray-500">Loading landing page...</div>
  }

  const renderMediaSection = (sectionKey: 'gallery' | 'service_menu' | 'our_artists') => {
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
                      <input value={item.caption} onChange={(e) => updateGalleryItem(sectionKey, index, 'caption', e.target.value)} placeholder="Alt text / Caption" className={inputCls} disabled={!canEdit} />
                      {sectionKey === 'our_artists' && (
                        <>
                          <input value={(item as ArtistItem).text ?? ''} onChange={(e) => updateGalleryItem(sectionKey, index, 'text', e.target.value)} placeholder="Artist text / description" className={inputCls} disabled={!canEdit} />
                          <select value={(item as ArtistItem).text_align ?? 'center'} onChange={(e) => updateGalleryItem(sectionKey, index, 'text_align', e.target.value)} className={inputCls} disabled={!canEdit}>
                            <option value="left">Left</option><option value="center">Center</option><option value="right">Right</option>
                          </select>
                          <input value={(item as ArtistItem).link_url ?? ''} onChange={(e) => updateGalleryItem(sectionKey, index, 'link_url', e.target.value)} placeholder="Optional text link URL" className={inputCls} disabled={!canEdit} />
                        </>
                      )}
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
            <textarea className={textareaCls} rows={6} value={sections.hero.subtitle} onChange={(e) => updateHero('subtitle', e.target.value)} disabled={!canEdit} />
            <p className="text-xs text-gray-500 leading-relaxed">
              <span className="font-medium text-gray-600">Line breaks:</span> press Enter for a new line.
              <span className="mx-1 text-gray-400">|</span>
              <span className="font-medium text-gray-600">Bold:</span> wrap text in{' '}
              <code className="rounded bg-gray-100 px-1 text-[0.7rem] text-gray-800">**double asterisks**</code>
              .
              <span className="mx-1 text-gray-400">|</span>
              <span className="font-medium text-gray-600">Desktop vs phone:</span> put a line with only{' '}
              <code className="rounded bg-gray-100 px-1 text-[0.7rem]">mobile</code> — text above shows on tablet/desktop
              (sm and up); text below shows on small phones only. Omit it to use one version everywhere.
            </p>
          </div>
          <div className="space-y-1 text-sm text-gray-700 md:col-span-2">
            <span className="text-xs font-medium uppercase tracking-wide text-gray-500">Title 2</span>
            <input className={inputCls} value={sections.hero.title_2} onChange={(e) => updateHero('title_2', e.target.value)} disabled={!canEdit} />
          </div>
          <div className="space-y-1 text-sm text-gray-700 md:col-span-2">
            <span className="text-xs font-medium uppercase tracking-wide text-gray-500">Subtitle 2</span>
            <textarea className={textareaCls} rows={4} value={sections.hero.subtitle_2} onChange={(e) => updateHero('subtitle_2', e.target.value)} disabled={!canEdit} />
            <p className="text-xs text-gray-500 leading-relaxed">
              Same as Subtitle: <code className="rounded bg-gray-100 px-1 text-[0.7rem]">**bold**</code>, Enter for new lines, optional{' '}
              <code className="rounded bg-gray-100 px-1 text-[0.7rem]">mobile</code> divider for phone-only copy.
            </p>
          </div>
          <div className="space-y-1 text-sm text-gray-700">
            <span className="text-xs font-medium uppercase tracking-wide text-gray-500">CTA link</span>
            <input className={inputCls} value={sections.hero.cta_link} onChange={(e) => updateHero('cta_link', e.target.value)} disabled={!canEdit} />
          </div>
          <div className="flex items-center gap-2 md:col-span-2">
            <input
              id="hero-decorations"
              type="checkbox"
              className="h-4 w-4 rounded border-gray-300"
              checked={sections.hero.decorations_enabled}
              onChange={(e) => updateHero('decorations_enabled', e.target.checked)}
              disabled={!canEdit}
            />
            <label htmlFor="hero-decorations" className="text-sm text-gray-700">
              Show hero scribble decorations (images from booking shop{' '}
              <code className="rounded bg-gray-100 px-1 text-xs">public/images/sliders_design/</code>)
            </label>
          </div>
        </div>
      </SectionCard>

      {/* Gallery */}
      {renderMediaSection('gallery')}

      {/* Service Menu */}
      {renderMediaSection('service_menu')}
      {renderMediaSection('our_artists')}

      {/* Nail Academy (courses) */}
      <SectionCard
        sectionKey="nail_academy"
        title="Nail Academy section"
        description="Course cards with image, duration badge, audience, curriculum bullets, and optional details link. Use arrows to reorder (left to right on the site)."
        active={sections.nail_academy.is_active}
        onToggle={(value) => setSections((prev) => ({ ...prev, nail_academy: { ...prev.nail_academy, is_active: value } }))}
        canUpdate={canEdit}
        collapsed={collapsedSections.nail_academy ?? false}
        onToggleCollapse={() => toggleSectionCollapsed('nail_academy')}
      >
        <div className="space-y-4">
          <SectionHeadingFields
            heading={sections.nail_academy.heading}
            onChange={(heading) => setSections((prev) => ({ ...prev, nail_academy: { ...prev.nail_academy, heading } }))}
            canUpdate={canEdit}
          />
          <div className="grid gap-3 md:grid-cols-2">
            <label className="space-y-1 text-xs uppercase tracking-wide text-gray-500">
              <span className="font-medium">Target audience label</span>
              <input
                value={sections.nail_academy.target_label ?? ''}
                onChange={(e) =>
                  setSections((prev) => ({
                    ...prev,
                    nail_academy: { ...prev.nail_academy, target_label: e.target.value },
                  }))
                }
                className="w-full rounded border border-gray-300 px-3 py-2 text-sm text-gray-700 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                disabled={!canEdit}
              />
            </label>
            <label className="space-y-1 text-xs uppercase tracking-wide text-gray-500">
              <span className="font-medium">Curriculum label</span>
              <input
                value={sections.nail_academy.curriculum_label ?? ''}
                onChange={(e) =>
                  setSections((prev) => ({
                    ...prev,
                    nail_academy: { ...prev.nail_academy, curriculum_label: e.target.value },
                  }))
                }
                className="w-full rounded border border-gray-300 px-3 py-2 text-sm text-gray-700 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                disabled={!canEdit}
              />
            </label>
          </div>

          {sections.nail_academy.items.length === 0 ? (
            <div className="rounded-lg border border-dashed border-gray-200 bg-gray-50 px-4 py-6 text-center text-sm text-gray-500">
              No courses yet. Add a course card to show this block above FAQ on the booking site.
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {sections.nail_academy.items.map((item, index) => (
                <div key={`nail-academy-${index}`} className="rounded-lg border border-gray-100 bg-gray-50/60 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <p className="text-sm font-semibold text-gray-900">Course {index + 1}</p>
                      <p className="text-xs text-gray-500">Suggested image: square 1:1 (e.g. 900×900)</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => moveNailAcademyItem(index, -1)}
                        disabled={!canEdit || index === 0}
                        className="rounded border border-gray-300 px-2 py-1 text-xs text-gray-600 hover:bg-gray-50 disabled:opacity-50"
                        aria-label="Move left"
                        title="Move left"
                      >
                        <i className="fa-solid fa-arrow-left" />
                      </button>
                      <button
                        type="button"
                        onClick={() => moveNailAcademyItem(index, 1)}
                        disabled={!canEdit || index === sections.nail_academy.items.length - 1}
                        className="rounded border border-gray-300 px-2 py-1 text-xs text-gray-600 hover:bg-gray-50 disabled:opacity-50"
                        aria-label="Move right"
                        title="Move right"
                      >
                        <i className="fa-solid fa-arrow-right" />
                      </button>
                      <button
                        type="button"
                        onClick={() => removeNailAcademyItem(index)}
                        disabled={!canEdit}
                        className="rounded border border-red-200 px-2 py-1 text-xs text-red-600 hover:bg-red-50 disabled:opacity-50"
                      >
                        <i className="fa-solid fa-trash" />
                      </button>
                    </div>
                  </div>

                  <div className="mt-3 space-y-3">
                    <div
                      onClick={() => canEdit && nailAcademyImageInputRefs.current.get(index)?.click()}
                      className={`relative cursor-pointer rounded-lg border-2 border-dashed p-3 transition-colors ${
                        (nailAcademyPreviews[index] ?? item.src) ? 'border-gray-300' : 'border-gray-300 hover:border-blue-400'
                      } ${!canEdit ? 'cursor-not-allowed opacity-50' : ''}`}
                    >
                      <input
                        ref={(el) => {
                          if (el) nailAcademyImageInputRefs.current.set(index, el)
                          else nailAcademyImageInputRefs.current.delete(index)
                        }}
                        type="file"
                        accept="image/*"
                        onChange={(e) => {
                          const file = e.target.files?.[0]
                          if (file) void handleNailAcademyImageUpload(index, file)
                        }}
                        className="hidden"
                        disabled={!canEdit}
                      />
                      {(nailAcademyPreviews[index] ?? item.src) ? (
                        <div className="relative flex h-48 items-center justify-center rounded bg-gray-50">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={nailAcademyPreviews[index] ?? item.src}
                            alt=""
                            className="max-h-full max-w-full rounded object-contain"
                          />
                        </div>
                      ) : (
                        <div className="flex h-48 flex-col items-center justify-center">
                          <i className="fa-solid fa-cloud-arrow-up mb-2 text-3xl text-gray-400" />
                          <p className="text-sm text-gray-600">Click to upload</p>
                        </div>
                      )}
                    </div>

                    <input
                      value={item.duration_badge ?? ''}
                      onChange={(e) => updateNailAcademyItem(index, { duration_badge: e.target.value })}
                      placeholder="Duration badge (e.g. 5 - 8 周)"
                      className={inputCls}
                      disabled={!canEdit}
                    />
                    <input
                      value={item.title ?? ''}
                      onChange={(e) => updateNailAcademyItem(index, { title: e.target.value })}
                      placeholder="Course title"
                      className={inputCls}
                      disabled={!canEdit}
                    />
                    <textarea
                      value={item.target_audience ?? ''}
                      onChange={(e) => updateNailAcademyItem(index, { target_audience: e.target.value })}
                      placeholder="Target audience"
                      className={textareaCls}
                      rows={2}
                      disabled={!canEdit}
                    />
                    <label className="block space-y-1 text-xs uppercase tracking-wide text-gray-500">
                      <span className="font-medium">Teaching points (one line each)</span>
                      <textarea
                        value={(item.curriculum ?? []).join('\n')}
                        onChange={(e) => {
                          const lines = e.target.value.split('\n').map((s) => s.trim())
                          updateNailAcademyItem(index, { curriculum: lines })
                        }}
                        placeholder={'Line 1\nLine 2\nLine 3'}
                        className={textareaCls}
                        rows={5}
                        disabled={!canEdit}
                      />
                    </label>
                    <input
                      value={item.details_label ?? ''}
                      onChange={(e) => updateNailAcademyItem(index, { details_label: e.target.value })}
                      placeholder="Link label (e.g. CLICK FOR MORE DETAILS →)"
                      className={inputCls}
                      disabled={!canEdit}
                    />
                    <input
                      value={item.details_link ?? ''}
                      onChange={(e) => updateNailAcademyItem(index, { details_link: e.target.value })}
                      placeholder="Details URL (optional)"
                      className={inputCls}
                      disabled={!canEdit}
                    />
                    <select
                      value={item.text_align}
                      onChange={(e) =>
                        updateNailAcademyItem(index, { text_align: e.target.value as NailAcademyItem['text_align'] })
                      }
                      className={inputCls}
                      disabled={!canEdit}
                    >
                      <option value="left">Text align: Left</option>
                      <option value="center">Text align: Center</option>
                      <option value="right">Text align: Right</option>
                    </select>
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="flex items-center justify-between text-xs text-gray-500">
            <span>{sections.nail_academy.items.length} courses</span>
            <button
              type="button"
              onClick={addNailAcademyItem}
              disabled={!canEdit}
              className="inline-flex items-center gap-2 rounded border border-indigo-600 bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <i className="fa-solid fa-plus" />
              Add course
            </button>
          </div>
        </div>
      </SectionCard>

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

      {/* Visit Our Studio — below Policy & care on the site */}
      <SectionCard
        sectionKey="visit_studio"
        title="Visit Our Studio"
        description="Location, maps links, WhatsApp phone + default message, opening hours, and legal footer. Column order controls which block appears on the left (desktop) / first (mobile)."
        active={sections.visit_studio.is_active}
        onToggle={(value) => updateVisitStudio({ is_active: value })}
        canUpdate={canEdit}
        collapsed={collapsedSections.visit_studio ?? false}
        onToggleCollapse={() => toggleSectionCollapsed('visit_studio')}
      >
        <div className="space-y-4">
          <SectionHeadingFields
            heading={sections.visit_studio.heading}
            onChange={(heading) => updateVisitStudio({ heading })}
            canUpdate={canEdit}
          />
          <div className="grid gap-3 md:grid-cols-2">
            <label className="space-y-1 text-xs uppercase tracking-wide text-gray-500 md:col-span-2">
              <span className="font-medium">Studio name</span>
              <input
                value={sections.visit_studio.studio_name}
                onChange={(e) => updateVisitStudio({ studio_name: e.target.value })}
                className={inputCls}
                disabled={!canEdit}
                placeholder="NAILSBYLITTLEBOO SALON"
              />
            </label>
            <label className="space-y-1 text-xs uppercase tracking-wide text-gray-500 md:col-span-2">
              <span className="font-medium">Address</span>
              <textarea
                value={sections.visit_studio.address}
                onChange={(e) => updateVisitStudio({ address: e.target.value })}
                className={textareaCls}
                rows={4}
                disabled={!canEdit}
                placeholder={'Line 1\nCity\nCountry'}
              />
            </label>
            <label className="space-y-1 text-xs uppercase tracking-wide text-gray-500">
              <span className="font-medium">Google Maps URL</span>
              <input
                value={sections.visit_studio.google_maps_url}
                onChange={(e) => updateVisitStudio({ google_maps_url: e.target.value })}
                className={inputCls}
                disabled={!canEdit}
              />
            </label>
            <label className="space-y-1 text-xs uppercase tracking-wide text-gray-500">
              <span className="font-medium">Waze URL</span>
              <input
                value={sections.visit_studio.waze_url}
                onChange={(e) => updateVisitStudio({ waze_url: e.target.value })}
                className={inputCls}
                disabled={!canEdit}
              />
            </label>
            <label className="space-y-1 text-xs uppercase tracking-wide text-gray-500 md:col-span-2">
              <span className="font-medium">WhatsApp phone number</span>
              <input
                value={sections.visit_studio.whatsapp_phone}
                onChange={(e) => updateVisitStudio({ whatsapp_phone: e.target.value })}
                className={inputCls}
                disabled={!canEdit}
                placeholder="+60123456789 or 012-345 6789"
              />
            </label>
            <label className="space-y-1 text-xs uppercase tracking-wide text-gray-500 md:col-span-2">
              <span className="font-medium">WhatsApp default message</span>
              <textarea
                value={sections.visit_studio.whatsapp_message}
                onChange={(e) => updateVisitStudio({ whatsapp_message: e.target.value })}
                className={textareaCls}
                rows={3}
                disabled={!canEdit}
                placeholder="Hi! I would like to get in touch about your salon services."
              />
            </label>
            <label className="space-y-1 text-xs uppercase tracking-wide text-gray-500">
              <span className="font-medium">Google Maps button label</span>
              <input
                value={sections.visit_studio.google_maps_label}
                onChange={(e) => updateVisitStudio({ google_maps_label: e.target.value })}
                className={inputCls}
                disabled={!canEdit}
              />
            </label>
            <label className="space-y-1 text-xs uppercase tracking-wide text-gray-500">
              <span className="font-medium">Waze button label</span>
              <input
                value={sections.visit_studio.waze_label}
                onChange={(e) => updateVisitStudio({ waze_label: e.target.value })}
                className={inputCls}
                disabled={!canEdit}
              />
            </label>
            <label className="space-y-1 text-xs uppercase tracking-wide text-gray-500 md:col-span-2">
              <span className="font-medium">WhatsApp button label</span>
              <input
                value={sections.visit_studio.whatsapp_label}
                onChange={(e) => updateVisitStudio({ whatsapp_label: e.target.value })}
                className={inputCls}
                disabled={!canEdit}
              />
            </label>
            <label className="space-y-1 text-xs uppercase tracking-wide text-gray-500 md:col-span-2">
              <span className="font-medium">Opening hours card title</span>
              <input
                value={sections.visit_studio.opening_hours_heading}
                onChange={(e) => updateVisitStudio({ opening_hours_heading: e.target.value })}
                className={inputCls}
                disabled={!canEdit}
              />
            </label>
            <label className="space-y-1 text-xs uppercase tracking-wide text-gray-500 md:col-span-2">
              <span className="font-medium">Column order</span>
              <select
                value={sections.visit_studio.column_order}
                onChange={(e) =>
                  updateVisitStudio({
                    column_order: e.target.value as Sections['visit_studio']['column_order'],
                  })
                }
                className={inputCls}
                disabled={!canEdit}
              >
                <option value="contact_left">Location &amp; contact — left (opening hours right)</option>
                <option value="hours_left">Opening hours — left (location right)</option>
              </select>
            </label>
          </div>

          <div className="space-y-3">
            <div className="flex flex-wrap items-end justify-between gap-2">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Opening hours rows</p>
                <p className="mt-0.5 text-[11px] text-gray-400">
                  Two columns on desktop: row 1 left, row 2 right. Each card: label (days) left, hours right.
                </p>
              </div>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              {sections.visit_studio.opening_hours.map((row, idx) => (
                <div key={idx} className="rounded-lg border border-gray-100 bg-gray-50/60 p-4">
                  <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                    <span className="text-xs font-semibold text-gray-500">Row {idx + 1}</span>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => moveOpeningHourRow(idx, -1)}
                        disabled={!canEdit || idx === 0}
                        className="rounded border border-gray-300 px-2 py-1 text-xs text-gray-600 hover:bg-gray-50 disabled:opacity-50"
                        aria-label="Move earlier in list"
                        title="Move earlier"
                      >
                        <i className="fa-solid fa-arrow-up" />
                      </button>
                      <button
                        type="button"
                        onClick={() => moveOpeningHourRow(idx, 1)}
                        disabled={!canEdit || idx === sections.visit_studio.opening_hours.length - 1}
                        className="rounded border border-gray-300 px-2 py-1 text-xs text-gray-600 hover:bg-gray-50 disabled:opacity-50"
                        aria-label="Move later in list"
                        title="Move later"
                      >
                        <i className="fa-solid fa-arrow-down" />
                      </button>
                      <button
                        type="button"
                        onClick={() => removeOpeningHourRow(idx)}
                        disabled={!canEdit}
                        className="rounded border border-red-200 px-2 py-1 text-xs text-red-600 hover:bg-red-50 disabled:opacity-50"
                        aria-label="Remove row"
                      >
                        <i className="fa-solid fa-trash" />
                      </button>
                    </div>
                  </div>
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:gap-4">
                    <label className="min-w-0 flex-1 space-y-1">
                      <span className="text-[11px] font-medium uppercase tracking-wide text-gray-500">Label</span>
                      <input
                        className={inputCls}
                        value={row.day_range}
                        onChange={(e) => updateOpeningHourRow(idx, 'day_range', e.target.value)}
                        placeholder="Monday — Friday"
                        disabled={!canEdit}
                      />
                    </label>
                    <label className="min-w-0 flex-1 space-y-1">
                      <span className="text-[11px] font-medium uppercase tracking-wide text-gray-500">Time</span>
                      <input
                        className={inputCls}
                        value={row.time_range}
                        onChange={(e) => updateOpeningHourRow(idx, 'time_range', e.target.value)}
                        placeholder="11:00 AM — 6:30 PM"
                        disabled={!canEdit}
                      />
                    </label>
                  </div>
                </div>
              ))}
            </div>
            <button
              type="button"
              onClick={addOpeningHourRow}
              disabled={!canEdit}
              className="inline-flex items-center gap-2 rounded border border-indigo-600 bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <i className="fa-solid fa-plus" />
              Add hours row
            </button>
          </div>

          <label className="block space-y-1 border-t border-gray-100 pt-4 text-xs uppercase tracking-wide text-gray-500">
            <span className="font-medium">Bottom label</span>
            <span className="block font-normal normal-case text-[11px] text-gray-400">
              Two lines under opening hours (press Enter after the first line). Example: legal line, then © line.
            </span>
            <textarea
              value={sections.visit_studio.bottom_label}
              onChange={(e) => updateVisitStudio({ bottom_label: e.target.value })}
              className={textareaCls}
              rows={3}
              disabled={!canEdit}
              placeholder={'OPERATED BY COMPANY NAME (REG NO)\n© 2026 STUDIO NAME'}
            />
          </label>
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
      {saveToast ? (
        <div
          role="status"
          aria-live="polite"
          className={`fixed bottom-6 right-6 z-[100] flex max-w-sm items-start gap-3 rounded-xl border px-4 py-3 text-sm shadow-lg ${
            saveToast.tone === 'success'
              ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
              : 'border-red-200 bg-red-50 text-red-800'
          }`}
        >
          <i
            className={`mt-0.5 text-base ${
              saveToast.tone === 'success' ? 'fa-solid fa-circle-check text-emerald-600' : 'fa-solid fa-circle-xmark text-red-600'
            }`}
            aria-hidden
          />
          <div className="flex-1 font-medium leading-snug">{saveToast.text}</div>
          <button
            type="button"
            onClick={() => setSaveToast(null)}
            className="rounded p-1 opacity-70 transition hover:opacity-100"
            aria-label="Dismiss notification"
          >
            <i className="fa-solid fa-xmark text-xs" />
          </button>
        </div>
      ) : null}
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
