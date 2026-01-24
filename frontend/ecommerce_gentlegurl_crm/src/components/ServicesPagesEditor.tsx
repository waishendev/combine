'use client'

import type { ReactNode } from 'react'
import { useEffect, useMemo, useState } from 'react'

type ServicesMenuItem = {
  id: number
  name: string
  slug: string
  is_active: boolean
  page?: { id?: number; slug?: string } | null
}

type ServicesSection<T> = {
  is_active: boolean
  items: T[]
}

type ServiceItem = { title: string; description: string }
type PricingItem = { label: string; price: string }
type FaqItem = { question: string; answer: string }

type ServicesPagePayload = {
  id?: number
  menu_item_id: number
  title: string
  slug: string
  subtitle: string | null
  hero_slides: Array<{
    src: string
    alt: string
    title?: string
    subtitle?: string
    description?: string
    buttonLabel?: string
    buttonHref?: string
  }>
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

function normalizeMenuItems(input: unknown): ServicesMenuItem[] {
  if (!input || typeof input !== 'object') return []
  const payload = input as {
    data?: unknown
    meta?: { total?: number }
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

  const selectedMenu = useMemo(
    () => menuItems.find((item) => item.id === menuId) ?? null,
    [menuItems, menuId],
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
        setPage({
          ...payload,
          menu_item_id: payload.menu_item_id ?? menuId,
          hero_slides: payload.hero_slides ?? [],
          sections: ensureSections(payload.sections),
        })
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

  const handleSave = async () => {
    if (!page) return
    setSaving(true)
    setError(null)
    setNotice(null)
    try {
      const res = await fetch(`/api/proxy/ecommerce/services-pages/${menuId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({
          title: page.title,
          slug: page.slug,
          subtitle: page.subtitle,
          hero_slides: page.hero_slides,
          sections: page.sections,
          is_active: page.is_active,
        }),
      })

      const json: ApiResponse<ServicesPagePayload> = await res.json().catch(() => ({}))
      if (!res.ok || !json.data) {
        throw new Error(json.message || 'Failed to save services page.')
      }

      const payload = json.data
      setPage({
        ...payload,
        hero_slides: payload.hero_slides ?? [],
        sections: ensureSections(payload.sections),
      })

      setMenuItems((prev) =>
        prev.map((item) =>
          item.id === menuId
            ? { ...item, name: payload.title, slug: payload.slug, is_active: payload.is_active }
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

  if (!selectedMenu) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-6 text-sm text-red-700">
        The selected services menu item no longer exists.
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 rounded-lg border border-gray-200 bg-white p-4 md:flex-row md:items-center md:justify-between">
        <div className="flex flex-col gap-1">
          <label className="text-xs font-semibold uppercase tracking-wide text-gray-500">Services menu</label>
          <div className="text-sm font-medium text-gray-900">
            {selectedMenu.name} <span className="text-gray-500">({selectedMenu.slug})</span>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={handleSave}
            disabled={!canUpdate || saving || loadingPage || !page}
            className="inline-flex items-center gap-2 rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <i className="fa-solid fa-floppy-disk" />
            {saving ? 'Saving...' : 'Save All Changes'}
          </button>
        </div>
      </div>

      <div className="rounded-lg border border-blue-100 bg-blue-50/60 px-4 py-3 text-xs text-blue-700">
        Editing <span className="font-semibold">{selectedMenu.name}</span>. Changes stay local until you press <span className="font-semibold">Save All Changes</span>.
      </div>

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
              <p className="text-xs text-gray-500">These fields drive both the URL and the header menu label.</p>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <label className="space-y-1 text-sm text-gray-700">
                <span className="font-medium">Title</span>
                <input
                  value={page.title}
                  onChange={(e) => setPage({ ...page, title: e.target.value })}
                  className="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  disabled={!canUpdate}
                />
              </label>
              <label className="space-y-1 text-sm text-gray-700">
                <span className="font-medium">Slug</span>
                <input
                  value={page.slug}
                  onChange={(e) => setPage({ ...page, slug: e.target.value })}
                  className="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  disabled={!canUpdate}
                />
              </label>
              <label className="space-y-1 text-sm text-gray-700 md:col-span-2">
                <span className="font-medium">Subtitle</span>
                <textarea
                  value={page.subtitle ?? ''}
                  onChange={(e) => setPage({ ...page, subtitle: e.target.value })}
                  className="min-h-[80px] w-full rounded border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  disabled={!canUpdate}
                />
              </label>
              <label className="inline-flex items-center gap-2 text-sm text-gray-700">
                <input
                  type="checkbox"
                  checked={page.is_active}
                  onChange={(e) => setPage({ ...page, is_active: e.target.checked })}
                  disabled={!canUpdate}
                  className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                Page active
              </label>
            </div>
          </section>

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
}: {
  title: string
  description: string
  active: boolean
  onToggle: (value: boolean) => void
  canUpdate: boolean
  children: ReactNode
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
          Active
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
