'use client'

import type { ReactNode } from 'react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import InternationalPhoneInput from '@/components/common/InternationalPhoneInput'
import { compressImage } from '@/lib/compressImage'
import { normalizeInternationalPhone } from '@/lib/phone'

type HeadingConfig = { label: string; title: string; align: 'left' | 'center' | 'right' }
type GallerySectionBlock = { is_active: boolean; heading: HeadingConfig; items: GalleryItem[] }
type ArtistSectionBlock = { is_active: boolean; heading: HeadingConfig; items: ArtistItem[] }
type MediaGroupKey = 'gallery' | 'service_menus' | 'our_artists_sections'

const defaultServiceMenuBlock = (index = 0): GallerySectionBlock => ({
  is_active: true,
  heading: {
    label: index === 0 ? 'Service Menu' : `Service Menu ${index + 1}`,
    title: index === 0 ? 'Click to view services and pricing' : 'Additional services and pricing',
    align: 'center',
  },
  items: [],
})

const defaultArtistSectionBlock = (index = 0): ArtistSectionBlock => ({
  is_active: true,
  heading: {
    label: index === 0 ? 'Our Artists' : `Our Artists ${index + 1}`,
    title: index === 0 ? 'Meet our creative professionals' : 'More of our creative team',
    align: 'center',
  },
  items: [],
})

function normalizeHeading(raw: unknown, fallback: HeadingConfig): HeadingConfig {
  if (!raw || typeof raw !== 'object') return fallback
  const o = raw as Partial<HeadingConfig>
  const align = o.align === 'left' || o.align === 'center' || o.align === 'right' ? o.align : fallback.align
  return {
    label: asText(o.label, fallback.label),
    title: asText(o.title, fallback.title),
    align,
  }
}

function normalizeGalleryItem(raw: unknown): GalleryItem {
  const o = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {}
  return { src: asText(o.src), caption: asText(o.caption) }
}

function normalizeGallerySectionBlock(raw: unknown, fallback: GallerySectionBlock): GallerySectionBlock {
  if (!raw || typeof raw !== 'object') return { ...fallback, items: [] }
  const o = raw as Record<string, unknown>
  return {
    is_active: Boolean(o.is_active ?? fallback.is_active),
    heading: normalizeHeading(o.heading, fallback.heading),
    items: Array.isArray(o.items) ? o.items.map(normalizeGalleryItem) : [],
  }
}

function normalizeArtistItem(raw: unknown): ArtistItem {
  const o = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {}
  const align = o.text_align === 'center' || o.text_align === 'right' ? o.text_align : 'center'
  return {
    src: asText(o.src),
    caption: asText(o.caption),
    text: asText(o.text),
    text_align: align,
    link_url: asText(o.link_url),
  }
}

function normalizeArtistSectionBlock(raw: unknown, fallback: ArtistSectionBlock): ArtistSectionBlock {
  if (!raw || typeof raw !== 'object') return { ...fallback, items: [] }
  const o = raw as Record<string, unknown>
  return {
    is_active: Boolean(o.is_active ?? fallback.is_active),
    heading: normalizeHeading(o.heading, fallback.heading),
    items: Array.isArray(o.items) ? o.items.map(normalizeArtistItem) : [],
  }
}

function normalizeServiceMenus(raw: Partial<Sections> & Record<string, unknown>): GallerySectionBlock[] {
  const fallback = defaultServiceMenuBlock(0)
  if (Array.isArray(raw.service_menus)) {
    return raw.service_menus.map((block, index) => normalizeGallerySectionBlock(block, defaultServiceMenuBlock(index)))
  }
  if (raw.service_menu && typeof raw.service_menu === 'object') {
    return [normalizeGallerySectionBlock(raw.service_menu, fallback)]
  }
  return [defaultServiceMenuBlock(0)]
}

function normalizeOurArtistsSections(raw: Partial<Sections> & Record<string, unknown>): ArtistSectionBlock[] {
  const fallback = defaultArtistSectionBlock(0)
  if (Array.isArray(raw.our_artists_sections)) {
    return raw.our_artists_sections.map((block, index) => normalizeArtistSectionBlock(block, defaultArtistSectionBlock(index)))
  }
  if (raw.our_artists && typeof raw.our_artists === 'object') {
    return [normalizeArtistSectionBlock(raw.our_artists, fallback)]
  }
  return [defaultArtistSectionBlock(0)]
}

