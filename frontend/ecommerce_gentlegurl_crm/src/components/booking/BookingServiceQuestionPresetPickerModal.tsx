'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'

import CrmFormModalShell from '@/components/CrmFormModalShell'
import BookingQuestionPresetUpsertModal from './BookingQuestionPresetUpsertModal'
import BookingServiceQuestionPresetViewModal from './BookingServiceQuestionPresetViewModal'

export type QuestionPresetOption = {
  id: number
  name: string
  cn_name?: string | null
  is_active?: boolean
  questions?: Array<{
    id?: number
    title: string
    cn_title?: string | null
    description?: string | null
    cn_description?: string | null
    question_type?: string
    is_required?: boolean
    is_active?: boolean
    options?: Array<{
      id?: number
      label?: string
      cn_label?: string | null
      linked_booking_service_id?: number | null
      linked_booking_service_name?: string | null
      linked_booking_service_cn_name?: string | null
      extra_duration_min?: number | null
      extra_price?: number | null
      linked_price_mode?: string | null
      linked_price_range_min?: number | null
      linked_price_range_max?: number | null
      allow_quantity?: boolean
      is_active?: boolean
      linked_booking_service?: {
        id?: number
        name?: string
        cn_name?: string | null
        duration_min?: number
        service_price?: number
      } | null
    }>
  }>
}

interface Props {
  onClose: () => void
  onApply: (ids: number[], presets: QuestionPresetOption[]) => void
  disabled?: boolean
}

