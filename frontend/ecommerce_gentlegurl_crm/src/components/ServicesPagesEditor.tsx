'use client'

import type { ReactNode } from 'react'
import { useEffect, useMemo, useState } from 'react'

type ServicesMenuItem = {
  id: number
  name: string
  slug: string
  is_active: boolean
  sort_order: number
  page?: { id?: number; slug?: string } | null
}

type ServicesSection<T> = {
  is_active: boolean
  items: T[]
}

type ServiceItem = { title: string; description: string }
type PricingItem = { label: string; price: string }
type FaqItem = { question: string; answer: string }

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
    services: ServicesSection<ServiceItem>
    pricing: ServicesSection<PricingItem>
    faqs: ServicesSection<FaqItem>
    notes: ServicesSection<string>
  }
  is_active: boolean
}

type ApiResponse<T> = {
  data?: T
  success?: boolean
  message?: string | null
}

const emptySections: ServicesPagePayload['sections'] = {
  services: { is_active: true, items: [] },
  pricing: { is_active: true, items: [] },
  faqs: { is_active: true, items: [] },
  notes: { is_active: true, items: [] },
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
  return {
    services: sections?.services ?? emptySections.services,
    pricing: sections?.pricing ?? emptySections.pricing,
    faqs: sections?.faqs ?? emptySections.faqs,
    notes: sections?.notes ?? emptySections.notes,
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
  const [slideFiles, setSlideFiles] = useState<(File | null)[]>([])
  const [slideMobileFiles, setSlideMobileFiles] = useState<(File | null)[]>([])
  const [slidePreviews, setSlidePreviews] = useState<(string | null)[]>([])
  const [slideMobilePreviews, setSlideMobilePreviews] = useState<(string | null)[]>([])

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
        setPage({
          ...payload,
          menu_item_id: payload.menu_item_id ?? menuId,
          hero_slides: slides,
          sections: ensureSections(payload.sections),
        })
        const slideCount = slides.length
        setSlideFiles(Array(slideCount).fill(null))
        setSlideMobileFiles(Array(slideCount).fill(null))
        setSlidePreviews(Array(slideCount).fill(null))
        setSlideMobilePreviews(Array(slideCount).fill(null))
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

  const reorderFiles = (files: (File | null)[], index: number, targetIndex: number) => {
    const next = [...files]
    const [moved] = next.splice(index, 1)
    next.splice(targetIndex, 0, moved ?? null)
    return next
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

  const handleSave = async () => {
    if (!page || !selectedMenu) return
    setSaving(true)
    setError(null)
    setNotice(null)
    try {
      const hasMissingImages = page.hero_slides.some(
        (slide, index) => !slide.src && !slideFiles[index],
      )
      if (hasMissingImages) {
        setError('Each slide needs a desktop image before saving.')
        setSaving(false)
        return
      }

      const formData = new FormData()
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

      const res = await fetch(`/api/proxy/ecommerce/services-pages/${menuId}`, {
        method: 'PUT',
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
      setPage({
        ...payload,
        hero_slides: slides,
        sections: ensureSections(payload.sections),
      })
      const slideCount = slides.length
      setSlideFiles(Array(slideCount).fill(null))
      setSlideMobileFiles(Array(slideCount).fill(null))
      setSlidePreviews(Array(slideCount).fill(null))
      setSlideMobilePreviews(Array(slideCount).fill(null))

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
            title="Slider section"
            description="Controls the hero slider content on the services page."
            active={page.hero_slides.length > 0}
            onToggle={(value) => {
              if (value && page.hero_slides.length === 0) {
                setPage({ ...page, hero_slides: [{ ...emptySlide, sort_order: 1 }] })
              }
              if (!value) {
                setPage({ ...page, hero_slides: [] })
              }
            }}
            canUpdate={canUpdate}
            toggleLabel={page.hero_slides.length > 0 ? 'Enabled' : 'Disabled'}
          >
            {page.hero_slides.length === 0 ? (
              <div className="rounded-lg border border-dashed border-gray-200 bg-gray-50 px-4 py-6 text-center text-sm text-gray-500">
                No slides yet. Toggle the section on to add slides.
              </div>
            ) : (
              <div className="space-y-4">
                {page.hero_slides.map((slide, index) => (
                  <div key={`slide-${index}`} className="rounded-lg border border-gray-100 bg-gray-50/60 p-4">
                    <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                      <button
                        type="button"
                        onClick={() => toggleSlideCollapsed(index)}
                        className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-gray-500 hover:text-gray-700"
                      >
                        <i className={`fa-solid ${collapsedSlides[index] ? 'fa-chevron-right' : 'fa-chevron-down'}`} />
                        <span>Slide {index + 1}</span>
                        <span className="rounded-full bg-white px-2 py-0.5 text-[10px] font-semibold text-gray-500">
                          Sort {slide.sort_order}
                        </span>
                      </button>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => moveSlide(index, -1)}
                          disabled={!canUpdate || index === 0}
                          className="inline-flex h-8 w-8 items-center justify-center rounded border border-gray-300 bg-white text-gray-600 hover:border-blue-300 hover:text-blue-600 disabled:cursor-not-allowed disabled:opacity-40"
                          aria-label="Move slide up"
                        >
                          <i className="fa-solid fa-arrow-up" />
                        </button>
                        <button
                          type="button"
                          onClick={() => moveSlide(index, 1)}
                          disabled={!canUpdate || index === page.hero_slides.length - 1}
                          className="inline-flex h-8 w-8 items-center justify-center rounded border border-gray-300 bg-white text-gray-600 hover:border-blue-300 hover:text-blue-600 disabled:cursor-not-allowed disabled:opacity-40"
                          aria-label="Move slide down"
                        >
                          <i className="fa-solid fa-arrow-down" />
                        </button>
                        <button
                          type="button"
                          onClick={() => removeSlide(index)}
                          disabled={!canUpdate}
                          className="text-xs font-medium text-red-600 hover:text-red-700 disabled:opacity-50"
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                    {!collapsedSlides[index] && (
                      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
                        <div className="space-y-4">
                          <div className="space-y-2">
                            <label className="text-xs font-medium uppercase tracking-wide text-gray-500">Desktop image</label>
                            <div className="space-y-2 rounded-lg border border-dashed border-gray-300 bg-white p-3">
                              <input
                                type="file"
                                accept="image/*"
                                disabled={!canUpdate}
                                onChange={(event) => {
                                  const file = event.target.files?.[0]
                                  if (!file) return
                                  setSlideFiles((prevFiles) =>
                                    prevFiles.map((entry, idx) => (idx === index ? file : entry ?? null)),
                                  )
                                  const previewUrl = URL.createObjectURL(file)
                                  setSlidePreviews((prevFiles) =>
                                    prevFiles.map((entry, idx) => (idx === index ? previewUrl : entry ?? null)),
                                  )
                                }}
                                className="text-xs"
                              />
                              {(slidePreviews[index] ?? slide.src) ? (
                                <div className="relative overflow-hidden rounded border border-gray-200">
                                  {/* eslint-disable-next-line @next/next/no-img-element */}
                                  <img src={slidePreviews[index] ?? slide.src} alt={slide.title || 'Desktop preview'} className="h-44 w-full object-cover" />
                                  <div className="absolute right-2 top-2 flex items-center gap-2">
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setSlideFiles((prevFiles) =>
                                          prevFiles.map((entry, idx) => (idx === index ? null : entry)),
                                        )
                                        setSlidePreviews((prevFiles) =>
                                          prevFiles.map((entry, idx) => (idx === index ? null : entry)),
                                        )
                                        updateSlide(index, (prev) => ({ ...prev, src: '' }))
                                      }}
                                      disabled={!canUpdate}
                                      className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-red-500 text-white shadow hover:bg-red-600 disabled:opacity-50"
                                      aria-label="Remove desktop image"
                                    >
                                      <i className="fa-solid fa-trash-can text-xs" />
                                    </button>
                                  </div>
                                </div>
                              ) : (
                                <div className="flex h-44 items-center justify-center rounded border border-dashed border-gray-200 bg-gray-50 text-xs text-gray-400">
                                  Upload a desktop image
                                </div>
                              )}
                            </div>
                          </div>
                          <div className="space-y-2">
                            <label className="text-xs font-medium uppercase tracking-wide text-gray-500">Mobile image</label>
                            <div className="space-y-2 rounded-lg border border-dashed border-gray-300 bg-white p-3">
                              <input
                                type="file"
                                accept="image/*"
                                disabled={!canUpdate}
                                onChange={(event) => {
                                  const file = event.target.files?.[0]
                                  if (!file) return
                                  setSlideMobileFiles((prevFiles) =>
                                    prevFiles.map((entry, idx) => (idx === index ? file : entry)),
                                  )
                                  const previewUrl = URL.createObjectURL(file)
                                  setSlideMobilePreviews((prevFiles) =>
                                    prevFiles.map((entry, idx) => (idx === index ? previewUrl : entry)),
                                  )
                                }}
                                className="text-xs"
                              />
                              {(slideMobilePreviews[index] ?? slide.mobileSrc) ? (
                                <div className="relative overflow-hidden rounded border border-gray-200">
                                  {/* eslint-disable-next-line @next/next/no-img-element */}
                                  <img src={slideMobilePreviews[index] ?? slide.mobileSrc} alt={slide.title || 'Mobile preview'} className="h-44 w-full object-cover" />
                                  <div className="absolute right-2 top-2 flex items-center gap-2">
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setSlideMobileFiles((prevFiles) =>
                                          prevFiles.map((entry, idx) => (idx === index ? null : entry)),
                                        )
                                        setSlideMobilePreviews((prevFiles) =>
                                          prevFiles.map((entry, idx) => (idx === index ? null : entry)),
                                        )
                                        updateSlide(index, (prev) => ({ ...prev, mobileSrc: '' }))
                                      }}
                                      disabled={!canUpdate}
                                      className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-red-500 text-white shadow hover:bg-red-600 disabled:opacity-50"
                                      aria-label="Remove mobile image"
                                    >
                                      <i className="fa-solid fa-trash-can text-xs" />
                                    </button>
                                  </div>
                                </div>
                              ) : (
                                <div className="flex h-44 items-center justify-center rounded border border-dashed border-gray-200 bg-gray-50 text-xs text-gray-400">
                                  Optional: upload a mobile image
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
            title="Services section"
            description="Highlights the key offerings using the existing ServicesPageLayout cards."
            active={page.sections.services.is_active}
            onToggle={(value) => updateSection<ServiceItem>('services', (section) => ({ ...section, is_active: value }))}
            canUpdate={canUpdate}
          >
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
            title="Pricing section"
            description="Controls the price list cards."
            active={page.sections.pricing.is_active}
            onToggle={(value) => updateSection<PricingItem>('pricing', (section) => ({ ...section, is_active: value }))}
            canUpdate={canUpdate}
          >
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
            title="FAQ section"
            description="Pairs each question with an expandable answer."
            active={page.sections.faqs.is_active}
            onToggle={(value) => updateSection<FaqItem>('faqs', (section) => ({ ...section, is_active: value }))}
            canUpdate={canUpdate}
          >
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
            title="Notes section"
            description="Shows the policy & care notes list."
            active={page.sections.notes.is_active}
            onToggle={(value) => updateSection<string>('notes', (section) => ({ ...section, is_active: value }))}
            canUpdate={canUpdate}
          >
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
  title,
  description,
  active,
  onToggle,
  canUpdate,
  children,
  toggleLabel,
}: {
  title: string
  description: string
  active: boolean
  onToggle: (value: boolean) => void
  canUpdate: boolean
  children: ReactNode
  toggleLabel?: string
}) {
  return (
    <section className="rounded-lg border border-gray-200 bg-white p-6">
      <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div className="space-y-1">
          <h3 className="text-base font-semibold text-gray-900">{title}</h3>
          <p className="text-xs text-gray-500">{description}</p>
        </div>
        <label className="inline-flex items-center gap-2 text-sm text-gray-700">
          <input
            type="checkbox"
            checked={active}
            onChange={(e) => onToggle(e.target.checked)}
            disabled={!canUpdate}
            className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
          />
          {toggleLabel ?? 'Active'}
        </label>
      </div>
      {children}
    </section>
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
              className="text-xs font-medium text-red-600 hover:text-red-700 disabled:opacity-50"
            >
              Remove
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