function buildBlockPreviews(blocks: { items: unknown[] }[]): (string | null)[][] {
  return blocks.map((block) => Array(Array.isArray(block.items) ? block.items.length : 0).fill(null))
}

function previewKey(blockIndex: number, itemIndex: number) {
  return `${blockIndex}-${itemIndex}`
}

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
  service_menus: GallerySectionBlock[]
  our_artists_sections: ArtistSectionBlock[]
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
  service_menus: [defaultServiceMenuBlock(0)],
  our_artists_sections: [defaultArtistSectionBlock(0)],
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
  let whatsapp_phone = normalizeInternationalPhone(String(o.whatsapp_phone ?? ''))
  let whatsapp_message = String(o.whatsapp_message ?? '').trim()
  if (!whatsapp_phone && legacyUrl) {
    whatsapp_phone = normalizeInternationalPhone(extractPhoneFromWhatsAppUrl(legacyUrl))
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
  merged.service_menus = normalizeServiceMenus(raw)
  merged.our_artists_sections = normalizeOurArtistsSections(raw)
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
  const [serviceMenuPreviews, setServiceMenuPreviews] = useState<(string | null)[][]>([])
  const [artistsPreviews, setArtistsPreviews] = useState<(string | null)[][]>([])
  const [nailAcademyPreviews, setNailAcademyPreviews] = useState<(string | null)[]>([])
  const galleryImageInputRefs = useRef<Map<number, HTMLInputElement>>(new Map())
  const serviceMenuImageInputRefs = useRef<Map<string, HTMLInputElement>>(new Map())
  const artistsImageInputRefs = useRef<Map<string, HTMLInputElement>>(new Map())
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
        const merged = mergeSectionsFromApi(pageData.sections)
        setSections(merged)
        setGalleryPreviews(Array(merged.gallery.items.length).fill(null))
        setServiceMenuPreviews(buildBlockPreviews(merged.service_menus))
        setArtistsPreviews(buildBlockPreviews(merged.our_artists_sections))
        setNailAcademyPreviews(Array(merged.nail_academy.items.length).fill(null))
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
      service_menus: sections.service_menus,
      our_artists_sections: sections.our_artists_sections,
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
        const merged = mergeSectionsFromApi(pageData.sections)
        setSections(merged)
        setGalleryPreviews(Array(merged.gallery.items.length).fill(null))
        setServiceMenuPreviews(buildBlockPreviews(merged.service_menus))
        setArtistsPreviews(buildBlockPreviews(merged.our_artists_sections))
        setNailAcademyPreviews(Array(merged.nail_academy.items.length).fill(null))
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
    const compressed = await compressImage(file)
    const formData = new FormData()
    formData.append('image', compressed)
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
    groupKey: MediaGroupKey,
    blockIndex: number,
    itemIndex: number,
    file: File,
  ) => {
    const previewUrl = URL.createObjectURL(file)
    const uploadSection = groupKey === 'gallery' ? 'gallery' : groupKey === 'service_menus' ? 'service_menu' : 'our_artists'

    if (groupKey === 'gallery') {
      setGalleryPreviews((prev) => {
        const next = ensureArrayLength(prev, itemIndex + 1)
        next[itemIndex] = previewUrl
        return next
      })
    } else if (groupKey === 'service_menus') {
      setServiceMenuPreviews((prev) => {
        const next = [...prev]
        while (next.length <= blockIndex) next.push([])
        const row = ensureArrayLength(next[blockIndex] ?? [], itemIndex + 1)
        row[itemIndex] = previewUrl
        next[blockIndex] = row
        return next
      })
    } else {
      setArtistsPreviews((prev) => {
        const next = [...prev]
        while (next.length <= blockIndex) next.push([])
        const row = ensureArrayLength(next[blockIndex] ?? [], itemIndex + 1)
        row[itemIndex] = previewUrl
        next[blockIndex] = row
        return next
      })
    }

    const url = await uploadImage(file, uploadSection)
    if (!url) return

    setSections((prev) => {
      if (groupKey === 'gallery') {
        const items = [...prev.gallery.items]
        items[itemIndex] = { ...items[itemIndex], src: url }
        return { ...prev, gallery: { ...prev.gallery, items } }
      }
      const blocks = [...prev[groupKey]]
      const items = [...blocks[blockIndex].items]
      items[itemIndex] = { ...items[itemIndex], src: url }
      blocks[blockIndex] = { ...blocks[blockIndex], items }
      return { ...prev, [groupKey]: blocks }
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

  const toggleSectionCollapsed = (sectionKey: string) => {
    setCollapsedSections((prev) => ({
      ...prev,
      [sectionKey]: !prev[sectionKey],
    }))
  }

  const updateGalleryItem = (
    groupKey: MediaGroupKey,
    blockIndex: number,
    itemIndex: number,
    field: string,
    value: string,
  ) => {
    setSections((prev) => {
      if (groupKey === 'gallery') {
        const items = [...prev.gallery.items]
        items[itemIndex] = { ...items[itemIndex], [field]: value }
        return { ...prev, gallery: { ...prev.gallery, items } }
      }
      const blocks = [...prev[groupKey]]
      const items = [...blocks[blockIndex].items]
      items[itemIndex] = { ...items[itemIndex], [field]: value }
      blocks[blockIndex] = { ...blocks[blockIndex], items }
      return { ...prev, [groupKey]: blocks }
    })
  }

  const addGalleryItem = (groupKey: MediaGroupKey, blockIndex: number) => {
    setSections((prev) => {
      if (groupKey === 'gallery') {
        return {
          ...prev,
          gallery: {
            ...prev.gallery,
            items: [...prev.gallery.items, { src: '', caption: '' }],
          },
        }
      }
      const blocks = [...prev[groupKey]]
      const block = blocks[blockIndex]
      const newItem = groupKey === 'our_artists_sections'
        ? { src: '', caption: '', text: '', text_align: 'center' as const, link_url: '' }
        : { src: '', caption: '' }
      blocks[blockIndex] = { ...block, items: [...block.items, newItem] }
      return { ...prev, [groupKey]: blocks }
    })
    if (groupKey === 'gallery') {
      setGalleryPreviews((prev) => [...prev, null])
    } else if (groupKey === 'our_artists_sections') {
      setArtistsPreviews((prev) => {
        const next = [...prev]
        next[blockIndex] = [...(next[blockIndex] ?? []), null]
        return next
      })
    } else {
      setServiceMenuPreviews((prev) => {
        const next = [...prev]
        next[blockIndex] = [...(next[blockIndex] ?? []), null]
        return next
      })
    }
  }

  const removeGalleryItem = (groupKey: MediaGroupKey, blockIndex: number, itemIndex: number) => {
    setSections((prev) => {
      if (groupKey === 'gallery') {
        return {
          ...prev,
          gallery: { ...prev.gallery, items: prev.gallery.items.filter((_, i) => i !== itemIndex) },
        }
      }
      const blocks = [...prev[groupKey]]
      blocks[blockIndex] = {
        ...blocks[blockIndex],
        items: blocks[blockIndex].items.filter((_, i) => i !== itemIndex),
      }
      return { ...prev, [groupKey]: blocks }
    })
    if (groupKey === 'gallery') {
      setGalleryPreviews((prev) => prev.filter((_, i) => i !== itemIndex))
    } else if (groupKey === 'our_artists_sections') {
      setArtistsPreviews((prev) => prev.map((row, i) => (i === blockIndex ? row.filter((_, j) => j !== itemIndex) : row)))
    } else {
      setServiceMenuPreviews((prev) => prev.map((row, i) => (i === blockIndex ? row.filter((_, j) => j !== itemIndex) : row)))
    }
  }

  const reorder = useCallback(<T,>(items: T[], index: number, targetIndex: number) => {
    const next = [...items]
    const [moved] = next.splice(index, 1)
    next.splice(targetIndex, 0, moved)
    return next
  }, [])

  const moveGalleryItem = useCallback((groupKey: MediaGroupKey, blockIndex: number, itemIndex: number, direction: -1 | 1) => {
    setSections((prev) => {
      if (groupKey === 'gallery') {
        const targetIndex = itemIndex + direction
        if (targetIndex < 0 || targetIndex >= prev.gallery.items.length) return prev
        return { ...prev, gallery: { ...prev.gallery, items: reorder(prev.gallery.items, itemIndex, targetIndex) } }
      }
      const blocks = [...prev[groupKey]]
      const block = blocks[blockIndex]
      const targetIndex = itemIndex + direction
      if (targetIndex < 0 || targetIndex >= block.items.length) return prev
      blocks[blockIndex] = { ...block, items: reorder(block.items, itemIndex, targetIndex) }
      return { ...prev, [groupKey]: blocks }
    })

    if (groupKey === 'gallery') {
      setGalleryPreviews((prev) => {
        const targetIndex = itemIndex + direction
        if (targetIndex < 0 || targetIndex >= prev.length) return prev
        return reorder(prev, itemIndex, targetIndex)
      })
    } else if (groupKey === 'our_artists_sections') {
      setArtistsPreviews((prev) => prev.map((row, i) => {
        if (i !== blockIndex) return row
        const targetIndex = itemIndex + direction
        if (targetIndex < 0 || targetIndex >= row.length) return row
        return reorder(row, itemIndex, targetIndex)
      }))
    } else {
      setServiceMenuPreviews((prev) => prev.map((row, i) => {
        if (i !== blockIndex) return row
        const targetIndex = itemIndex + direction
        if (targetIndex < 0 || targetIndex >= row.length) return row
        return reorder(row, itemIndex, targetIndex)
      }))
    }
  }, [reorder])

  const addMediaSectionBlock = (groupKey: 'service_menus' | 'our_artists_sections') => {
    setSections((prev) => {
      const nextIndex = prev[groupKey].length
      const block = groupKey === 'service_menus'
        ? defaultServiceMenuBlock(nextIndex)
        : defaultArtistSectionBlock(nextIndex)
      return { ...prev, [groupKey]: [...prev[groupKey], block] }
    })
    if (groupKey === 'service_menus') {
      setServiceMenuPreviews((prev) => [...prev, []])
    } else {
      setArtistsPreviews((prev) => [...prev, []])
    }
  }

  const removeMediaSectionBlock = (groupKey: 'service_menus' | 'our_artists_sections', blockIndex: number) => {
    setSections((prev) => ({
      ...prev,
      [groupKey]: prev[groupKey].filter((_, i) => i !== blockIndex),
    }))
    if (groupKey === 'service_menus') {
      setServiceMenuPreviews((prev) => prev.filter((_, i) => i !== blockIndex))
    } else {
      setArtistsPreviews((prev) => prev.filter((_, i) => i !== blockIndex))
    }
  }

  const moveMediaSectionBlock = (groupKey: 'service_menus' | 'our_artists_sections', blockIndex: number, direction: -1 | 1) => {
    const targetIndex = blockIndex + direction
    setSections((prev) => {
      if (targetIndex < 0 || targetIndex >= prev[groupKey].length) return prev
      return { ...prev, [groupKey]: reorder(prev[groupKey], blockIndex, targetIndex) }
    })
    if (groupKey === 'service_menus') {
      setServiceMenuPreviews((prev) => {
        if (targetIndex < 0 || targetIndex >= prev.length) return prev
        return reorder(prev, blockIndex, targetIndex)
      })
    } else {
      setArtistsPreviews((prev) => {
        if (targetIndex < 0 || targetIndex >= prev.length) return prev
        return reorder(prev, blockIndex, targetIndex)
      })
    }
  }

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

  if (loading) {
    return <div className="rounded-lg border border-gray-200 bg-white p-6 text-sm text-gray-500">Loading landing page...</div>
  }

  const renderGallerySection = () => {
    const section = sections.gallery
    const collapsed = collapsedSections.gallery ?? false

    const handleImageClick = (itemIndex: number) => {
      galleryImageInputRefs.current.get(itemIndex)?.click()
    }

    return (
      <SectionCard
        sectionKey="gallery"
        title="Gallery section"
        description="Upload images to appear on the booking landing page gallery."
        active={section.is_active}
        onToggle={(value) => setSections((prev) => ({ ...prev, gallery: { ...prev.gallery, is_active: value } }))}
        canUpdate={canEdit}
        collapsed={collapsed}
        onToggleCollapse={() => toggleSectionCollapsed('gallery')}
      >
        <div className="space-y-4">
          <SectionHeadingFields
            heading={section.heading}
            onChange={(heading) => setSections((prev) => ({ ...prev, gallery: { ...prev.gallery, heading } }))}
            canUpdate={canEdit}
          />
          {section.items.length === 0 ? (
            <div className="rounded-lg border border-dashed border-gray-200 bg-gray-50 px-4 py-6 text-center text-sm text-gray-500">
              No images yet. Add images to build the section grid.
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {section.items.map((item, itemIndex) => (
                <div key={`gallery-${itemIndex}`} className="rounded-lg border border-gray-100 bg-gray-50/60 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <p className="text-sm font-semibold text-gray-900">Image {itemIndex + 1}</p>
                      <p className="text-xs text-gray-500">Suggested size: 900 x 1200 (3:4)</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button type="button" onClick={() => moveGalleryItem('gallery', 0, itemIndex, -1)} disabled={!canEdit || itemIndex === 0} className="rounded border border-gray-300 px-2 py-1 text-xs text-gray-600 hover:bg-gray-50 disabled:opacity-50" aria-label="Move image up"><i className="fa-solid fa-arrow-up" /></button>
                      <button type="button" onClick={() => moveGalleryItem('gallery', 0, itemIndex, 1)} disabled={!canEdit || itemIndex === section.items.length - 1} className="rounded border border-gray-300 px-2 py-1 text-xs text-gray-600 hover:bg-gray-50 disabled:opacity-50" aria-label="Move image down"><i className="fa-solid fa-arrow-down" /></button>
                      <button type="button" onClick={() => removeGalleryItem('gallery', 0, itemIndex)} disabled={!canEdit} className="rounded border border-red-200 px-2 py-1 text-xs text-red-600 hover:bg-red-50 disabled:opacity-50"><i className="fa-solid fa-trash" /></button>
                    </div>
                  </div>
                  <div className="mt-3 space-y-3">
                    <div onClick={() => canEdit && handleImageClick(itemIndex)} className={`relative border-2 border-dashed rounded-lg p-3 cursor-pointer transition-colors ${(galleryPreviews[itemIndex] ?? item.src) ? 'border-gray-300' : 'border-gray-300 hover:border-blue-400'} ${!canEdit ? 'cursor-not-allowed opacity-50' : ''}`}>
                      <input ref={(el) => { if (el) galleryImageInputRefs.current.set(itemIndex, el); else galleryImageInputRefs.current.delete(itemIndex) }} type="file" accept="image/*" onChange={(e) => { const file = e.target.files?.[0]; if (file) void handleImageUpload('gallery', 0, itemIndex, file) }} className="hidden" disabled={!canEdit} />
                      {(galleryPreviews[itemIndex] ?? item.src) ? (
                        <div className="relative group h-48 flex items-center justify-center bg-gray-50 rounded">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={galleryPreviews[itemIndex] ?? item.src} alt={item.caption || `Image ${itemIndex + 1}`} className="max-w-full max-h-full object-contain rounded" />
                        </div>
                      ) : (
                        <div className="flex flex-col items-center justify-center h-48"><i className="fa-solid fa-cloud-arrow-up text-3xl text-gray-400 mb-2" /><p className="text-sm text-gray-600">Click to upload</p></div>
                      )}
                    </div>
                    <input value={item.caption} onChange={(e) => updateGalleryItem('gallery', 0, itemIndex, 'caption', e.target.value)} placeholder="Alt text / Caption" className={inputCls} disabled={!canEdit} />
                  </div>
                </div>
              ))}
            </div>
          )}
          <div className="flex items-center justify-between text-xs text-gray-500">
            <span>{section.items.length} images</span>
            <button type="button" onClick={() => addGalleryItem('gallery', 0)} disabled={!canEdit} className="inline-flex items-center gap-2 rounded border border-indigo-600 bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60"><i className="fa-solid fa-plus" />Add image</button>
          </div>
        </div>
      </SectionCard>
    )
  }

  const renderMediaSectionBlocks = (
    groupKey: 'service_menus' | 'our_artists_sections',
    titleBase: string,
    description: string,
    isArtist: boolean,
  ) => {
    const blocks = sections[groupKey]
    const previews = groupKey === 'service_menus' ? serviceMenuPreviews : artistsPreviews
    const inputRefs = groupKey === 'service_menus' ? serviceMenuImageInputRefs : artistsImageInputRefs

    return (
      <div className="space-y-4">
        {blocks.map((section, blockIndex) => {
          const sectionKey = `${groupKey}-${blockIndex}`
          const collapsed = collapsedSections[sectionKey] ?? false
          const handleImageClick = (itemIndex: number) => {
            inputRefs.current.get(previewKey(blockIndex, itemIndex))?.click()
          }

          return (
            <SectionCard
              key={sectionKey}
              sectionKey={sectionKey}
              title={`${titleBase} ${blockIndex + 1}`}
              description={description}
              active={section.is_active}
              onToggle={(value) => setSections((prev) => {
                const nextBlocks = [...prev[groupKey]]
                nextBlocks[blockIndex] = { ...nextBlocks[blockIndex], is_active: value }
                return { ...prev, [groupKey]: nextBlocks }
              })}
              canUpdate={canEdit}
              collapsed={collapsed}
              onToggleCollapse={() => toggleSectionCollapsed(sectionKey)}
            >
              <div className="mb-4 flex flex-wrap items-center justify-between gap-2 border-b border-gray-100 pb-3">
                <p className="text-xs text-gray-500">Reorder or remove this block on the landing page.</p>
                <div className="flex items-center gap-2">
                  <button type="button" onClick={() => moveMediaSectionBlock(groupKey, blockIndex, -1)} disabled={!canEdit || blockIndex === 0} className="rounded border border-gray-300 px-2 py-1 text-xs text-gray-600 hover:bg-gray-50 disabled:opacity-50" title="Move block up"><i className="fa-solid fa-arrow-up" /></button>
                  <button type="button" onClick={() => moveMediaSectionBlock(groupKey, blockIndex, 1)} disabled={!canEdit || blockIndex === blocks.length - 1} className="rounded border border-gray-300 px-2 py-1 text-xs text-gray-600 hover:bg-gray-50 disabled:opacity-50" title="Move block down"><i className="fa-solid fa-arrow-down" /></button>
                  <button type="button" onClick={() => removeMediaSectionBlock(groupKey, blockIndex)} disabled={!canEdit || blocks.length <= 1} className="rounded border border-red-200 px-2 py-1 text-xs text-red-600 hover:bg-red-50 disabled:opacity-50" title="Remove block"><i className="fa-solid fa-trash" /></button>
                </div>
              </div>
              <div className="space-y-4">
                <SectionHeadingFields
                  heading={section.heading}
                  onChange={(heading) => setSections((prev) => {
                    const nextBlocks = [...prev[groupKey]]
                    nextBlocks[blockIndex] = { ...nextBlocks[blockIndex], heading }
                    return { ...prev, [groupKey]: nextBlocks }
                  })}
                  canUpdate={canEdit}
                />
                {section.items.length === 0 ? (
                  <div className="rounded-lg border border-dashed border-gray-200 bg-gray-50 px-4 py-6 text-center text-sm text-gray-500">No images yet. Add images to build the section grid.</div>
                ) : (
                  <div className="grid gap-4 md:grid-cols-2">
                    {section.items.map((item, itemIndex) => (
                      <div key={`${sectionKey}-item-${itemIndex}`} className="rounded-lg border border-gray-100 bg-gray-50/60 p-4">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div><p className="text-sm font-semibold text-gray-900">Image {itemIndex + 1}</p><p className="text-xs text-gray-500">Suggested size: 900 x 1200 (3:4)</p></div>
                          <div className="flex items-center gap-2">
                            <button type="button" onClick={() => moveGalleryItem(groupKey, blockIndex, itemIndex, -1)} disabled={!canEdit || itemIndex === 0} className="rounded border border-gray-300 px-2 py-1 text-xs text-gray-600 hover:bg-gray-50 disabled:opacity-50"><i className="fa-solid fa-arrow-up" /></button>
                            <button type="button" onClick={() => moveGalleryItem(groupKey, blockIndex, itemIndex, 1)} disabled={!canEdit || itemIndex === section.items.length - 1} className="rounded border border-gray-300 px-2 py-1 text-xs text-gray-600 hover:bg-gray-50 disabled:opacity-50"><i className="fa-solid fa-arrow-down" /></button>
                            <button type="button" onClick={() => removeGalleryItem(groupKey, blockIndex, itemIndex)} disabled={!canEdit} className="rounded border border-red-200 px-2 py-1 text-xs text-red-600 hover:bg-red-50 disabled:opacity-50"><i className="fa-solid fa-trash" /></button>
                          </div>
                        </div>
                        <div className="mt-3 space-y-3">
                          <div onClick={() => canEdit && handleImageClick(itemIndex)} className={`relative border-2 border-dashed rounded-lg p-3 cursor-pointer transition-colors ${(previews[blockIndex]?.[itemIndex] ?? item.src) ? 'border-gray-300' : 'border-gray-300 hover:border-blue-400'} ${!canEdit ? 'cursor-not-allowed opacity-50' : ''}`}>
                            <input ref={(el) => { const key = previewKey(blockIndex, itemIndex); if (el) inputRefs.current.set(key, el); else inputRefs.current.delete(key) }} type="file" accept="image/*" onChange={(e) => { const file = e.target.files?.[0]; if (file) void handleImageUpload(groupKey, blockIndex, itemIndex, file) }} className="hidden" disabled={!canEdit} />
                            {(previews[blockIndex]?.[itemIndex] ?? item.src) ? (
                              <div className="relative group h-48 flex items-center justify-center bg-gray-50 rounded">
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img src={previews[blockIndex]?.[itemIndex] ?? item.src} alt={item.caption || `Image ${itemIndex + 1}`} className="max-w-full max-h-full object-contain rounded" />
                              </div>
                            ) : (
                              <div className="flex flex-col items-center justify-center h-48"><i className="fa-solid fa-cloud-arrow-up text-3xl text-gray-400 mb-2" /><p className="text-sm text-gray-600">Click to upload</p></div>
                            )}
                          </div>
                          <input value={item.caption} onChange={(e) => updateGalleryItem(groupKey, blockIndex, itemIndex, 'caption', e.target.value)} placeholder="Alt text / Caption" className={inputCls} disabled={!canEdit} />
                          {isArtist && (
                            <>
                              <input value={(item as ArtistItem).text ?? ''} onChange={(e) => updateGalleryItem(groupKey, blockIndex, itemIndex, 'text', e.target.value)} placeholder="Artist text / description" className={inputCls} disabled={!canEdit} />
                              <select value={(item as ArtistItem).text_align ?? 'center'} onChange={(e) => updateGalleryItem(groupKey, blockIndex, itemIndex, 'text_align', e.target.value)} className={inputCls} disabled={!canEdit}><option value="left">Left</option><option value="center">Center</option><option value="right">Right</option></select>
                              <input value={(item as ArtistItem).link_url ?? ''} onChange={(e) => updateGalleryItem(groupKey, blockIndex, itemIndex, 'link_url', e.target.value)} placeholder="Optional text link URL" className={inputCls} disabled={!canEdit} />
                            </>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                <div className="flex items-center justify-between text-xs text-gray-500">
                  <span>{section.items.length} images</span>
                  <button type="button" onClick={() => addGalleryItem(groupKey, blockIndex)} disabled={!canEdit} className="inline-flex items-center gap-2 rounded border border-indigo-600 bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60"><i className="fa-solid fa-plus" />Add image</button>
                </div>
              </div>
            </SectionCard>
          )
        })}
        <div className="flex justify-end">
          <button type="button" onClick={() => addMediaSectionBlock(groupKey)} disabled={!canEdit} className="inline-flex items-center gap-2 rounded border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60">
            <i className="fa-solid fa-plus" />
            Add {titleBase} section
          </button>
        </div>
      </div>
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
      {renderGallerySection()}

      {/* Service Menu sections */}
      {renderMediaSectionBlocks('service_menus', 'Service Menu section', 'Upload images to appear under each service menu block on the landing page.', false)}

      {/* Our Artists sections */}
      {renderMediaSectionBlocks('our_artists_sections', 'Our Artists section', 'Upload artist cards with optional CTA link for each artists block.', true)}

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
              <InternationalPhoneInput
                value={sections.visit_studio.whatsapp_phone}
                onChange={(value) => updateVisitStudio({ whatsapp_phone: value })}
                className="mt-1"
                disabled={!canEdit}
                placeholder="WhatsApp phone number"
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
