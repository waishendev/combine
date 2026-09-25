'use client'

import { useEffect, useMemo, useState } from 'react'

import { Switch } from '@/components/ui/switch'
import BookingServiceLinkedBookingServicePicker from './BookingServiceLinkedBookingServicePicker'
import BookingServiceQuestionPresetPickerModal, {
  type QuestionPresetOption,
} from './BookingServiceQuestionPresetPickerModal'
import BookingServiceQuestionPresetViewModal from './BookingServiceQuestionPresetViewModal'

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
  /** When true, Add Question asks: use preset or add custom. */
  enablePresets?: boolean
  presetIds?: number[]
  onPresetIdsChange?: (ids: number[]) => void
  lockedPresetQuestions?: Array<{
    title: string
    question_preset_id?: number | null
    options?: Array<{ label?: string }>
  }>
}

export default function BookingServiceQuestionsBuilder({
  value,
  onChange,
  bookingServiceOptions,
  disabled,
  enablePresets = false,
  presetIds = [],
  onPresetIdsChange,
  lockedPresetQuestions = [],
}: Props) {
  const [collapsedQuestions, setCollapsedQuestions] = useState<boolean[]>([])
  const [showAddChoice, setShowAddChoice] = useState(false)
  const [showPresetPicker, setShowPresetPicker] = useState(false)
  const [presetOptions, setPresetOptions] = useState<QuestionPresetOption[]>([])
  const [viewingPreset, setViewingPreset] = useState<QuestionPresetOption | null>(null)

  useEffect(() => {
    setCollapsedQuestions((prev) => {
      if (prev.length === value.length) return prev
      if (prev.length < value.length) {
        return [...prev, ...Array(value.length - prev.length).fill(false)]
      }
      return prev.slice(0, value.length)
    })
  }, [value.length])

  useEffect(() => {
    if (!enablePresets) return
    let cancelled = false
    const load = async () => {
      try {
        const res = await fetch('/api/proxy/admin/booking/question-presets?all=1&is_active=1', {
          cache: 'no-store',
          headers: { Accept: 'application/json' },
        })
        const data = await res.json().catch(() => null)
        const list = Array.isArray(data?.data) ? data.data : []
        if (!cancelled) {
          setPresetOptions(
            list.map((item: QuestionPresetOption) => ({
              id: Number(item.id),
              name: String(item.name ?? ''),
              cn_name: item.cn_name ?? null,
              questions: Array.isArray(item.questions) ? item.questions : [],
            })),
          )
        }
      } catch {
        // chips can stay empty
      }
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [enablePresets])

  const attachedPresets = useMemo(() => {
    return presetIds.map((id) => {
      const found = presetOptions.find((o) => o.id === id)
      if (found) return found
      return {
        id,
        name: `Preset #${id}`,
        cn_name: null,
        questions: lockedPresetQuestions
          .filter((question) => question.question_preset_id === id)
          .map((question) => ({
            title: question.title,
            options: question.options,
          })),
      } satisfies QuestionPresetOption
    })
  }, [presetIds, presetOptions, lockedPresetQuestions])

  type DisplayRow =
    | {
        kind: 'preset'
        key: string
        number: number
        preset: QuestionPresetOption
        presetIndex: number
        question: NonNullable<QuestionPresetOption['questions']>[number]
        questionIndexInPreset: number
        isFirstInPreset: boolean
      }
    | {
        kind: 'custom'
        key: string
        number: number
        customIndex: number
        question: QuestionForm
      }

  const displayRows = useMemo(() => {
    const rows: DisplayRow[] = []
    let number = 1
    attachedPresets.forEach((preset, presetIndex) => {
      const questions =
        preset.questions && preset.questions.length > 0
          ? preset.questions
          : lockedPresetQuestions
              .filter((question) => question.question_preset_id === preset.id)
              .map((question) => ({
                title: question.title,
                options: question.options,
              }))
      // Always show at least one card per applied preset (name/cn), even if details are still loading.
      const entries =
        questions.length > 0
          ? questions
          : [
              {
                title: preset.name,
                cn_title: preset.cn_name ?? null,
                options: [],
              },
            ]
      entries.forEach((question, questionIndexInPreset) => {
        rows.push({
          kind: 'preset',
          key: `preset-${presetIndex}-${preset.id}-q-${questionIndexInPreset}`,
          number: number++,
          preset,
          presetIndex,
          question,
          questionIndexInPreset,
          isFirstInPreset: questionIndexInPreset === 0,
        })
      })
    })
    value.forEach((question, customIndex) => {
      rows.push({
        kind: 'custom',
        key: `custom-${question.id ?? customIndex}`,
        number: number++,
        customIndex,
        question,
      })
    })
    return rows
  }, [attachedPresets, lockedPresetQuestions, value])

  const movePreset = (index: number, direction: -1 | 1) => {
    const nextIndex = index + direction
    if (nextIndex < 0 || nextIndex >= presetIds.length) return
    const next = [...presetIds]
    const tmp = next[index]
    next[index] = next[nextIndex]
    next[nextIndex] = tmp
    onPresetIdsChange?.(next)
  }

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

  const addCustomQuestion = () => {
    onChange(normalizeSortOrders([...value, { ...emptyQuestion(), sort_order: String(value.length) }]))
    setCollapsedQuestions((prev) => [...prev, false])
    setShowAddChoice(false)
  }

  const handleAddClick = () => {
    if (!enablePresets) {
      addCustomQuestion()
      return
    }
    setShowAddChoice(true)
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
        <button
          type="button"
          disabled={disabled}
          onClick={handleAddClick}
          className="inline-flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 md:w-auto w-full shrink-0"
        >
          <i className="fa-solid fa-plus" />
          Add Question
        </button>
      </div>

      {displayRows.length === 0 && (
        <div className="rounded-lg border border-dashed border-gray-300 p-6 text-center text-sm text-gray-500">
          No questions yet. Click Add Question to use a preset or add a custom question.
        </div>
      )}

      {displayRows.filter((row) => row.kind === 'preset').map((row) => {
        if (row.kind !== 'preset') return null
        return (
          <div
            key={row.key}
            className="rounded-lg border border-slate-200 bg-slate-50/80 p-4 space-y-3"
          >
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex min-w-0 flex-wrap items-center gap-2">
                <p className="text-sm font-semibold text-gray-900">Question #{row.number}</p>
                <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-semibold uppercase text-amber-700">
                  Preset
                </span>
              </div>
              {row.isFirstInPreset ? (
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    disabled={disabled || row.presetIndex === 0}
                    onClick={() => movePreset(row.presetIndex, -1)}
                    className="rounded border border-gray-300 px-2 py-1 text-xs text-gray-600 hover:bg-gray-50 disabled:opacity-50"
                    aria-label="Move preset group up"
                    title="Move this preset group up"
                  >
                    <i className="fa-solid fa-arrow-up" />
                  </button>
                  <button
                    type="button"
                    disabled={disabled || row.presetIndex === attachedPresets.length - 1}
                    onClick={() => movePreset(row.presetIndex, 1)}
                    className="rounded border border-gray-300 px-2 py-1 text-xs text-gray-600 hover:bg-gray-50 disabled:opacity-50"
                    aria-label="Move preset group down"
                    title="Move this preset group down"
                  >
                    <i className="fa-solid fa-arrow-down" />
                  </button>
                  <button
                    type="button"
                    disabled={disabled}
                    onClick={() =>
                      setViewingPreset({
                        ...row.preset,
                        questions:
                          row.preset.questions && row.preset.questions.length > 0
                            ? row.preset.questions
                            : lockedPresetQuestions
                                .filter((q) => q.question_preset_id === row.preset.id)
                                .map((q) => ({ title: q.title, options: q.options })),
                      })
                    }
                    className="rounded border border-blue-200 bg-blue-50 px-2.5 py-1 text-xs font-medium text-blue-800 hover:bg-blue-100"
                  >
                    View
                  </button>
                  <button
                    type="button"
                    disabled={disabled}
                    onClick={() => {
                      const next = [...presetIds]
                      next.splice(row.presetIndex, 1)
                      onPresetIdsChange?.(next)
                    }}
                    className="rounded border border-red-200 px-2 py-1 text-xs text-red-600 hover:bg-red-50 disabled:opacity-50"
                    aria-label={`Remove preset ${row.preset.name}`}
                    title="Remove this preset from the service"
                  >
                    <i className="fa-solid fa-trash" />
                  </button>
                </div>
              ) : null}
            </div>

            <div className="rounded-md border border-slate-200 bg-white px-3 py-3">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">Preset name</p>
              <p className="mt-0.5 text-sm font-medium text-gray-900">{row.preset.name}</p>
              {row.preset.cn_name ? (
                <>
                  <p className="mt-2 text-[10px] font-semibold uppercase tracking-wide text-gray-400">CN name</p>
                  <p className="mt-0.5 text-sm text-gray-600">{row.preset.cn_name}</p>
                </>
              ) : null}
            </div>
          </div>
        )
      })}

      {value.map((question, qIndex) => {
        const isCollapsed = collapsedQuestions[qIndex] ?? false
        const questionNumber = displayRows.find((row) => row.kind === 'custom' && row.customIndex === qIndex)?.number ?? qIndex + 1
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
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-sm font-semibold text-gray-900">Question #{questionNumber}</p>
                {enablePresets ? (
                  <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-semibold uppercase text-gray-600">
                    Custom
                  </span>
                ) : null}
              </div>
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

      {showAddChoice ? (
        <div className="fixed inset-0 z-[60] flex items-end justify-center sm:items-center sm:p-4">
          <div className="absolute inset-0 bg-black/40" onClick={() => setShowAddChoice(false)} />
          <div className="relative w-full max-w-md rounded-t-2xl bg-white p-5 shadow-xl sm:rounded-xl">
            <h4 className="text-base font-semibold text-gray-900">How do you want to add questions?</h4>
            <p className="mt-1 text-sm text-gray-500">
              Use a saved preset for shared add-ons, or add a custom question for this service only.
            </p>
            <div className="mt-4 grid gap-2">
              <button
                type="button"
                disabled={disabled}
                onClick={() => {
                  setShowAddChoice(false)
                  setShowPresetPicker(true)
                }}
                className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-left text-sm font-medium text-blue-900 hover:bg-blue-100"
              >
                Use question preset
                <span className="mt-0.5 block text-xs font-normal text-blue-700">
                  Pick one or more presets and apply them here
                </span>
              </button>
              <button
                type="button"
                disabled={disabled}
                onClick={addCustomQuestion}
                className="rounded-lg border border-gray-200 bg-white px-4 py-3 text-left text-sm font-medium text-gray-900 hover:bg-gray-50"
              >
                Add custom question
                <span className="mt-0.5 block text-xs font-normal text-gray-500">
                  Fill title, options, and linked add-on services yourself
                </span>
              </button>
              <button
                type="button"
                onClick={() => setShowAddChoice(false)}
                className="mt-1 rounded-lg px-4 py-2 text-sm text-gray-600 hover:bg-gray-50"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {showPresetPicker ? (
        <BookingServiceQuestionPresetPickerModal
          disabled={disabled}
          onClose={() => setShowPresetPicker(false)}
          onApply={(ids, presets) => {
            if (ids.length > 0) {
              setPresetOptions((prev) => {
                const byId = new Map(prev.map((item) => [item.id, item]))
                presets.forEach((preset) => {
                  byId.set(preset.id, {
                    id: preset.id,
                    name: preset.name,
                    cn_name: preset.cn_name ?? null,
                    is_active: preset.is_active,
                    questions: Array.isArray(preset.questions) ? preset.questions : [],
                  })
                })
                return Array.from(byId.values())
              })
              onPresetIdsChange?.([...presetIds, ...ids])
            }
            setShowPresetPicker(false)
          }}
        />
      ) : null}

      {viewingPreset ? (
        <BookingServiceQuestionPresetViewModal
          preset={viewingPreset}
          onClose={() => setViewingPreset(null)}
        />
      ) : null}
    </div>
  )
}