export default function BookingServiceQuestionPresetPickerModal({
  onClose,
  onApply,
  disabled,
}: Props) {
  const [options, setOptions] = useState<QuestionPresetOption[]>([])
  const [selectedIds, setSelectedIds] = useState<number[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [viewingPreset, setViewingPreset] = useState<QuestionPresetOption | null>(null)
  const [showCreate, setShowCreate] = useState(false)

  const loadOptions = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/proxy/admin/booking/question-presets?all=1&is_active=1', {
        cache: 'no-store',
        headers: { Accept: 'application/json' },
      })
      const data = await res.json().catch(() => null)
      if (!res.ok || data?.success === false) {
        throw new Error(data?.message || 'Failed to load question presets')
      }
      const list = Array.isArray(data?.data) ? data.data : []
      setOptions(
        list.map((item: QuestionPresetOption) => ({
          id: Number(item.id),
          name: String(item.name ?? ''),
          cn_name: item.cn_name ?? null,
          is_active: item.is_active !== false,
          questions: Array.isArray(item.questions) ? item.questions : [],
        })),
      )
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load question presets')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadOptions()
  }, [loadOptions])

  const selected = useMemo(
    () => selectedIds.map((id) => options.find((o) => o.id === id)).filter(Boolean) as QuestionPresetOption[],
    [selectedIds, options],
  )

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return options
    return options.filter((preset) => {
      const hay = `${preset.name} ${preset.cn_name ?? ''} ${(preset.questions ?? []).map((x) => x.title).join(' ')}`
      return hay.toLowerCase().includes(q)
    })
  }, [options, query])

  const selectedQuestionCount = useMemo(
    () => selected.reduce((sum, preset) => sum + (preset.questions?.length ?? 0), 0),
    [selected],
  )

  const toggle = (id: number) => {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))
  }

  return (
    <>
      <CrmFormModalShell
        title={
          <div>
            <div>Apply question presets</div>
            <p className="mt-1 text-xs font-normal text-gray-500">
            Pick presets to add. Already applied presets stay on the service — this only adds more.
          </p>
          </div>
        }
        onClose={onClose}
        closeDisabled={disabled}
        size="lg"
        footer={
          <>
            <div className="mr-auto text-sm text-gray-500">
              {selected.length === 0
                ? 'Select presets to add'
                : `Add ${selected.length} preset${selected.length === 1 ? '' : 's'} · ${selectedQuestionCount} question${selectedQuestionCount === 1 ? '' : 's'}`}
            </div>
            <button
              type="button"
              onClick={onClose}
              disabled={disabled}
              className="rounded-md border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={disabled || loading || selected.length === 0}
              onClick={() => onApply(selectedIds, selected)}
              className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {selected.length === 0
                ? 'Add presets'
                : `Add ${selected.length} preset${selected.length === 1 ? '' : 's'}`}
            </button>
          </>
        }
      >
        <div className="space-y-3 px-4 py-4 sm:px-5">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <div className="relative min-w-0 flex-1">
              <i className="fa-solid fa-magnifying-glass pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-xs text-gray-400" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search presets…"
                className="w-full rounded-lg border border-gray-300 bg-white py-2.5 pl-9 pr-3 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                disabled={loading}
              />
            </div>
            <button
              type="button"
              disabled={disabled}
              onClick={() => setShowCreate(true)}
              className="inline-flex shrink-0 items-center justify-center gap-2 rounded-lg border border-gray-300 bg-white px-3.5 py-2.5 text-sm font-medium text-gray-800 hover:bg-gray-50 disabled:opacity-50"
            >
              <i className="fa-solid fa-plus text-xs" />
              Create new preset
            </button>
          </div>

          {error ? (
            <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>
          ) : null}

          {loading ? (
            <div className="flex h-40 items-center justify-center text-sm text-gray-500">
              <i className="fa fa-spinner fa-spin mr-2" />
              Loading presets…
            </div>
          ) : null}

          {!loading && filtered.length === 0 ? (
            <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50 px-4 py-12 text-center">
              <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-white text-gray-400 shadow-sm">
                <i className="fa-solid fa-layer-group" />
              </div>
              <p className="text-sm font-medium text-gray-800">
                {options.length === 0 ? 'No active presets yet' : 'No presets match your search'}
              </p>
              <p className="mt-1 text-xs text-gray-500">
                {options.length === 0
                  ? 'Create a new preset here, then apply it to this service.'
                  : 'Try another keyword.'}
              </p>
              {options.length === 0 ? (
                <button
                  type="button"
                  disabled={disabled}
                  onClick={() => setShowCreate(true)}
                  className="mt-4 inline-flex items-center gap-2 rounded-lg bg-blue-600 px-3.5 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
                >
                  <i className="fa-solid fa-plus text-xs" />
                  Create new preset
                </button>
              ) : null}
            </div>
          ) : null}

          {!loading && filtered.length > 0 ? (
            <div className="max-h-[min(420px,55dvh)] space-y-2 overflow-y-auto pr-0.5">
              {filtered.map((preset) => {
                const checked = selectedIds.includes(preset.id)
                const questionCount = preset.questions?.length ?? 0

                return (
                  <div
                    key={preset.id}
                    role="button"
                    tabIndex={disabled ? -1 : 0}
                    aria-pressed={checked}
                    onClick={() => {
                      if (!disabled) toggle(preset.id)
                    }}
                    onKeyDown={(e) => {
                      if (disabled) return
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault()
                        toggle(preset.id)
                      }
                    }}
                    className={`flex cursor-pointer items-center gap-3 rounded-xl border px-3.5 py-3 text-left transition sm:px-4 ${
                      checked
                        ? 'border-blue-300 bg-blue-50/70 shadow-sm'
                        : 'border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50/60'
                    } ${disabled ? 'cursor-not-allowed opacity-60' : ''}`}
                  >
                    <input
                      type="checkbox"
                      className="pointer-events-none h-4 w-4 shrink-0 rounded border-gray-300 text-blue-600"
                      checked={checked}
                      readOnly
                      tabIndex={-1}
                      aria-hidden
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-semibold text-gray-900">{preset.name}</span>
                        <span className="rounded-full bg-white/80 px-2 py-0.5 text-[11px] font-medium text-gray-600 ring-1 ring-gray-200">
                          {questionCount} Q
                        </span>
                      </div>
                      {preset.cn_name ? (
                        <p className="mt-0.5 text-xs text-gray-500">{preset.cn_name}</p>
                      ) : null}
                    </div>
                    <button
                      type="button"
                      disabled={disabled}
                      onClick={(e) => {
                        e.stopPropagation()
                        setViewingPreset(preset)
                      }}
                      className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-gray-500 hover:bg-white hover:text-gray-800 disabled:opacity-50"
                      aria-label={`View ${preset.name}`}
                      title="View questions"
                    >
                      <i className="fa-solid fa-eye text-sm" />
                    </button>
                  </div>
                )
              })}
            </div>
          ) : null}
        </div>
      </CrmFormModalShell>

      {viewingPreset ? (
        <BookingServiceQuestionPresetViewModal preset={viewingPreset} onClose={() => setViewingPreset(null)} />
      ) : null}

      {showCreate ? (
        <BookingQuestionPresetUpsertModal
          mode="create"
          onClose={() => setShowCreate(false)}
          onSuccess={(createdId) => {
            void (async () => {
              await loadOptions()
              if (createdId != null) {
                setSelectedIds((prev) => (prev.includes(createdId) ? prev : [...prev, createdId]))
              }
            })()
          }}
        />
      ) : null}
    </>
  )
}
