'use client'

import type { ReactNode } from 'react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { IMAGE_ACCEPT } from './mediaAccept'

type ServicesMenuItem = {
  id: number
  name: string
  slug: string
  is_active: boolean
  sort_order: number
  page?: { id?: number; slug?: string } | null
}

type SectionHeading = { label: string; title: string; align: 'left' | 'center' | 'right' }

type ServicesSection<T> = {
  is_active: boolean
  items: T[]
  heading?: SectionHeading
}

type ServiceItem = { title: string; description: string }
type PricingItem = { label: string; price: string }
type FaqItem = { question: string; answer: string }
type GalleryItem = {
  src: string
  alt: string
  caption: string
  captionAlign: 'left' | 'center' | 'right'
}

type HeroSlide = {
  id?: number
  sort_order: number
  src: string
  mobileSrc: string
  title: string
  description: string
  buttonLabel: string
  buttonHref: string
}

type ServicesPagePayload = {
  id?: number
  menu_item_id: number
  title: string
  slug: string
  subtitle: string | null
  hero_slides: HeroSlide[]
  sections: {
    hero: ServicesSection<never>
    services: ServicesSection<ServiceItem> & { heading: SectionHeading }
    gallery: ServicesSection<GalleryItem> & {
      heading: SectionHeading
      footerText: string
      footerAlign: 'left' | 'center' | 'right'
      layout: 'auto' | 'fixed'
    }
    pricing: ServicesSection<PricingItem> & { heading: SectionHeading }
    faqs: ServicesSection<FaqItem> & { heading: SectionHeading }
    notes: ServicesSection<string> & {
      heading: SectionHeading
    }
  }
  is_active: boolean
}

type ApiResponse<T> = {
  data?: T
  success?: boolean
  message?: string | null
}

const emptySections: ServicesPagePayload['sections'] = {
  hero: { is_active: true, items: [] },
  services: {
    is_active: true,
    items: [],
    heading: { label: 'Services', title: "What's Included", align: 'left' },
  },
  gallery: {
    is_active: true,
    items: [],
    heading: { label: 'Service Menu', title: 'Click to view services and pricing', align: 'center' },
    footerText: '',
    footerAlign: 'center',
    layout: 'fixed',
  },
  pricing: {
    is_active: true,
    items: [],
    heading: { label: 'Pricing', title: 'Transparent rates', align: 'left' },
  },
  faqs: {
    is_active: true,
    items: [],
    heading: { label: 'FAQ', title: 'You might be wondering', align: 'left' },
  },
  notes: {
    is_active: true,
    items: [],
    heading: { label: 'Notes', title: 'Policy & care', align: 'left' },
  },
}

const emptySlide: HeroSlide = {
  sort_order: 1,
  src: '',
  mobileSrc: '',
  title: '',
  description: '',
  buttonLabel: '',
  buttonHref: '',
}

function normalizeMenuItems(input: unknown): ServicesMenuItem[] {
  if (!input || typeof input !== 'object') return []
  const payload = input as {
    data?: unknown
  }

  const raw = payload.data
  if (Array.isArray(raw)) return raw as ServicesMenuItem[]
  if (raw && typeof raw === 'object' && Array.isArray((raw as { data?: unknown }).data)) {
    return (raw as { data: ServicesMenuItem[] }).data
  }
  return []
}

function ensureSections(sections: Partial<ServicesPagePayload['sections']> | undefined) {
  const mergeHeading = (heading: Partial<SectionHeading> | undefined, fallback: SectionHeading) => ({
    ...fallback,
    ...(heading ?? {}),
  })

  const mergeSection = <T,>(
    section: (ServicesSection<T> & { heading?: SectionHeading } & Record<string, unknown>) | undefined,
    fallback: ServicesSection<T> & { heading?: SectionHeading } & Record<string, unknown>,
  ) => {
    const merged = {
      ...fallback,
      ...(section ?? {}),
      items: Array.isArray(section?.items) ? section.items : fallback.items,
    }
    if (fallback.heading) {
      merged.heading = mergeHeading(section?.heading, fallback.heading)
    }
    return merged
  }

  return {
    hero: sections?.hero ?? emptySections.hero,
    services: mergeSection(sections?.services, emptySections.services),
    gallery: {
      ...mergeSection(sections?.gallery, emptySections.gallery),
      items: (sections?.gallery?.items ?? []).map((item) => ({
        src: item?.src ?? '',
        alt: item?.alt ?? '',
        caption: item?.caption ?? '',
        captionAlign: item?.captionAlign ?? 'center',
      })),
      footerText: sections?.gallery?.footerText ?? emptySections.gallery.footerText,
      footerAlign: sections?.gallery?.footerAlign ?? emptySections.gallery.footerAlign,
      layout: sections?.gallery?.layout ?? emptySections.gallery.layout,
    },
    pricing: mergeSection(sections?.pricing, emptySections.pricing),
    faqs: mergeSection(sections?.faqs, emptySections.faqs),
    notes: mergeSection(sections?.notes, emptySections.notes),
  }
}

function ensureSlides(slides: Partial<HeroSlide>[] | undefined): HeroSlide[] {
  if (!slides?.length) return []
  const sorted = [...slides].sort(
    (a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0),
  )

  return sorted.map((slide, index) => {
    const description = slide.description ?? (slide as { subtitle?: string }).subtitle ?? ''
    return {
      ...emptySlide,
      ...slide,
      sort_order: index + 1,
      mobileSrc: slide.mobileSrc ?? '',
      description,
      title: slide.title ?? '',
      buttonLabel: slide.buttonLabel ?? '',
      buttonHref: slide.buttonHref ?? '',
      src: slide.src ?? '',
    }
  })
}

