'use client'

import { useEffect, useState } from 'react'

import { Switch } from '@/components/ui/switch'
import BookingServiceLinkedBookingServicePicker from './BookingServiceLinkedBookingServicePicker'

export type QuestionOptionForm = {
  id?: number
  label: string
  cn_label: string
  linked_booking_service_id: string
  sort_order: string
  is_active: boolean
  allow_quantity: boolean
}

export type QuestionForm = {
  id?: number
  title: string
  cn_title: string
  description: string
  cn_description: string
  question_type: 'single_choice' | 'multi_choice'
  sort_order: string
  is_required: boolean
  is_active: boolean
  options: QuestionOptionForm[]
}

export const emptyQuestionOption = (): QuestionOptionForm => ({
  label: '',
  cn_label: '',
  linked_booking_service_id: '',
  sort_order: '0',
  is_active: true,
  allow_quantity: true,
})

export const emptyQuestion = (): QuestionForm => ({
  title: '',
  cn_title: '',
  description: '',
  cn_description: '',
  question_type: 'single_choice',
  sort_order: '0',
  is_required: false,
  is_active: true,
  options: [emptyQuestionOption()],
})

/** Keeps sort_order strings aligned with array index (server uses submission order). */
function normalizeSortOrders(questions: QuestionForm[]): QuestionForm[] {
  return questions.map((q, qi) => ({
    ...q,
    sort_order: String(qi),
    options: q.options.map((o, oi) => ({ ...o, sort_order: String(oi) })),
  }))
}

interface Props {
  value: QuestionForm[]
  onChange: (next: QuestionForm[]) => void
  bookingServiceOptions: Array<{ id: number; name: string; duration_min: number; service_price: number }>
  disabled?: boolean
}

