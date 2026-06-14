'use client'

import type { ReactNode } from 'react'
import { useCallback, useEffect, useMemo, useState } from 'react'

import InternationalPhoneInput from '@/components/common/InternationalPhoneInput'
import { normalizeInternationalPhone } from '@/lib/phone'

type HeadingConfig = { label: string; title: string; align: 'left' | 'center' | 'right' }
type OpeningHoursRow = { day_range: string; time_range: string }

type HeroSection = {
  is_active: boolean
  label: string
  title: string
  subtitle: string
  title_2: string
  subtitle_2: string
  cta_label: string
  cta_link: string
}

type SliderIntroSection = {
  is_active: boolean
  headline: string
}

type VisitStudioSection = {
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

const defaultHero: HeroSection = {
  is_active: true,
  label: '',
  title: '',
  subtitle: '',
  title_2: '',
  subtitle_2: '',
  cta_label: 'Shop Now',
  cta_link: '/shop',
}

const defaultSliderIntro: SliderIntroSection = {
  is_active: true,
  headline: 'Effortless silhouettes, luxe textures, everyday confidence.',
}

const defaultVisitStudio: VisitStudioSection = {
  is_active: true,
  heading: { label: '', title: 'Visit Our Studio', align: 'left' },
  studio_name: '',
  address: '',
  google_maps_url: '',
  waze_url: '',
  whatsapp_phone: '',
  whatsapp_message: 'Hi! I would like to get in touch about your shop.',
  google_maps_label: 'GOOGLE MAPS',
  waze_label: 'OPEN WAZE',
  whatsapp_label: 'MESSAGE US ON WHATSAPP',
  opening_hours_heading: 'Opening Hours',
  opening_hours: [],
  bottom_label: '',
  column_order: 'contact_left',
}

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

function normalizeHeroFromApi(raw: unknown): HeroSection {
  const base = defaultHero
  if (!raw || typeof raw !== 'object') return base
  const o = raw as Record<string, unknown>
  return {
    ...base,
    is_active: Boolean(o.is_active ?? base.is_active),
    label: String(o.label ?? base.label),
    title: String(o.title ?? base.title),
    subtitle: String(o.subtitle ?? base.subtitle),
    title_2: String(o.title_2 ?? base.title_2),
    subtitle_2: String(o.subtitle_2 ?? base.subtitle_2),
    cta_label: String(o.cta_label ?? base.cta_label),
    cta_link: String(o.cta_link ?? base.cta_link),
  }
}

function normalizeSliderIntroFromApi(raw: unknown): SliderIntroSection {
  const base = defaultSliderIntro
  if (!raw || typeof raw !== 'object') return base
  const o = raw as Record<string, unknown>
  return {
    is_active: Boolean(o.is_active ?? base.is_active),
    headline: String(o.headline ?? base.headline),
  }
}

function normalizeVisitStudioFromApi(raw: unknown): VisitStudioSection {
  const base = defaultVisitStudio
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

export default function EcommerceLandingPageEditor({ canEdit }: { canEdit: boolean }) {
  const [sliderIntro, setSliderIntro] = useState<SliderIntroSection>(defaultSliderIntro)
  const [hero, setHero] = useState<HeroSection>(defaultHero)
  const [visitStudio, setVisitStudio] = useState<VisitStudioSection>(defaultVisitStudio)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saveToast, setSaveToast] = useState<{ tone: 'success' | 'error'; text: string } | null>(null)
  const [collapsedSections, setCollapsedSections] = useState<Record<string, boolean>>({})

  const inputCls = useMemo(
    () =>
      'mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:bg-gray-50 disabled:text-gray-500',
    [],
  )
  const textareaCls = useMemo(() => `${inputCls} resize-y`, [inputCls])

  const fetchData = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/proxy/ecommerce/landing-page')
      const json = await res.json()
      const pageData = json?.data ?? json
      const sections = pageData?.sections ?? {}
      setSliderIntro(normalizeSliderIntroFromApi(sections.slider_intro))
      setHero(normalizeHeroFromApi(sections.hero))
      setVisitStudio(normalizeVisitStudioFromApi(sections.visit_studio))
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

  const updateVisitStudio = (partial: Partial<VisitStudioSection>) => {
    setVisitStudio((prev) => ({ ...prev, ...partial }))
  }

  const updateOpeningHourRow = (index: number, field: keyof OpeningHoursRow, value: string) => {
    setVisitStudio((prev) => {
      const rows = [...prev.opening_hours]
      rows[index] = { ...rows[index], [field]: value }
      return { ...prev, opening_hours: rows }
    })
  }

  const addOpeningHourRow = () => {
    setVisitStudio((prev) => ({
      ...prev,
      opening_hours: [...prev.opening_hours, { day_range: '', time_range: '' }],
    }))
  }

  const removeOpeningHourRow = (index: number) => {
    setVisitStudio((prev) => ({
      ...prev,
      opening_hours: prev.opening_hours.filter((_, i) => i !== index),
    }))
  }

  const moveOpeningHourRow = (index: number, direction: -1 | 1) => {
    setVisitStudio((prev) => {
      const rows = prev.opening_hours
      const target = index + direction
      if (target < 0 || target >= rows.length) return prev
      const next = [...rows]
      ;[next[index], next[target]] = [next[target], next[index]]
      return { ...prev, opening_hours: next }
    })
  }

  const handleSave = async () => {
    setSaving(true)
    setError(null)
    setSaveToast(null)
    try {
      const res = await fetch('/api/proxy/ecommerce/landing-page', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sections: {
            slider_intro: sliderIntro,
            hero,
            visit_studio: visitStudio,
          },
        }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json?.message || 'Save failed')
      const pageData = json?.data ?? json
      if (pageData?.sections) {
        setSliderIntro(normalizeSliderIntroFromApi(pageData.sections.slider_intro))
        setHero(normalizeHeroFromApi(pageData.sections.hero))
        setVisitStudio(normalizeVisitStudioFromApi(pageData.sections.visit_studio))
      }
      setSaveToast({ tone: 'success', text: 'Landing page saved successfully!' })
    } catch (err) {
      const saveError = err instanceof Error ? err.message : 'Failed to save'
      setError(saveError)
      setSaveToast({ tone: 'error', text: saveError })
    } finally {
      setSaving(false)
    }
  }

  const toggleSectionCollapsed = (key: string) => {
    setCollapsedSections((prev) => ({ ...prev, [key]: !prev[key] }))
  }

  const updateHero = (field: keyof HeroSection, value: string | boolean) => {
    setHero((prev) => ({ ...prev, [field]: value }))
  }

  if (loading) {
    return <p className="text-sm text-gray-500">Loading landing page…</p>
  }

  return (
    <div className="space-y-6">
      {error ? <p className="rounded border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p> : null}

      <SectionCard
        sectionKey="slider_intro"
        title="Slider headline"
        description="Large title above the homepage slider (Marketing → Slides). Shown only when at least one slide is active."
        active={sliderIntro.is_active}
        onToggle={(value) => setSliderIntro((prev) => ({ ...prev, is_active: value }))}
        canUpdate={canEdit}
        collapsed={collapsedSections.slider_intro ?? false}
        onToggleCollapse={() => toggleSectionCollapsed('slider_intro')}
      >
        <label className="block space-y-1 text-xs uppercase tracking-wide text-gray-500">
          <span className="font-medium">Headline</span>
          <textarea
            value={sliderIntro.headline}
            onChange={(e) => setSliderIntro((prev) => ({ ...prev, headline: e.target.value }))}
            className={textareaCls}
            rows={3}
            disabled={!canEdit}
            placeholder="Effortless silhouettes, luxe textures, everyday confidence."
          />
        </label>
      </SectionCard>

      <SectionCard
        sectionKey="hero"
        title="Hero section"
        description="Extra copy below the slider (same fields as booking landing page hero). Use for subtitle, second title, and CTA."
        active={hero.is_active}
        onToggle={(value) => updateHero('is_active', value)}
        canUpdate={canEdit}
        collapsed={collapsedSections.hero ?? false}
        onToggleCollapse={() => toggleSectionCollapsed('hero')}
      >
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-1 text-sm text-gray-700">
            <span className="text-xs font-medium uppercase tracking-wide text-gray-500">Label</span>
            <input className={inputCls} value={hero.label} onChange={(e) => updateHero('label', e.target.value)} disabled={!canEdit} />
          </div>
          <div className="space-y-1 text-sm text-gray-700">
            <span className="text-xs font-medium uppercase tracking-wide text-gray-500">CTA button label</span>
            <input className={inputCls} value={hero.cta_label} onChange={(e) => updateHero('cta_label', e.target.value)} disabled={!canEdit} />
          </div>
          <div className="space-y-1 text-sm text-gray-700 md:col-span-2">
            <span className="text-xs font-medium uppercase tracking-wide text-gray-500">Title</span>
            <input className={inputCls} value={hero.title} onChange={(e) => updateHero('title', e.target.value)} disabled={!canEdit} />
          </div>
          <div className="space-y-1 text-sm text-gray-700 md:col-span-2">
            <span className="text-xs font-medium uppercase tracking-wide text-gray-500">Subtitle</span>
            <textarea className={textareaCls} rows={6} value={hero.subtitle} onChange={(e) => updateHero('subtitle', e.target.value)} disabled={!canEdit} />
            <p className="text-xs text-gray-500 leading-relaxed">
              Line breaks: press Enter. Bold: wrap in <code className="rounded bg-gray-100 px-1 text-[0.7rem]">**double asterisks**</code>.
            </p>
          </div>
          <div className="space-y-1 text-sm text-gray-700 md:col-span-2">
            <span className="text-xs font-medium uppercase tracking-wide text-gray-500">Title 2</span>
            <input className={inputCls} value={hero.title_2} onChange={(e) => updateHero('title_2', e.target.value)} disabled={!canEdit} />
          </div>
          <div className="space-y-1 text-sm text-gray-700 md:col-span-2">
            <span className="text-xs font-medium uppercase tracking-wide text-gray-500">Subtitle 2</span>
            <textarea className={textareaCls} rows={4} value={hero.subtitle_2} onChange={(e) => updateHero('subtitle_2', e.target.value)} disabled={!canEdit} />
          </div>
          <div className="space-y-1 text-sm text-gray-700 md:col-span-2">
            <span className="text-xs font-medium uppercase tracking-wide text-gray-500">CTA link</span>
            <input className={inputCls} value={hero.cta_link} onChange={(e) => updateHero('cta_link', e.target.value)} disabled={!canEdit} />
          </div>
        </div>
      </SectionCard>

      <SectionCard
        sectionKey="visit_studio"
        title="Visit Our Studio"
        description="Shown at the bottom of the ecommerce shop homepage. Location, maps, WhatsApp, opening hours, and footer copy."
        active={visitStudio.is_active}
        onToggle={(value) => updateVisitStudio({ is_active: value })}
        canUpdate={canEdit}
        collapsed={collapsedSections.visit_studio ?? false}
        onToggleCollapse={() => toggleSectionCollapsed('visit_studio')}
      >
        <div className="space-y-4">
          <SectionHeadingFields
            heading={visitStudio.heading}
            onChange={(heading) => updateVisitStudio({ heading })}
            canUpdate={canEdit}
            inputCls={inputCls}
          />
          <div className="grid gap-3 md:grid-cols-2">
            <label className="space-y-1 text-xs uppercase tracking-wide text-gray-500 md:col-span-2">
              <span className="font-medium">Studio name</span>
              <input
                value={visitStudio.studio_name}
                onChange={(e) => updateVisitStudio({ studio_name: e.target.value })}
                className={inputCls}
                disabled={!canEdit}
              />
            </label>
            <label className="space-y-1 text-xs uppercase tracking-wide text-gray-500 md:col-span-2">
              <span className="font-medium">Address</span>
              <textarea
                value={visitStudio.address}
                onChange={(e) => updateVisitStudio({ address: e.target.value })}
                className={textareaCls}
                rows={4}
                disabled={!canEdit}
              />
            </label>
            <label className="space-y-1 text-xs uppercase tracking-wide text-gray-500">
              <span className="font-medium">Google Maps URL</span>
              <input
                value={visitStudio.google_maps_url}
                onChange={(e) => updateVisitStudio({ google_maps_url: e.target.value })}
                className={inputCls}
                disabled={!canEdit}
              />
            </label>
            <label className="space-y-1 text-xs uppercase tracking-wide text-gray-500">
              <span className="font-medium">Waze URL</span>
              <input
                value={visitStudio.waze_url}
                onChange={(e) => updateVisitStudio({ waze_url: e.target.value })}
                className={inputCls}
                disabled={!canEdit}
              />
            </label>
            <label className="space-y-1 text-xs uppercase tracking-wide text-gray-500 md:col-span-2">
              <span className="font-medium">WhatsApp phone number</span>
              <InternationalPhoneInput
                value={visitStudio.whatsapp_phone}
                onChange={(value) => updateVisitStudio({ whatsapp_phone: value })}
                className="mt-1"
                disabled={!canEdit}
              />
            </label>
            <label className="space-y-1 text-xs uppercase tracking-wide text-gray-500 md:col-span-2">
              <span className="font-medium">WhatsApp default message</span>
              <textarea
                value={visitStudio.whatsapp_message}
                onChange={(e) => updateVisitStudio({ whatsapp_message: e.target.value })}
                className={textareaCls}
                rows={3}
                disabled={!canEdit}
              />
            </label>
            <label className="space-y-1 text-xs uppercase tracking-wide text-gray-500">
              <span className="font-medium">Google Maps button label</span>
              <input
                value={visitStudio.google_maps_label}
                onChange={(e) => updateVisitStudio({ google_maps_label: e.target.value })}
                className={inputCls}
                disabled={!canEdit}
              />
            </label>
            <label className="space-y-1 text-xs uppercase tracking-wide text-gray-500">
              <span className="font-medium">Waze button label</span>
              <input
                value={visitStudio.waze_label}
                onChange={(e) => updateVisitStudio({ waze_label: e.target.value })}
                className={inputCls}
                disabled={!canEdit}
              />
            </label>
            <label className="space-y-1 text-xs uppercase tracking-wide text-gray-500 md:col-span-2">
              <span className="font-medium">WhatsApp button label</span>
              <input
                value={visitStudio.whatsapp_label}
                onChange={(e) => updateVisitStudio({ whatsapp_label: e.target.value })}
                className={inputCls}
                disabled={!canEdit}
              />
            </label>
            <label className="space-y-1 text-xs uppercase tracking-wide text-gray-500 md:col-span-2">
              <span className="font-medium">Opening hours card title</span>
              <input
                value={visitStudio.opening_hours_heading}
                onChange={(e) => updateVisitStudio({ opening_hours_heading: e.target.value })}
                className={inputCls}
                disabled={!canEdit}
              />
            </label>
            <label className="space-y-1 text-xs uppercase tracking-wide text-gray-500 md:col-span-2">
              <span className="font-medium">Column order</span>
              <select
                value={visitStudio.column_order}
                onChange={(e) =>
                  updateVisitStudio({
                    column_order: e.target.value as VisitStudioSection['column_order'],
                  })
                }
                className={inputCls}
                disabled={!canEdit}
              >
                <option value="contact_left">Location &amp; contact — left</option>
                <option value="hours_left">Opening hours — left</option>
              </select>
            </label>
          </div>

          <div className="space-y-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Opening hours rows</p>
            <div className="grid gap-4 md:grid-cols-2">
              {visitStudio.opening_hours.map((row, idx) => (
                <div key={idx} className="rounded-lg border border-gray-100 bg-gray-50/60 p-4">
                  <div className="mb-3 flex items-center justify-between gap-2">
                    <span className="text-xs font-semibold text-gray-500">Row {idx + 1}</span>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => moveOpeningHourRow(idx, -1)}
                        disabled={!canEdit || idx === 0}
                        className="rounded border border-gray-300 px-2 py-1 text-xs disabled:opacity-50"
                      >
                        <i className="fa-solid fa-arrow-up" />
                      </button>
                      <button
                        type="button"
                        onClick={() => moveOpeningHourRow(idx, 1)}
                        disabled={!canEdit || idx === visitStudio.opening_hours.length - 1}
                        className="rounded border border-gray-300 px-2 py-1 text-xs disabled:opacity-50"
                      >
                        <i className="fa-solid fa-arrow-down" />
                      </button>
                      <button
                        type="button"
                        onClick={() => removeOpeningHourRow(idx)}
                        disabled={!canEdit}
                        className="rounded border border-red-200 px-2 py-1 text-xs text-red-600 disabled:opacity-50"
                      >
                        <i className="fa-solid fa-trash" />
                      </button>
                    </div>
                  </div>
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-end">
                    <label className="min-w-0 flex-1 space-y-1">
                      <span className="text-[11px] font-medium uppercase text-gray-500">Label</span>
                      <input
                        className={inputCls}
                        value={row.day_range}
                        onChange={(e) => updateOpeningHourRow(idx, 'day_range', e.target.value)}
                        disabled={!canEdit}
                      />
                    </label>
                    <label className="min-w-0 flex-1 space-y-1">
                      <span className="text-[11px] font-medium uppercase text-gray-500">Time</span>
                      <input
                        className={inputCls}
                        value={row.time_range}
                        onChange={(e) => updateOpeningHourRow(idx, 'time_range', e.target.value)}
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
              className="inline-flex items-center gap-2 rounded border border-indigo-600 bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-60"
            >
              <i className="fa-solid fa-plus" />
              Add hours row
            </button>
          </div>

          <label className="block space-y-1 border-t border-gray-100 pt-4 text-xs uppercase tracking-wide text-gray-500">
            <span className="font-medium">Bottom label</span>
            <textarea
              value={visitStudio.bottom_label}
              onChange={(e) => updateVisitStudio({ bottom_label: e.target.value })}
              className={textareaCls}
              rows={3}
              disabled={!canEdit}
            />
          </label>
        </div>
      </SectionCard>

      {canEdit ? (
        <div className="flex justify-end">
          <button
            type="button"
            onClick={() => void handleSave()}
            disabled={saving}
            className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-6 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {saving ? (
              <>
                <i className="fa-solid fa-spinner fa-spin text-xs" />
                Saving…
              </>
            ) : (
              <>
                <i className="fa-solid fa-floppy-disk text-xs" />
                Save Changes
              </>
            )}
          </button>
        </div>
      ) : null}

      {saveToast ? (
        <div
          role="status"
          className={`fixed bottom-6 right-6 z-[100] rounded-xl border px-4 py-3 text-sm shadow-lg ${
            saveToast.tone === 'success'
              ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
              : 'border-red-200 bg-red-50 text-red-800'
          }`}
        >
          {saveToast.text}
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
        <div className="flex items-center gap-2">
          <label className="inline-flex items-center gap-2 text-sm text-gray-700">
            <input
              type="checkbox"
              checked={active}
              onChange={(e) => onToggle(e.target.checked)}
              disabled={!canUpdate}
              className="h-4 w-4 rounded border-gray-300"
            />
            Enabled
          </label>
          <button
            type="button"
            onClick={onToggleCollapse}
            className="rounded border border-gray-300 px-2 py-1 text-xs text-gray-600"
          >
            <i className={`fa-solid ${collapsed ? 'fa-chevron-down' : 'fa-chevron-up'}`} />
          </button>
        </div>
      </div>
      {!collapsed ? <div id={`${sectionKey}-section-content`}>{children}</div> : null}
    </section>
  )
}

function SectionHeadingFields({
  heading,
  onChange,
  canUpdate,
  inputCls,
}: {
  heading: HeadingConfig
  onChange: (heading: HeadingConfig) => void
  canUpdate: boolean
  inputCls: string
}) {
  return (
    <div className="grid gap-3 md:grid-cols-3">
      <label className="space-y-1 text-xs uppercase tracking-wide text-gray-500">
        <span className="font-medium">Label</span>
        <input
          value={heading.label}
          onChange={(e) => onChange({ ...heading, label: e.target.value })}
          className={inputCls}
          disabled={!canUpdate}
        />
      </label>
      <label className="space-y-1 text-xs uppercase tracking-wide text-gray-500">
        <span className="font-medium">Title</span>
        <input
          value={heading.title}
          onChange={(e) => onChange({ ...heading, title: e.target.value })}
          className={inputCls}
          disabled={!canUpdate}
        />
      </label>
      <label className="space-y-1 text-xs uppercase tracking-wide text-gray-500">
        <span className="font-medium">Align</span>
        <select
          value={heading.align}
          onChange={(e) => onChange({ ...heading, align: e.target.value as HeadingConfig['align'] })}
          className={inputCls}
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