export default function ServicesPagesEditor({
  permissions,
  menuId,
}: {
  permissions: string[]
  menuId: number
}) {
  const canUpdate = permissions.includes('ecommerce.services-pages.update')

  const [menuItems, setMenuItems] = useState<ServicesMenuItem[]>([])
  const [page, setPage] = useState<ServicesPagePayload | null>(null)
  const [loadingMenus, setLoadingMenus] = useState(true)
  const [loadingPage, setLoadingPage] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [collapsedSlides, setCollapsedSlides] = useState<Record<number, boolean>>({})
  const [collapsedSections, setCollapsedSections] = useState<Record<string, boolean>>({})
  const [slideFiles, setSlideFiles] = useState<(File | null)[]>([])
  const [slideMobileFiles, setSlideMobileFiles] = useState<(File | null)[]>([])
  const [slidePreviews, setSlidePreviews] = useState<(string | null)[]>([])
  const [slideMobilePreviews, setSlideMobilePreviews] = useState<(string | null)[]>([])
  const [galleryFiles, setGalleryFiles] = useState<(File | null)[]>([])
  const [galleryPreviews, setGalleryPreviews] = useState<(string | null)[]>([])
  const desktopImageInputRefs = useRef<Map<number, HTMLInputElement>>(new Map())
  const mobileImageInputRefs = useRef<Map<number, HTMLInputElement>>(new Map())
  const galleryImageInputRefs = useRef<Map<number, HTMLInputElement>>(new Map())

  useEffect(() => {
    const controller = new AbortController()
    const loadMenus = async () => {
      setLoadingMenus(true)
      setError(null)
      try {
        const qs = new URLSearchParams({ per_page: '200' })
        const res = await fetch(`/api/proxy/ecommerce/services-menu-items?${qs.toString()}`, {
          cache: 'no-store',
          signal: controller.signal,
        })
        if (!res.ok) {
          throw new Error('Failed to load services menu items.')
        }
        const json: ApiResponse<unknown> = await res.json().catch(() => ({}))
        const items = normalizeMenuItems(json)
        setMenuItems(items)
      } catch (err) {
        if (!(err instanceof DOMException && err.name === 'AbortError')) {
          setError(err instanceof Error ? err.message : 'Failed to load services menu items.')
        }
      } finally {
        if (!controller.signal.aborted) {
          setLoadingMenus(false)
        }
      }
    }

    loadMenus()
    return () => controller.abort()
  }, [])

  const sortedMenus = useMemo(
    () => [...menuItems].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0)),
    [menuItems],
  )

  const selectedMenu = useMemo(
    () => sortedMenus.find((item) => item.id === menuId) ?? null,
    [sortedMenus, menuId],
  )

  useEffect(() => {
    const controller = new AbortController()
    const loadPage = async () => {
      setLoadingPage(true)
      setError(null)
      setNotice(null)
      try {
        const res = await fetch(`/api/proxy/ecommerce/services-pages/${menuId}`, {
          cache: 'no-store',
          signal: controller.signal,
        })
        if (!res.ok) {
          throw new Error('Failed to load services page.')
        }
        const json: ApiResponse<ServicesPagePayload> = await res.json().catch(() => ({}))
        const payload = json.data
        if (!payload) {
          throw new Error('Services page payload missing.')
        }
        const slides = ensureSlides(payload.hero_slides)
        const sections = ensureSections(payload.sections)
        setPage({
          ...payload,
          menu_item_id: payload.menu_item_id ?? menuId,
          hero_slides: slides,
          sections,
        })
        const slideCount = slides.length
        setSlideFiles(Array(slideCount).fill(null))
        setSlideMobileFiles(Array(slideCount).fill(null))
        setSlidePreviews(Array(slideCount).fill(null))
        setSlideMobilePreviews(Array(slideCount).fill(null))
        const galleryCount = sections.gallery.items.length
        setGalleryFiles(Array(galleryCount).fill(null))
        setGalleryPreviews(Array(galleryCount).fill(null))
      } catch (err) {
        if (!(err instanceof DOMException && err.name === 'AbortError')) {
          setError(err instanceof Error ? err.message : 'Failed to load services page.')
        }
      } finally {
        if (!controller.signal.aborted) {
          setLoadingPage(false)
        }
      }
    }

    loadPage()
    return () => controller.abort()
  }, [menuId])

  const updateSection = <T,>(
    key: keyof ServicesPagePayload['sections'],
    updater: (section: ServicesSection<T>) => ServicesSection<T>,
  ) => {
    setPage((prev) => {
      if (!prev) return prev
      const current = prev.sections[key] as ServicesSection<T>
      return {
        ...prev,
        sections: {
          ...prev.sections,
          [key]: updater(current),
        },
      }
    })
  }

  const resequenceSlides = (slides: HeroSlide[]) =>
    slides.map((slide, index) => ({ ...slide, sort_order: index + 1 }))

  const reorderFiles = <T,>(files: (T | null)[], index: number, targetIndex: number) => {
    const next = [...files]
    const [moved] = next.splice(index, 1)
    next.splice(targetIndex, 0, moved ?? null)
    return next
  }

  const ensureArrayLength = <T,>(items: (T | null)[], length: number) => {
    if (items.length >= length) return [...items]
    return [...items, ...Array(length - items.length).fill(null)]
  }

  const setSlideFileAt = (index: number, file: File | null, previewUrl: string | null, isMobile: boolean) => {
    if (isMobile) {
      setSlideMobileFiles((prevFiles) => {
        const next = ensureArrayLength(prevFiles, index + 1)
        next[index] = file
        return next
      })
      setSlideMobilePreviews((prevFiles) => {
        const next = ensureArrayLength(prevFiles, index + 1)
        next[index] = previewUrl
        return next
      })
      return
    }

    setSlideFiles((prevFiles) => {
      const next = ensureArrayLength(prevFiles, index + 1)
      next[index] = file
      return next
    })
    setSlidePreviews((prevFiles) => {
      const next = ensureArrayLength(prevFiles, index + 1)
      next[index] = previewUrl
      return next
    })
  }

  const handleDesktopImageClick = (index: number) => {
    desktopImageInputRefs.current.get(index)?.click()
  }

  const handleMobileImageClick = (index: number) => {
    mobileImageInputRefs.current.get(index)?.click()
  }

  const handleDesktopImageChange = (index: number, event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return
    const previewUrl = URL.createObjectURL(file)
    setSlideFileAt(index, file, previewUrl, false)
  }

  const handleMobileImageChange = (index: number, event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return
    const previewUrl = URL.createObjectURL(file)
    setSlideFileAt(index, file, previewUrl, true)
  }

  const handleRemoveDesktopImage = (index: number) => {
    setSlideFileAt(index, null, null, false)
    updateSlide(index, (prev) => ({ ...prev, src: '' }))
    const input = desktopImageInputRefs.current.get(index)
    if (input) {
      input.value = ''
    }
  }

  const handleRemoveMobileImage = (index: number) => {
    setSlideFileAt(index, null, null, true)
    updateSlide(index, (prev) => ({ ...prev, mobileSrc: '' }))
    const input = mobileImageInputRefs.current.get(index)
    if (input) {
      input.value = ''
    }
  }

  const setGalleryFileAt = (index: number, file: File | null, previewUrl: string | null) => {
    setGalleryFiles((prevFiles) => {
      const next = ensureArrayLength(prevFiles, index + 1)
      next[index] = file
      return next
    })
    setGalleryPreviews((prevFiles) => {
      const next = ensureArrayLength(prevFiles, index + 1)
      next[index] = previewUrl
      return next
    })
  }

  const handleGalleryImageClick = (index: number) => {
    galleryImageInputRefs.current.get(index)?.click()
  }

  const handleGalleryImageChange = (index: number, event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return
    const previewUrl = URL.createObjectURL(file)
    setGalleryFileAt(index, file, previewUrl)
  }

  const handleRemoveGalleryItem = (index: number) => {
    setGalleryFiles((prevFiles) => prevFiles.filter((_, idx) => idx !== index))
    setGalleryPreviews((prevPreviews) => prevPreviews.filter((_, idx) => idx !== index))
    updateSection<GalleryItem>('gallery', (section) => ({
      ...section,
      items: section.items.filter((_, idx) => idx !== index),
    }))
    const input = galleryImageInputRefs.current.get(index)
    if (input) {
      input.value = ''
    }
  }

  const addGalleryItem = () => {
    updateSection<GalleryItem>('gallery', (section) => ({
      ...section,
      items: [
        ...section.items,
        {
          src: '',
          alt: '',
          caption: '',
          captionAlign: 'center',
        },
      ],
    }))
    setGalleryFiles((prev) => [...prev, null])
    setGalleryPreviews((prev) => [...prev, null])
  }

  const toggleSlideCollapsed = (index: number) => {
    setCollapsedSlides((prev) => ({ ...prev, [index]: !prev[index] }))
  }

  const moveSlide = (index: number, direction: -1 | 1) => {
    setPage((prev) => {
      if (!prev) return prev
      const targetIndex = index + direction
      if (targetIndex < 0 || targetIndex >= prev.hero_slides.length) {
        return prev
      }
      const slides = [...prev.hero_slides]
      const [moved] = slides.splice(index, 1)
      slides.splice(targetIndex, 0, moved)
      setSlideFiles((prevFiles) => reorderFiles(prevFiles, index, targetIndex))
      setSlideMobileFiles((prevFiles) => reorderFiles(prevFiles, index, targetIndex))
      setSlidePreviews((prevFiles) => reorderFiles(prevFiles, index, targetIndex))
      setSlideMobilePreviews((prevFiles) => reorderFiles(prevFiles, index, targetIndex))
      setCollapsedSlides({})
      return { ...prev, hero_slides: resequenceSlides(slides) }
    })
  }

  const updateSlide = (index: number, updater: (slide: HeroSlide) => HeroSlide) => {
    setPage((prev) => {
      if (!prev) return prev
      const slides = prev.hero_slides.map((slide, idx) =>
        idx === index ? updater(slide) : slide,
      )
      return { ...prev, hero_slides: resequenceSlides(slides) }
    })
  }

  const addSlide = () => {
    setPage((prev) => {
      if (!prev) return prev
      const nextSlide: HeroSlide = {
        ...emptySlide,
        sort_order: prev.hero_slides.length + 1,
      }
      setSlideFiles((prevFiles) => [...prevFiles, null])
      setSlideMobileFiles((prevFiles) => [...prevFiles, null])
      setSlidePreviews((prevFiles) => [...prevFiles, null])
      setSlideMobilePreviews((prevFiles) => [...prevFiles, null])
      return {
        ...prev,
        hero_slides: [...prev.hero_slides, nextSlide],
      }
    })
  }

  const removeSlide = (index: number) => {
    setPage((prev) => {
      if (!prev) return prev
      setSlideFiles((prevFiles) => prevFiles.filter((_, idx) => idx !== index))
      setSlideMobileFiles((prevFiles) => prevFiles.filter((_, idx) => idx !== index))
      setSlidePreviews((prevFiles) => prevFiles.filter((_, idx) => idx !== index))
      setSlideMobilePreviews((prevFiles) => prevFiles.filter((_, idx) => idx !== index))
      setCollapsedSlides({})
      return {
        ...prev,
        hero_slides: resequenceSlides(prev.hero_slides.filter((_, idx) => idx !== index)),
      }
    })
  }

  const toggleSectionCollapsed = (sectionKey: string) => {
    setCollapsedSections((prev) => ({
      ...prev,
      [sectionKey]: !prev[sectionKey],
    }))
  }

  const handleSave = async () => {
    if (!page || !selectedMenu) return
    setSaving(true)
    setError(null)
    setNotice(null)
    try {
      const heroActive = page.sections.hero.is_active
      const hasMissingImages =
        heroActive &&
        page.hero_slides.some((slide, index) => !slide.src && !slideFiles[index])
      if (hasMissingImages) {
        setError('Each slide needs a desktop image before saving.')
        setSaving(false)
        return
      }

      const formData = new FormData()
      formData.append('_method', 'PUT')
      formData.append('title', selectedMenu.name)
      formData.append('slug', selectedMenu.slug)
      formData.append('subtitle', page.subtitle ?? '')
      formData.append('is_active', page.is_active ? '1' : '0')
      formData.append('sections', JSON.stringify(page.sections))

      page.hero_slides.forEach((slide, index) => {
        formData.append(`hero_slides[${index}][sort_order]`, String(slide.sort_order))
        formData.append(`hero_slides[${index}][src]`, slide.src)
        formData.append(`hero_slides[${index}][mobileSrc]`, slide.mobileSrc)
        formData.append(`hero_slides[${index}][title]`, slide.title)
        formData.append(`hero_slides[${index}][description]`, slide.description)
        formData.append(`hero_slides[${index}][buttonLabel]`, slide.buttonLabel)
        formData.append(`hero_slides[${index}][buttonHref]`, slide.buttonHref)

        const imageFile = slideFiles[index]
        if (imageFile) {
          formData.append(`hero_slides[${index}][image_file]`, imageFile)
        }

        const mobileImageFile = slideMobileFiles[index]
        if (mobileImageFile) {
          formData.append(`hero_slides[${index}][mobile_image_file]`, mobileImageFile)
        }
      })

      page.sections.gallery.items.forEach((_, index) => {
        const imageFile = galleryFiles[index]
        if (imageFile) {
          formData.append(`gallery_images[${index}]`, imageFile)
        }
      })

      const res = await fetch(`/api/proxy/ecommerce/services-pages/${menuId}`, {
        method: 'POST',
        headers: {
          Accept: 'application/json',
        },
        body: formData,
      })

      const json: ApiResponse<ServicesPagePayload> = await res.json().catch(() => ({}))
      if (!res.ok || !json.data) {
        throw new Error(json.message || 'Failed to save services page.')
      }

      const payload = json.data
      const slides = ensureSlides(payload.hero_slides)
      const sections = ensureSections(payload.sections)
      setPage({
        ...payload,
        hero_slides: slides,
        sections,
      })
      const slideCount = slides.length
      setSlideFiles(Array(slideCount).fill(null))
      setSlideMobileFiles(Array(slideCount).fill(null))
      setSlidePreviews(Array(slideCount).fill(null))
      setSlideMobilePreviews(Array(slideCount).fill(null))
      const galleryCount = sections.gallery.items.length
      setGalleryFiles(Array(galleryCount).fill(null))
      setGalleryPreviews(Array(galleryCount).fill(null))

      setMenuItems((prev) =>
        prev.map((item) =>
          item.id === menuId
            ? { ...item, is_active: payload.is_active }
            : item,
        ),
      )
      setNotice('Saved! Changes are published together.')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save services page.')
    } finally {
      setSaving(false)
    }
  }

  if (loadingMenus) {
    return <div className="rounded-lg border border-gray-200 bg-white p-6 text-sm text-gray-500">Loading services menus...</div>
  }

  if (!sortedMenus.length) {
    return (
      <div className="rounded-lg border border-amber-200 bg-amber-50 p-6 text-sm text-amber-800">
        Create at least one Services Menu item before editing pages.
      </div>
    )
  }

  return (
    <div className="space-y-6">
     
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {notice && (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          {notice}
        </div>
      )}

      {loadingPage || !page ? (
        <div className="rounded-lg border border-gray-200 bg-white p-6 text-sm text-gray-500">Loading services page...</div>
      ) : (
        <div className="space-y-6">
          <section className="rounded-lg border border-gray-200 bg-white p-6">
            <div className="mb-4 flex flex-col gap-1">
              <h3 className="text-base font-semibold text-gray-900">Page basics</h3>
              <p className="text-xs text-gray-500">Review the selected services menu and set the page status.</p>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <label className="space-y-1 text-sm text-gray-700">
                <span className="font-medium">Services Menu</span>
                <select
                  value={menuId}
                  className="w-full rounded border border-gray-300 bg-gray-100 px-3 py-2 text-sm text-gray-600 focus:outline-none"
                  disabled
                >
                  {selectedMenu && (
                    <option value={selectedMenu.id}>
                      {selectedMenu.name} ({selectedMenu.slug})
                    </option>
                  )}
                </select>
                <p className="text-[11px] text-gray-400">Services Menu cannot be changed here.</p>
              </label>
              <label className="space-y-1 text-sm text-gray-700">
                <span className="font-medium">Status</span>
                <select
                  value={page.is_active ? 'active' : 'inactive'}
                  onChange={(e) =>
                    setPage({ ...page, is_active: e.target.value === 'active' })
                  }
                  className="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  disabled={!canUpdate || saving}
                >
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                </select>
              </label>
            </div>
          </section>

          <SectionCard
            sectionKey="hero"
            title="Slider section"
            description="Controls the hero slider content on the services page."
            active={page.sections.hero.is_active}
            onToggle={(value) => {
              setPage((prev) => {
                if (!prev) return prev
                const shouldSeedSlide = value && prev.hero_slides.length === 0
                if (shouldSeedSlide) {
                  setSlideFiles([null])
                  setSlideMobileFiles([null])
                  setSlidePreviews([null])
                  setSlideMobilePreviews([null])
                }
                return {
                  ...prev,
                  hero_slides: shouldSeedSlide
                    ? [{ ...emptySlide, sort_order: 1 }]
                    : prev.hero_slides,
                  sections: {
                    ...prev.sections,
                    hero: {
                      ...prev.sections.hero,
                      is_active: value,
                    },
                  },
                }
              })
            }}
            canUpdate={canUpdate}
            toggleLabel={page.sections.hero.is_active ? 'Enabled' : 'Disabled'}
            collapsed={collapsedSections.hero ?? false}
            onToggleCollapse={() => toggleSectionCollapsed('hero')}
          >
            {page.hero_slides.length === 0 ? (
              <div className="rounded-lg border border-dashed border-gray-200 bg-gray-50 px-4 py-6 text-center text-sm text-gray-500">
                No slides yet. Toggle the section on to add slides.
              </div>
            ) : (
              <div className="space-y-4">
                {page.hero_slides.map((slide, index) => (
                  <div key={`slide-${index}`} className="rounded-lg border border-gray-100 bg-gray-50/60 p-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-gray-900">Slide {index + 1}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => moveSlide(index, -1)}
                          disabled={!canUpdate || index === 0}
                          className="rounded border border-gray-300 px-2 py-1 text-xs text-gray-600 hover:bg-gray-50 disabled:opacity-50"
                          aria-label="Move slide up"
                        >
                          <i className="fa-solid fa-arrow-up" />
                        </button>
                        <button
                          type="button"
                          onClick={() => moveSlide(index, 1)}
                          disabled={!canUpdate || index === page.hero_slides.length - 1}
                          className="rounded border border-gray-300 px-2 py-1 text-xs text-gray-600 hover:bg-gray-50 disabled:opacity-50"
                          aria-label="Move slide down"
                        >
                          <i className="fa-solid fa-arrow-down" />
                        </button>
                        <button
                          type="button"
                          onClick={() => toggleSlideCollapsed(index)}
                          className="rounded border border-gray-300 px-2 py-1 text-xs text-gray-600 hover:bg-gray-50"
                        >
                          <i className={`fa-solid ${collapsedSlides[index] ? 'fa-chevron-down' : 'fa-chevron-up'}`} />
                        </button>
                        <button
                          type="button"
                          onClick={() => removeSlide(index)}
                          disabled={!canUpdate}
                          className="rounded border border-red-200 px-2 py-1 text-xs text-red-600 hover:bg-red-50 disabled:opacity-50"
                        >
                          <i className="fa-solid fa-trash" />
                        </button>
                      </div>
                    </div>
                    {!collapsedSlides[index] && (
                      <div className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div>
                            <h3 className="text-sm font-medium text-gray-700">Desktop Image <span className="text-red-500">*</span></h3>
                            <p className="text-xs text-red-500 mb-2">Suggested size: 1920 x 848</p>
                            <div
                              onClick={() => canUpdate && handleDesktopImageClick(index)}
                              className={`relative border-2 border-dashed rounded-lg p-4 cursor-pointer transition-colors ${
                                (slidePreviews[index] ?? slide.src)
                                  ? 'border-gray-300'
                                  : 'border-gray-300 hover:border-blue-400'
                              } ${!canUpdate ? 'cursor-not-allowed opacity-50' : ''}`}
                            >
                              <input
                                ref={(el) => {
                                  if (el) {
                                    desktopImageInputRefs.current.set(index, el)
                                  } else {
                                    desktopImageInputRefs.current.delete(index)
                                  }
                                }}
                                type="file"
                                accept={IMAGE_ACCEPT}
                                onChange={(e) => handleDesktopImageChange(index, e)}
                                className="hidden"
                                disabled={!canUpdate}
                              />
                              {(slidePreviews[index] ?? slide.src) ? (
                                <div className="relative group h-64 flex items-center justify-center bg-gray-50 rounded">
                                  {/* eslint-disable-next-line @next/next/no-img-element */}
                                  <img
                                    src={slidePreviews[index] ?? slide.src}
                                    alt={slide.title || 'Desktop preview'}
                                    className="max-w-full max-h-full object-contain rounded"
                                  />
                                  <div className="absolute top-2 right-2 flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation()
                                        handleDesktopImageClick(index)
                                      }}
                                      className="w-8 h-8 bg-blue-500/95 backdrop-blur-md text-white rounded-full flex items-center justify-center shadow-lg border border-blue-400/30 hover:bg-blue-600 hover:shadow-xl hover:scale-110 transition-all duration-200"
                                      aria-label="Replace desktop image"
                                      disabled={!canUpdate}
                                    >
                                      <i className="fa-solid fa-image text-xs" />
                                    </button>
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation()
                                        handleRemoveDesktopImage(index)
                                      }}
                                      className="w-8 h-8 bg-red-500/95 backdrop-blur-md text-white rounded-full flex items-center justify-center shadow-lg border border-red-400/30 hover:bg-red-600 hover:shadow-xl hover:scale-110 transition-all duration-200"
                                      aria-label="Delete desktop image"
                                      disabled={!canUpdate}
                                    >
                                      <i className="fa-solid fa-trash-can text-xs" />
                                    </button>
                                  </div>
                                </div>
                              ) : (
                                <div className="flex flex-col items-center justify-center h-64">
                                  <i className="fa-solid fa-cloud-arrow-up text-4xl text-gray-400 mb-2" />
                                  <p className="text-sm text-gray-600">Click to upload</p>
                                </div>
                              )}
                            </div>
                          </div>

                          <div>
                            <h3 className="text-sm font-medium text-gray-700">Mobile Image</h3>
                            <p className="text-xs text-red-500 mb-2">Suggested size: 1410 x 1360</p>
                            <div
                              onClick={() => canUpdate && handleMobileImageClick(index)}
                              className={`relative border-2 border-dashed rounded-lg p-4 cursor-pointer transition-colors ${
                                (slideMobilePreviews[index] ?? slide.mobileSrc)
                                  ? 'border-gray-300'
                                  : 'border-gray-300 hover:border-blue-400'
                              } ${!canUpdate ? 'cursor-not-allowed opacity-50' : ''}`}
                            >
                              <input
                                ref={(el) => {
                                  if (el) {
                                    mobileImageInputRefs.current.set(index, el)
                                  } else {
                                    mobileImageInputRefs.current.delete(index)
                                  }
                                }}
                                type="file"
                                accept={IMAGE_ACCEPT}
                                onChange={(e) => handleMobileImageChange(index, e)}
                                className="hidden"
                                disabled={!canUpdate}
                              />
                              {(slideMobilePreviews[index] ?? slide.mobileSrc) ? (
                                <div className="relative group h-64 flex items-center justify-center bg-gray-50 rounded">
                                  {/* eslint-disable-next-line @next/next/no-img-element */}
                                  <img
                                    src={slideMobilePreviews[index] ?? slide.mobileSrc}
                                    alt={slide.title || 'Mobile preview'}
                                    className="max-w-full max-h-full object-contain rounded"
                                  />
                                  <div className="absolute top-2 right-2 flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation()
                                        handleMobileImageClick(index)
                                      }}
                                      className="w-8 h-8 bg-blue-500/95 backdrop-blur-md text-white rounded-full flex items-center justify-center shadow-lg border border-blue-400/30 hover:bg-blue-600 hover:shadow-xl hover:scale-110 transition-all duration-200"
                                      aria-label="Replace mobile image"
                                      disabled={!canUpdate}
                                    >
                                      <i className="fa-solid fa-image text-xs" />
                                    </button>
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation()
                                        handleRemoveMobileImage(index)
                                      }}
                                      className="w-8 h-8 bg-red-500/95 backdrop-blur-md text-white rounded-full flex items-center justify-center shadow-lg border border-red-400/30 hover:bg-red-600 hover:shadow-xl hover:scale-110 transition-all duration-200"
                                      aria-label="Delete mobile image"
                                      disabled={!canUpdate}
                                    >
                                      <i className="fa-solid fa-trash-can text-xs" />
                                    </button>
                                  </div>
                                </div>
                              ) : (
                                <div className="flex flex-col items-center justify-center h-64">
                                  <i className="fa-solid fa-cloud-arrow-up text-4xl text-gray-400 mb-2" />
                                  <p className="text-sm text-gray-600">Click to upload</p>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                        <div className="space-y-3">
                          <div className="space-y-1">
                            <label className="text-xs font-medium uppercase tracking-wide text-gray-500">Title</label>
                            <input
                              value={slide.title}
                              onChange={(e) => updateSlide(index, (prev) => ({ ...prev, title: e.target.value }))}
                              placeholder="Title"
                              className="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                              disabled={!canUpdate}
                            />
                          </div>
                          <div className="space-y-1">
                            <label className="text-xs font-medium uppercase tracking-wide text-gray-500">Description</label>
                            <textarea
                              value={slide.description}
                              onChange={(e) => updateSlide(index, (prev) => ({ ...prev, description: e.target.value }))}
                              placeholder="Description"
                              rows={5}
                              className="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                              disabled={!canUpdate}
                            />
                          </div>
                          <div className="grid gap-3 md:grid-cols-2">
                            <div className="space-y-1">
                              <label className="text-xs font-medium uppercase tracking-wide text-gray-500">Button label</label>
                              <input
                                value={slide.buttonLabel}
                                onChange={(e) => updateSlide(index, (prev) => ({ ...prev, buttonLabel: e.target.value }))}
                                placeholder="Button label"
                                className="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                                disabled={!canUpdate}
                              />
                            </div>
                            <div className="space-y-1">
                              <label className="text-xs font-medium uppercase tracking-wide text-gray-500">Button link</label>
                              <input
                                value={slide.buttonHref}
                                onChange={(e) => updateSlide(index, (prev) => ({ ...prev, buttonHref: e.target.value }))}
                                placeholder="Button link"
                                className="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                                disabled={!canUpdate}
                              />
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
                <div className="flex">
                  <button
                    type="button"
                    onClick={addSlide}
                    disabled={!canUpdate}
                    className="inline-flex items-center gap-2 rounded border border-dashed border-blue-300 px-3 py-2 text-xs font-medium text-blue-700 hover:border-blue-400 hover:text-blue-800 disabled:opacity-50"
                  >
                    <i className="fa-solid fa-plus" />
                    Add slide
                  </button>
                </div>
              </div>
            )}
          </SectionCard>

          <SectionCard
            sectionKey="services"
            title="Services section"
            description="Highlights the key offerings using the existing ServicesPageLayout cards."
            active={page.sections.services.is_active}
            onToggle={(value) => updateSection<ServiceItem>('services', (section) => ({ ...section, is_active: value }))}
            canUpdate={canUpdate}
            collapsed={collapsedSections.services ?? false}
            onToggleCollapse={() => toggleSectionCollapsed('services')}
          >
            <SectionHeadingFields
              heading={page.sections.services.heading}
              onChange={(heading) =>
                updateSection<ServiceItem>('services', (section) => ({ ...section, heading }))
              }
              canUpdate={canUpdate}
            />
            <EditableList
              items={page.sections.services.items}
              canUpdate={canUpdate}
              onAdd={() => updateSection<ServiceItem>('services', (section) => ({
                ...section,
                items: [...section.items, { title: '', description: '' }],
              }))}
              onRemove={(index) => updateSection<ServiceItem>('services', (section) => ({
                ...section,
                items: section.items.filter((_, idx) => idx !== index),
              }))}
              renderItem={(item, index) => (
                <div className="grid gap-3 md:grid-cols-2">
                  <input
                    value={item.title}
                    onChange={(e) =>
                      updateSection<ServiceItem>('services', (section) => ({
                        ...section,
                        items: section.items.map((entry, idx) =>
                          idx === index ? { ...entry, title: e.target.value } : entry,
                        ),
                      }))
                    }
                    placeholder="Title"
                    className="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    disabled={!canUpdate}
                  />
                  <input
                    value={item.description}
                    onChange={(e) =>
                      updateSection<ServiceItem>('services', (section) => ({
                        ...section,
                        items: section.items.map((entry, idx) =>
                          idx === index ? { ...entry, description: e.target.value } : entry,
                        ),
                      }))
                    }
                    placeholder="Description"
                    className="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    disabled={!canUpdate}
                  />
                </div>
              )}
            />
          </SectionCard>

          <SectionCard
            sectionKey="gallery"
            title="Gallery section"
            description="Upload up to 16 images to appear above the pricing list."
            active={page.sections.gallery.is_active}
            onToggle={(value) => updateSection<GalleryItem>('gallery', (section) => ({ ...section, is_active: value }))}
            canUpdate={canUpdate}
            collapsed={collapsedSections.gallery ?? false}
            onToggleCollapse={() => toggleSectionCollapsed('gallery')}
          >
            <div className="space-y-4">
              <SectionHeadingFields
                heading={page.sections.gallery.heading}
                onChange={(heading) =>
                  updateSection<GalleryItem>('gallery', (section) => ({ ...section, heading }))
                }
                canUpdate={canUpdate}
              />
              <div className="grid gap-3 md:grid-cols-2">
                <label className="space-y-1 text-xs uppercase tracking-wide text-gray-500">
                  <span className="font-medium">Footer text</span>
                  <input
                    value={page.sections.gallery.footerText}
                    onChange={(e) =>
                      updateSection<GalleryItem>('gallery', (section) => ({
                        ...section,
                        footerText: e.target.value,
                      }))
                    }
                    placeholder="Optional footer text"
                    className="w-full rounded border border-gray-300 px-3 py-2 text-sm text-gray-700 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    disabled={!canUpdate}
                  />
                </label>
                <label className="space-y-1 text-xs uppercase tracking-wide text-gray-500">
                  <span className="font-medium">Footer alignment</span>
                  <select
                    value={page.sections.gallery.footerAlign}
                    onChange={(e) =>
                      updateSection<GalleryItem>('gallery', (section) => ({
                        ...section,
                        footerAlign: e.target.value as ServicesPagePayload['sections']['gallery']['footerAlign'],
                      }))
                    }
                    className="w-full rounded border border-gray-300 px-3 py-2 text-sm text-gray-700 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    disabled={!canUpdate}
                  >
                    <option value="left">Left</option>
                    <option value="center">Center</option>
                    <option value="right">Right</option>
                  </select>
                </label>
              </div>
              <label className="space-y-1 text-xs uppercase tracking-wide text-gray-500">
                <span className="font-medium">Grid layout</span>
                <select
                  value={page.sections.gallery.layout}
                  onChange={(e) =>
                    updateSection<GalleryItem>('gallery', (section) => ({
                      ...section,
                      layout: e.target.value as ServicesPagePayload['sections']['gallery']['layout'],
                    }))
                  }
                  className="w-full rounded border border-gray-300 px-3 py-2 text-sm text-gray-700 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  disabled={!canUpdate}
                >
                  <option value="fixed">Fixed 4 per row</option>
                  <option value="auto">Auto responsive</option>
                </select>
              </label>
              {page.sections.gallery.items.length === 0 ? (
                <div className="rounded-lg border border-dashed border-gray-200 bg-gray-50 px-4 py-6 text-center text-sm text-gray-500">
                  No images yet. Add up to 16 images to build the gallery grid.
                </div>
              ) : (
                <div className="grid gap-4 md:grid-cols-2">
                  {page.sections.gallery.items.map((item, index) => (
                    <div key={`gallery-${index}`} className="rounded-lg border border-gray-100 bg-gray-50/60 p-4">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-sm font-semibold text-gray-900">Image {index + 1}</p>
                        <button
                          type="button"
                          onClick={() => handleRemoveGalleryItem(index)}
                          disabled={!canUpdate}
                          className="rounded border border-red-200 px-2 py-1 text-xs text-red-600 hover:bg-red-50 disabled:opacity-50"
                        >
                          <i className="fa-solid fa-trash" />
                        </button>
                      </div>
                      <div className="mt-3 space-y-3">
                        <div
                          onClick={() => canUpdate && handleGalleryImageClick(index)}
                          className={`relative border-2 border-dashed rounded-lg p-3 cursor-pointer transition-colors ${
                            (galleryPreviews[index] ?? item.src)
                              ? 'border-gray-300'
                              : 'border-gray-300 hover:border-blue-400'
                          } ${!canUpdate ? 'cursor-not-allowed opacity-50' : ''}`}
                        >
                          <input
                            ref={(el) => {
                              if (el) {
                                galleryImageInputRefs.current.set(index, el)
                              } else {
                                galleryImageInputRefs.current.delete(index)
                              }
                            }}
                            type="file"
                            accept={IMAGE_ACCEPT}
                            onChange={(e) => handleGalleryImageChange(index, e)}
                            className="hidden"
                            disabled={!canUpdate}
                          />
                          {(galleryPreviews[index] ?? item.src) ? (
                            <div className="relative group h-48 flex items-center justify-center bg-gray-50 rounded">
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img
                                src={galleryPreviews[index] ?? item.src}
                                alt={item.alt || `Gallery image ${index + 1}`}
                                className="max-w-full max-h-full object-contain rounded"
                              />
                              <div className="absolute top-2 right-2 flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    handleGalleryImageClick(index)
                                  }}
                                  className="w-8 h-8 bg-blue-500/95 backdrop-blur-md text-white rounded-full flex items-center justify-center shadow-lg border border-blue-400/30 hover:bg-blue-600 hover:shadow-xl hover:scale-110 transition-all duration-200"
                                  aria-label="Replace gallery image"
                                  disabled={!canUpdate}
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
                        <div className="space-y-2">
                          <input
                            value={item.caption}
                            onChange={(e) =>
                              updateSection<GalleryItem>('gallery', (section) => ({
                                ...section,
                                items: section.items.map((entry, idx) =>
                                  idx === index ? { ...entry, caption: e.target.value } : entry,
                                ),
                              }))
                            }
                            placeholder="Caption"
                            className="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                            disabled={!canUpdate}
                          />
                          <div className="grid gap-2 md:grid-cols-2">
                            <input
                              value={item.alt}
                              onChange={(e) =>
                                updateSection<GalleryItem>('gallery', (section) => ({
                                  ...section,
                                  items: section.items.map((entry, idx) =>
                                    idx === index ? { ...entry, alt: e.target.value } : entry,
                                  ),
                                }))
                              }
                              placeholder="Alt text"
                              className="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                              disabled={!canUpdate}
                            />
                            <select
                              value={item.captionAlign}
                              onChange={(e) =>
                                updateSection<GalleryItem>('gallery', (section) => ({
                                  ...section,
                                  items: section.items.map((entry, idx) =>
                                    idx === index
                                      ? { ...entry, captionAlign: e.target.value as GalleryItem['captionAlign'] }
                                      : entry,
                                  ),
                                }))
                              }
                              className="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                              disabled={!canUpdate}
                            >
                              <option value="left">Caption left</option>
                              <option value="center">Caption center</option>
                              <option value="right">Caption right</option>
                            </select>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              <div className="flex items-center justify-between text-xs text-gray-500">
                <span>{page.sections.gallery.items.length} / 16 images</span>
                <button
                  type="button"
                  onClick={addGalleryItem}
                  disabled={!canUpdate || page.sections.gallery.items.length >= 16}
                  className="inline-flex items-center gap-2 rounded border border-dashed border-blue-300 px-3 py-2 text-xs font-medium text-blue-700 hover:border-blue-400 hover:text-blue-800 disabled:opacity-50"
                >
                  <i className="fa-solid fa-plus" />
                  Add image
                </button>
              </div>
            </div>
          </SectionCard>

          <SectionCard
            sectionKey="pricing"
            title="Pricing section"
            description="Controls the price list cards."
            active={page.sections.pricing.is_active}
            onToggle={(value) => updateSection<PricingItem>('pricing', (section) => ({ ...section, is_active: value }))}
            canUpdate={canUpdate}
            collapsed={collapsedSections.pricing ?? false}
            onToggleCollapse={() => toggleSectionCollapsed('pricing')}
          >
            <SectionHeadingFields
              heading={page.sections.pricing.heading}
              onChange={(heading) =>
                updateSection<PricingItem>('pricing', (section) => ({ ...section, heading }))
              }
              canUpdate={canUpdate}
            />
            <EditableList
              items={page.sections.pricing.items}
              canUpdate={canUpdate}
              onAdd={() => updateSection<PricingItem>('pricing', (section) => ({
                ...section,
                items: [...section.items, { label: '', price: '' }],
              }))}
              onRemove={(index) => updateSection<PricingItem>('pricing', (section) => ({
                ...section,
                items: section.items.filter((_, idx) => idx !== index),
              }))}
              renderItem={(item, index) => (
                <div className="grid gap-3 md:grid-cols-2">
                  <input
                    value={item.label}
                    onChange={(e) =>
                      updateSection<PricingItem>('pricing', (section) => ({
                        ...section,
                        items: section.items.map((entry, idx) =>
                          idx === index ? { ...entry, label: e.target.value } : entry,
                        ),
                      }))
                    }
                    placeholder="Label"
                    className="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    disabled={!canUpdate}
                  />
                  <input
                    value={item.price}
                    onChange={(e) =>
                      updateSection<PricingItem>('pricing', (section) => ({
                        ...section,
                        items: section.items.map((entry, idx) =>
                          idx === index ? { ...entry, price: e.target.value } : entry,
                        ),
                      }))
                    }
                    placeholder="Price"
                    className="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    disabled={!canUpdate}
                  />
                </div>
              )}
            />
          </SectionCard>

          <SectionCard
            sectionKey="faqs"
            title="FAQ section"
            description="Pairs each question with an expandable answer."
            active={page.sections.faqs.is_active}
            onToggle={(value) => updateSection<FaqItem>('faqs', (section) => ({ ...section, is_active: value }))}
            canUpdate={canUpdate}
            collapsed={collapsedSections.faqs ?? false}
            onToggleCollapse={() => toggleSectionCollapsed('faqs')}
          >
            <SectionHeadingFields
              heading={page.sections.faqs.heading}
              onChange={(heading) =>
                updateSection<FaqItem>('faqs', (section) => ({ ...section, heading }))
              }
              canUpdate={canUpdate}
            />
            <EditableList
              items={page.sections.faqs.items}
              canUpdate={canUpdate}
              onAdd={() => updateSection<FaqItem>('faqs', (section) => ({
                ...section,
                items: [...section.items, { question: '', answer: '' }],
              }))}
              onRemove={(index) => updateSection<FaqItem>('faqs', (section) => ({
                ...section,
                items: section.items.filter((_, idx) => idx !== index),
              }))}
              renderItem={(item, index) => (
                <div className="grid gap-3 md:grid-cols-2">
                  <input
                    value={item.question}
                    onChange={(e) =>
                      updateSection<FaqItem>('faqs', (section) => ({
                        ...section,
                        items: section.items.map((entry, idx) =>
                          idx === index ? { ...entry, question: e.target.value } : entry,
                        ),
                      }))
                    }
                    placeholder="Question"
                    className="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    disabled={!canUpdate}
                  />
                  <input
                    value={item.answer}
                    onChange={(e) =>
                      updateSection<FaqItem>('faqs', (section) => ({
                        ...section,
                        items: section.items.map((entry, idx) =>
                          idx === index ? { ...entry, answer: e.target.value } : entry,
                        ),
                      }))
                    }
                    placeholder="Answer"
                    className="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    disabled={!canUpdate}
                  />
                </div>
              )}
            />
          </SectionCard>

          <SectionCard
            sectionKey="notes"
            title="Notes section"
            description="Shows the policy & care notes list."
            active={page.sections.notes.is_active}
            onToggle={(value) => updateSection<string>('notes', (section) => ({ ...section, is_active: value }))}
            canUpdate={canUpdate}
            toggleLabel={page.sections.notes.is_active ? 'Enabled' : 'Disabled'}
            collapsed={collapsedSections.notes ?? false}
            onToggleCollapse={() => toggleSectionCollapsed('notes')}
          >
            <SectionHeadingFields
              heading={page.sections.notes.heading}
              onChange={(heading) =>
                updateSection<string>('notes', (section) => ({ ...section, heading }))
              }
              canUpdate={canUpdate}
            />
            <EditableList
              items={page.sections.notes.items}
              canUpdate={canUpdate}
              onAdd={() => updateSection<string>('notes', (section) => ({
                ...section,
                items: [...section.items, ''],
              }))}
              onRemove={(index) => updateSection<string>('notes', (section) => ({
                ...section,
                items: section.items.filter((_, idx) => idx !== index),
              }))}
              renderItem={(item, index) => (
                <input
                  value={item}
                  onChange={(e) =>
                    updateSection<string>('notes', (section) => ({
                      ...section,
                      items: section.items.map((entry, idx) => (idx === index ? e.target.value : entry)),
                    }))
                  }
                  placeholder="Note"
                  className="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  disabled={!canUpdate}
                />
              )}
            />
          </SectionCard>

          <div className="flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={handleSave}
              disabled={!canUpdate || saving || loadingPage}
              className="inline-flex items-center gap-2 rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {saving ? (
                <>
                  <i className="fa-solid fa-spinner animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <i className="fa-solid fa-floppy-disk" />
                  Save changes
                </>
              )}
            </button>
          </div>
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
  toggleLabel,
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
  toggleLabel?: string
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
            {toggleLabel ?? 'Enabled'}
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
      {!collapsed && (
        <div id={`${sectionKey}-section-content`}>
          {children}
        </div>
      )}
    </section>
  )
}

function SectionHeadingFields({
  heading,
  onChange,
  canUpdate,
}: {
  heading: SectionHeading
  onChange: (heading: SectionHeading) => void
  canUpdate: boolean
}) {
  return (
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
      <label className="space-y-1 text-xs uppercase tracking-wide text-gray-500">
        <span className="font-medium">Alignment</span>
        <select
          value={heading.align}
          onChange={(e) => onChange({ ...heading, align: e.target.value as SectionHeading['align'] })}
          className="w-full rounded border border-gray-300 px-3 py-2 text-sm text-gray-700 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          disabled={!canUpdate}
        >
          <option value="left">Left</option>
          <option value="center">Center</option>
          <option value="right">Right</option>
        </select>
      </label>
    </div>
  )
}

function EditableList<T>({
  items,
  onAdd,
  onRemove,
  renderItem,
  canUpdate,
}: {
  items: T[]
  onAdd: () => void
  onRemove: (index: number) => void
  renderItem: (item: T, index: number) => ReactNode
  canUpdate: boolean
}) {
  return (
    <div className="space-y-3">
      {items.map((item, index) => (
        <div key={index} className="rounded-lg border border-gray-100 bg-gray-50/60 p-3">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wide text-gray-400">
              Item {index + 1}
            </span>
            <button
              type="button"
              onClick={() => onRemove(index)}
              disabled={!canUpdate}
              className="rounded border border-red-200 px-2 py-1 text-xs text-red-600 hover:bg-red-50 disabled:opacity-50"
            >
               <i className="fa-solid fa-trash" />
            </button>
          </div>
          {renderItem(item, index)}
        </div>
      ))}
      <button
        type="button"
        onClick={onAdd}
        disabled={!canUpdate}
        className="inline-flex items-center gap-2 rounded border border-dashed border-blue-300 px-3 py-2 text-xs font-medium text-blue-700 hover:border-blue-400 hover:text-blue-800 disabled:opacity-50"
      >
        <i className="fa-solid fa-plus" />
        Add item
      </button>
    </div>
  )
}