export default function BookingServiceQuestionsBuilder({ value, onChange, bookingServiceOptions, disabled }: Props) {
  const [collapsedQuestions, setCollapsedQuestions] = useState<boolean[]>([])
  const [addMenuOpen, setAddMenuOpen] = useState(false)
  const [presetPickerOpen, setPresetPickerOpen] = useState(false)
  const [presetSearch, setPresetSearch] = useState('')
  const [presets, setPresets] = useState<Array<{ id: number; name: string; title: string; question_type: string; options_count: number }>>([])
  const [presetLoading, setPresetLoading] = useState(false)

  useEffect(() => {
    setCollapsedQuestions((prev) => {
      if (prev.length === value.length) return prev
      if (prev.length < value.length) {
        return [...prev, ...Array(value.length - prev.length).fill(false)]
      }
      return prev.slice(0, value.length)
    })
  }, [value.length])

  const setQuestion = (index: number, patch: Partial<QuestionForm>) => {
    const next = [...value]
    next[index] = { ...next[index], ...patch }
    onChange(normalizeSortOrders(next))
  }

  const setOption = (qIndex: number, oIndex: number, patch: Partial<QuestionOptionForm>) => {
    const next = [...value]
    const options = [...(next[qIndex]?.options ?? [])]
    options[oIndex] = { ...options[oIndex], ...patch }
    next[qIndex] = { ...next[qIndex], options }
    onChange(normalizeSortOrders(next))
  }

  const moveQuestion = (index: number, direction: 'up' | 'down') => {
    const next = [...value]
    const targetIndex = direction === 'up' ? index - 1 : index + 1
    if (targetIndex < 0 || targetIndex >= next.length) return
    const [moved] = next.splice(index, 1)
    next.splice(targetIndex, 0, moved)
    onChange(normalizeSortOrders(next))
    setCollapsedQuestions((prev) => {
      const c = [...prev]
      while (c.length < next.length) c.push(false)
      const [movedC] = c.splice(index, 1)
      c.splice(targetIndex, 0, movedC ?? false)
      return c
    })
  }

  const moveOption = (qIndex: number, oIndex: number, direction: 'up' | 'down') => {
    const next = [...value]
    const opts = [...next[qIndex].options]
    const targetIndex = direction === 'up' ? oIndex - 1 : oIndex + 1
    if (targetIndex < 0 || targetIndex >= opts.length) return
    const [moved] = opts.splice(oIndex, 1)
    opts.splice(targetIndex, 0, moved)
    next[qIndex] = { ...next[qIndex], options: opts }
    onChange(normalizeSortOrders(next))
  }

  const addQuestion = () => {
    onChange(normalizeSortOrders([...value, { ...emptyQuestion(), sort_order: String(value.length) }]))
    setCollapsedQuestions((prev) => [...prev, false])
  }

  const openPresetPicker = async () => {
    setAddMenuOpen(false)
    setPresetPickerOpen(true)
    setPresetLoading(true)
    try {
      const res = await fetch('/api/proxy/admin/booking/question-presets?all=1&is_active=true&limit=500', { cache: 'no-store' })
      const json = await res.json().catch(() => null)
      setPresets(res.ok && Array.isArray(json?.data) ? json.data : [])
    } finally {
      setPresetLoading(false)
    }
  }

  const applyPreset = async (id: number) => {
    setPresetLoading(true)
    try {
      const res = await fetch(`/api/proxy/admin/booking/question-presets/${id}`, { cache: 'no-store' })
      const json = await res.json().catch(() => null)
      const preset = json?.data
      if (!res.ok || !preset) return
      const copied: QuestionForm = {
        title: preset.title ?? '', cn_title: preset.cn_title ?? '', description: preset.description ?? '',
        cn_description: preset.cn_description ?? '', question_type: preset.question_type === 'multi_choice' ? 'multi_choice' : 'single_choice',
        sort_order: String(value.length), is_required: Boolean(preset.is_required), is_active: preset.is_active !== false,
        options: (Array.isArray(preset.options) ? preset.options : []).map((option: QuestionOptionForm) => ({
          label: option.label ?? '', cn_label: option.cn_label ?? '', linked_booking_service_id: '',
          sort_order: option.sort_order ?? '0', is_active: option.is_active !== false, allow_quantity: option.allow_quantity !== false,
        })),
      }
      onChange(normalizeSortOrders([...value, copied]))
      setPresetPickerOpen(false)
    } finally { setPresetLoading(false) }
  }

  const removeQuestion = (qIndex: number) => {
    onChange(normalizeSortOrders(value.filter((_, index) => index !== qIndex)))
    setCollapsedQuestions((prev) => prev.filter((_, i) => i !== qIndex))
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between pb-2 border-b border-gray-100">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">Add-ons / Questions</h3>
          <p className="text-sm text-gray-500 mt-1">
            Configure optional questions and link each choice to a booking service add-on.
          </p>
        </div>
        <div className="relative">
          <button type="button" disabled={disabled} onClick={() => setAddMenuOpen((open) => !open)} className="inline-flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50">
            <i className="fa-solid fa-plus" /> Add Question <i className="fa-solid fa-chevron-down text-xs" />
          </button>
          {addMenuOpen && <div className="absolute right-0 z-20 mt-2 w-48 rounded-lg border bg-white p-1 shadow-lg">
            <button type="button" onClick={() => { setAddMenuOpen(false); addQuestion() }} className="w-full rounded px-3 py-2 text-left text-sm hover:bg-gray-50">Create Manually</button>
            <button type="button" onClick={openPresetPicker} className="w-full rounded px-3 py-2 text-left text-sm hover:bg-gray-50">Add from Preset</button>
          </div>}
        </div>
      </div>

      {presetPickerOpen && <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/40 p-4">
        <div className="w-full max-w-2xl rounded-xl bg-white p-5 shadow-xl">
          <div className="mb-4 flex items-center justify-between"><h3 className="text-lg font-semibold">Add from Question Preset</h3><button type="button" onClick={() => setPresetPickerOpen(false)} aria-label="Close"><i className="fa-solid fa-xmark" /></button></div>
          <input value={presetSearch} onChange={(e) => setPresetSearch(e.target.value)} placeholder="Search presets or question titles…" className="mb-3 w-full rounded border px-3 py-2 text-sm" />
          <div className="max-h-96 space-y-2 overflow-y-auto">
            {presetLoading ? <p className="p-6 text-center text-sm text-gray-500">Loading…</p> : presets.filter((p) => `${p.name} ${p.title}`.toLowerCase().includes(presetSearch.toLowerCase())).map((preset) =>
              <button key={preset.id} type="button" onClick={() => applyPreset(preset.id)} className="w-full rounded-lg border p-3 text-left hover:border-blue-400 hover:bg-blue-50">
                <div className="font-medium">{preset.name}</div><div className="text-sm text-gray-600">{preset.title}</div><div className="mt-1 text-xs text-gray-500">{preset.question_type === 'multi_choice' ? 'Multi choice' : 'Single choice'} · {preset.options_count} options</div>
              </button>)}
          </div>
          <p className="mt-3 text-xs text-amber-700">Add-on services are branch-specific and must be selected after applying a preset.</p>
        </div>
      </div>}

      {value.length === 0 && (
        <div className="rounded-lg border border-dashed border-gray-300 p-6 text-center text-sm text-gray-500">
          No questions yet. Add your first question.
        </div>
      )}

      {value.map((question, qIndex) => {
        const isCollapsed = collapsedQuestions[qIndex] ?? false
        const toggleCollapsed = () => {
          setCollapsedQuestions((prev) => {
            const next = [...prev]
            while (next.length <= qIndex) next.push(false)
            next[qIndex] = !isCollapsed
            return next
          })
        }

        return (
          <div key={question.id ?? `question-${qIndex}`} className="rounded-lg border border-gray-200 p-4 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm font-semibold text-gray-900">Question #{qIndex + 1}</p>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={disabled || qIndex === 0}
                  onClick={() => moveQuestion(qIndex, 'up')}
                  className="rounded border border-gray-300 px-2 py-1 text-xs text-gray-600 hover:bg-gray-50 disabled:opacity-50"
                  aria-label="Move question up"
                >
                  <i className="fa-solid fa-arrow-up" />
                </button>
                <button
                  type="button"
                  disabled={disabled || qIndex === value.length - 1}
                  onClick={() => moveQuestion(qIndex, 'down')}
                  className="rounded border border-gray-300 px-2 py-1 text-xs text-gray-600 hover:bg-gray-50 disabled:opacity-50"
                  aria-label="Move question down"
                >
                  <i className="fa-solid fa-arrow-down" />
                </button>
                <button
                  type="button"
                  disabled={disabled}
                  onClick={toggleCollapsed}
                  className="rounded border border-gray-300 px-2 py-1 text-xs text-gray-600 hover:bg-gray-50"
                  aria-label={isCollapsed ? 'Expand question' : 'Collapse question'}
                >
                  <i className={`fa-solid ${isCollapsed ? 'fa-chevron-down' : 'fa-chevron-up'}`} />
                </button>
                <button
                  type="button"
                  disabled={disabled}
                  onClick={() => removeQuestion(qIndex)}
                  className="rounded border border-red-200 px-2 py-1 text-xs text-red-600 hover:bg-red-50 disabled:opacity-50"
                  aria-label="Remove question"
                >
                  <i className="fa-solid fa-trash" />
                </button>
              </div>
            </div>

            {!isCollapsed && (
              <>
                <div className="grid gap-3 md:grid-cols-2">
                  <label className="grid gap-1">
                    <span className="block text-sm font-medium text-gray-700">Question Title</span>
                    <input
                      value={question.title}
                      disabled={disabled}
                      onChange={(e) => setQuestion(qIndex, { title: e.target.value })}
                      placeholder="Question title"
                      className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
                    />
                  </label>
                  <label className="grid gap-1">
                    <span className="block text-sm font-medium text-gray-700">Chinese Question Title</span>
                    <input
                      value={question.cn_title}
                      disabled={disabled}
                      onChange={(e) => setQuestion(qIndex, { cn_title: e.target.value })}
                      placeholder="Chinese question title (optional)"
                      className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
                    />
                  </label>
                  <label className="grid gap-1">
                    <span className="block text-sm font-medium text-gray-700">Description</span>
                    <input
                      value={question.description}
                      disabled={disabled}
                      onChange={(e) => setQuestion(qIndex, { description: e.target.value })}
                      placeholder="Description (optional)"
                      className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
                    />
                  </label>
                  <label className="grid gap-1">
                    <span className="block text-sm font-medium text-gray-700">Chinese Description</span>
                    <input
                      value={question.cn_description}
                      disabled={disabled}
                      onChange={(e) => setQuestion(qIndex, { cn_description: e.target.value })}
                      placeholder="Chinese description (optional)"
                      className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
                    />
                  </label>
                  <select
                    value={question.question_type}
                    disabled={disabled}
                    onChange={(e) =>
                      setQuestion(qIndex, { question_type: e.target.value as 'single_choice' | 'multi_choice' })
                    }
                    className="w-full rounded border border-gray-300 px-3 py-2 text-sm md:col-span-2"
                  >
                    <option value="single_choice">Single choice</option>
                    <option value="multi_choice">Multi choice</option>
                  </select>
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div className="flex items-center justify-between rounded-md border border-gray-200 bg-white px-3 py-2">
                    <span className="text-sm font-medium text-gray-700">Required</span>
                    <Switch
                      checked={question.is_required}
                      disabled={disabled}
                      onCheckedChange={(checked) => setQuestion(qIndex, { is_required: checked })}
                    />
                  </div>
                  <div className="flex items-center justify-between rounded-md border border-gray-200 bg-white px-3 py-2">
                    <span className="text-sm font-medium text-gray-700">Status</span>
                    <Switch
                      checked={question.is_active}
                      disabled={disabled}
                      onCheckedChange={(checked) => setQuestion(qIndex, { is_active: checked })}
                    />
                  </div>
                </div>

                <div className="space-y-3 rounded-lg border border-gray-200 bg-gray-50/80 p-4">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="text-sm font-semibold text-gray-900">Options</p>
                      <p className="text-xs text-gray-500">Each option links to a booking service used as an add-on.</p>
                    </div>
                    <button
                      type="button"
                      disabled={disabled}
                      onClick={() =>
                        setQuestion(qIndex, {
                          options: [
                            ...question.options,
                            { ...emptyQuestionOption(), sort_order: String(question.options.length) },
                          ],
                        })
                      }
                      className="inline-flex items-center justify-center gap-1.5 rounded-md border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 shrink-0"
                    >
                      <i className="fa-solid fa-plus text-[10px]" />
                      Add option
                    </button>
                  </div>

                  {question.options.map((option, oIndex) => (
                    <div
                      key={option.id ?? `question-${qIndex}-option-${oIndex}`}
                      className="space-y-2 rounded border border-gray-200 bg-white p-3"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="text-xs font-medium text-gray-700">Option #{oIndex + 1}</p>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            disabled={disabled || oIndex === 0}
                            onClick={() => moveOption(qIndex, oIndex, 'up')}
                            className="rounded border border-gray-300 px-2 py-1 text-xs text-gray-600 hover:bg-gray-50 disabled:opacity-50"
                            aria-label="Move option up"
                          >
                            <i className="fa-solid fa-arrow-up" />
                          </button>
                          <button
                            type="button"
                            disabled={disabled || oIndex === question.options.length - 1}
                            onClick={() => moveOption(qIndex, oIndex, 'down')}
                            className="rounded border border-gray-300 px-2 py-1 text-xs text-gray-600 hover:bg-gray-50 disabled:opacity-50"
                            aria-label="Move option down"
                          >
                            <i className="fa-solid fa-arrow-down" />
                          </button>
                          <button
                            type="button"
                            disabled={disabled}
                            onClick={() =>
                              setQuestion(qIndex, {
                                options: question.options.filter((_, index) => index !== oIndex),
                              })
                            }
                            className="rounded border border-red-200 px-2 py-1 text-xs text-red-600 hover:bg-red-50 disabled:opacity-50"
                            aria-label="Remove option"
                          >
                            <i className="fa-solid fa-trash" />
                          </button>
                        </div>
                      </div>
                      <div className="grid gap-3 md:grid-cols-2">
                        <label className="grid gap-1">
                          <span className="block text-sm font-medium text-gray-700">Label</span>
                          <input
                            value={option.label}
                            disabled={disabled}
                            onChange={(e) => setOption(qIndex, oIndex, { label: e.target.value })}
                            placeholder="Option label (optional — defaults to selected service name)"
                            className="h-10 w-full rounded border border-gray-300 px-3 py-2 text-sm"
                          />
                        </label>
                        <label className="grid gap-1">
                          <span className="block text-sm font-medium text-gray-700">Chinese Label</span>
                          <input
                            value={option.cn_label}
                            disabled={disabled}
                            onChange={(e) => setOption(qIndex, oIndex, { cn_label: e.target.value })}
                            placeholder="Chinese option label (optional)"
                            className="h-10 w-full rounded border border-gray-300 px-3 py-2 text-sm"
                          />
                        </label>
                        <div className="md:col-span-2">
                          <BookingServiceLinkedBookingServicePicker
                            options={bookingServiceOptions}
                            value={option.linked_booking_service_id}
                            onChange={(next) => setOption(qIndex, oIndex, { linked_booking_service_id: next })}
                            disabled={disabled}
                          />
                        </div>
                       
                        {(() => {
                          const selectedService = bookingServiceOptions.find(
                            (service) => String(service.id) === option.linked_booking_service_id,
                          )
                          return selectedService ? (
                            <p className="rounded border border-green-200 bg-green-50 px-3 py-2 text-xs text-green-700 md:col-span-2">
                              Auto add-on values from <span className="font-semibold">{selectedService.name}</span>:
                              +{selectedService.duration_min} min, +RM
                              {Number(selectedService.service_price || 0).toFixed(2)}
                            </p>
                          ) : null
                        })()}
                      </div>
                      <div className="flex items-center justify-between rounded-md border border-gray-200 bg-white px-3 py-2">
                        <span className="text-sm font-medium text-gray-700">Status</span>
                        <Switch
                          checked={option.is_active}
                          disabled={disabled}
                          onCheckedChange={(checked) => setOption(qIndex, oIndex, { is_active: checked })}
                        />
                      </div>
                      <div className="flex items-center justify-between rounded-md border border-gray-200 bg-white px-3 py-2">
                        <div>
                          <span className="text-sm font-medium text-gray-700">Allow quantity in POS</span>
                          <p className="text-xs text-gray-500">When enabled, CRM staff can set add-on quantity. Customer booking shop always uses quantity 1.</p>
                        </div>
                        <Switch
                          checked={option.allow_quantity}
                          disabled={disabled}
                          onCheckedChange={(checked) => setOption(qIndex, oIndex, { allow_quantity: checked })}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        )
      })}
    </div>
  )
}
