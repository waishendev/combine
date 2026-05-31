'use client'

import { useEffect, useState } from 'react'

import { Switch } from '@/components/ui/switch'
import type { BookingProductQuestion, BookingProductQuestionOption } from './bookingProductTypes'

export const emptyBookingProductQuestionOption = (): BookingProductQuestionOption => ({
  label: '',
  cn_label: '',
  extra_price: 0,
  sort_order: 0,
  is_active: true,
})

export const emptyBookingProductQuestion = (): BookingProductQuestion => ({
  title: '',
  cn_title: '',
  description: '',
  cn_description: '',
  question_type: 'single_choice',
  sort_order: 0,
  is_required: false,
  is_active: true,
  options: [emptyBookingProductQuestionOption()],
})

function normalizeSortOrders(questions: BookingProductQuestion[]): BookingProductQuestion[] {
  return questions.map((q, qi) => ({
    ...q,
    sort_order: qi,
    options: (q.options ?? []).map((o, oi) => ({ ...o, sort_order: oi })),
  }))
}

const inputClass =
  'w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm placeholder:text-gray-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 disabled:bg-gray-50 disabled:text-gray-500'

type Props = {
  value: BookingProductQuestion[]
  onChange: (next: BookingProductQuestion[]) => void
  disabled?: boolean
}

export default function BookingProductQuestionsBuilder({ value, onChange, disabled }: Props) {
  const [collapsedQuestions, setCollapsedQuestions] = useState<boolean[]>([])

  useEffect(() => {
    setCollapsedQuestions((prev) => {
      if (prev.length === value.length) return prev
      if (prev.length < value.length) {
        return [...prev, ...Array(value.length - prev.length).fill(false)]
      }
      return prev.slice(0, value.length)
    })
  }, [value.length])

  const setQuestion = (index: number, patch: Partial<BookingProductQuestion>) => {
    const next = [...value]
    next[index] = { ...next[index], ...patch }
    onChange(normalizeSortOrders(next))
  }

  const setOption = (qIndex: number, oIndex: number, patch: Partial<BookingProductQuestionOption>) => {
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
    const opts = [...(next[qIndex].options ?? [])]
    const targetIndex = direction === 'up' ? oIndex - 1 : oIndex + 1
    if (targetIndex < 0 || targetIndex >= opts.length) return
    const [moved] = opts.splice(oIndex, 1)
    opts.splice(targetIndex, 0, moved)
    next[qIndex] = { ...next[qIndex], options: opts }
    onChange(normalizeSortOrders(next))
  }

  const addQuestion = () => {
    onChange(normalizeSortOrders([...value, emptyBookingProductQuestion()]))
    setCollapsedQuestions((prev) => [...prev, false])
  }

  const removeQuestion = (qIndex: number) => {
    onChange(normalizeSortOrders(value.filter((_, index) => index !== qIndex)))
    setCollapsedQuestions((prev) => prev.filter((_, i) => i !== qIndex))
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 border-b border-gray-100 pb-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="text-base font-semibold text-gray-900">Questions / Add-ons</h3>
          <p className="mt-1 text-sm text-gray-500">
            Optional choices customers can pick when booking. Each option can add an extra charge.
          </p>
        </div>
        <button
          type="button"
          disabled={disabled}
          onClick={addQuestion}
          className="inline-flex w-full shrink-0 items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 sm:w-auto"
        >
          <i className="fa-solid fa-plus text-xs" />
          Add question
        </button>
      </div>

      {value.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-300 bg-gray-50/50 px-6 py-10 text-center">
          <i className="fa-solid fa-list-check mb-3 text-2xl text-gray-300" />
          <p className="text-sm font-medium text-gray-600">No questions yet</p>
          <p className="mt-1 text-xs text-gray-500">Add a question to offer add-on choices on this product.</p>
        </div>
      ) : null}

      {value.map((question, qIndex) => {
        const isCollapsed = collapsedQuestions[qIndex] ?? false
        const titlePreview = question.title.trim() || `Question ${qIndex + 1}`

        const toggleCollapsed = () => {
          setCollapsedQuestions((prev) => {
            const next = [...prev]
            while (next.length <= qIndex) next.push(false)
            next[qIndex] = !isCollapsed
            return next
          })
        }

        return (
          <div
            key={question.id ?? `booking-product-question-${qIndex}`}
            className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm"
          >
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-100 bg-gray-50/80 px-4 py-3">
              <button
                type="button"
                disabled={disabled}
                onClick={toggleCollapsed}
                className="flex min-w-0 flex-1 items-center gap-2 text-left"
              >
                <i
                  className={`fa-solid fa-chevron-${isCollapsed ? 'right' : 'down'} shrink-0 text-xs text-gray-400`}
                />
                <span className="truncate text-sm font-semibold text-gray-900">{titlePreview}</span>
                {question.is_required ? (
                  <span className="shrink-0 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-800">
                    Required
                  </span>
                ) : null}
                {!question.is_active ? (
                  <span className="shrink-0 rounded-full bg-gray-200 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-gray-600">
                    Inactive
                  </span>
                ) : null}
              </button>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  disabled={disabled || qIndex === 0}
                  onClick={() => moveQuestion(qIndex, 'up')}
                  className="rounded-lg border border-gray-300 bg-white px-2.5 py-1.5 text-xs text-gray-600 hover:bg-gray-50 disabled:opacity-40"
                  aria-label="Move question up"
                >
                  <i className="fa-solid fa-arrow-up" />
                </button>
                <button
                  type="button"
                  disabled={disabled || qIndex === value.length - 1}
                  onClick={() => moveQuestion(qIndex, 'down')}
                  className="rounded-lg border border-gray-300 bg-white px-2.5 py-1.5 text-xs text-gray-600 hover:bg-gray-50 disabled:opacity-40"
                  aria-label="Move question down"
                >
                  <i className="fa-solid fa-arrow-down" />
                </button>
                <button
                  type="button"
                  disabled={disabled}
                  onClick={() => removeQuestion(qIndex)}
                  className="rounded-lg border border-red-200 bg-white px-2.5 py-1.5 text-xs text-red-600 hover:bg-red-50 disabled:opacity-40"
                  aria-label="Remove question"
                >
                  <i className="fa-solid fa-trash" />
                </button>
              </div>
            </div>

            {!isCollapsed ? (
              <div className="space-y-4 p-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <label className="grid gap-1.5 sm:col-span-1">
                    <span className="text-sm font-medium text-gray-700">
                      Question title <span className="text-red-500">*</span>
                    </span>
                    <input
                      value={question.title}
                      disabled={disabled}
                      onChange={(e) => setQuestion(qIndex, { title: e.target.value })}
                      placeholder="e.g. Nail art style"
                      className={inputClass}
                    />
                  </label>
                  <label className="grid gap-1.5 sm:col-span-1">
                    <span className="text-sm font-medium text-gray-700">Chinese title</span>
                    <input
                      value={question.cn_title ?? ''}
                      disabled={disabled}
                      onChange={(e) => setQuestion(qIndex, { cn_title: e.target.value })}
                      placeholder="中文标题（可选）"
                      className={inputClass}
                    />
                  </label>
                  <label className="grid gap-1.5 sm:col-span-1">
                    <span className="text-sm font-medium text-gray-700">Description</span>
                    <input
                      value={question.description ?? ''}
                      disabled={disabled}
                      onChange={(e) => setQuestion(qIndex, { description: e.target.value })}
                      placeholder="Optional helper text"
                      className={inputClass}
                    />
                  </label>
                  <label className="grid gap-1.5 sm:col-span-1">
                    <span className="text-sm font-medium text-gray-700">Chinese description</span>
                    <input
                      value={question.cn_description ?? ''}
                      disabled={disabled}
                      onChange={(e) => setQuestion(qIndex, { cn_description: e.target.value })}
                      placeholder="中文说明（可选）"
                      className={inputClass}
                    />
                  </label>
                  <label className="grid gap-1.5 sm:col-span-2 sm:max-w-xs">
                    <span className="text-sm font-medium text-gray-700">Selection type</span>
                    <select
                      value={question.question_type}
                      disabled={disabled}
                      onChange={(e) =>
                        setQuestion(qIndex, {
                          question_type: e.target.value as 'single_choice' | 'multi_choice',
                        })
                      }
                      className={inputClass}
                    >
                      <option value="single_choice">Single choice</option>
                      <option value="multi_choice">Multiple choice</option>
                    </select>
                  </label>
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div className="flex items-center justify-between rounded-lg border border-gray-200 bg-gray-50/50 px-3 py-2.5">
                    <span className="text-sm font-medium text-gray-700">Required</span>
                    <Switch
                      checked={question.is_required}
                      disabled={disabled}
                      onCheckedChange={(checked) => setQuestion(qIndex, { is_required: checked })}
                    />
                  </div>
                  <div className="flex items-center justify-between rounded-lg border border-gray-200 bg-gray-50/50 px-3 py-2.5">
                    <span className="text-sm font-medium text-gray-700">Active</span>
                    <Switch
                      checked={question.is_active}
                      disabled={disabled}
                      onCheckedChange={(checked) => setQuestion(qIndex, { is_active: checked })}
                    />
                  </div>
                </div>

                <div className="rounded-xl border border-gray-200 bg-slate-50/60 p-4">
                  <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="text-sm font-semibold text-gray-900">Add-on options</p>
                      <p className="text-xs text-gray-500">Each row is one selectable choice with optional extra price.</p>
                    </div>
                    <button
                      type="button"
                      disabled={disabled}
                      onClick={() =>
                        setQuestion(qIndex, {
                          options: [...(question.options ?? []), emptyBookingProductQuestionOption()],
                        })
                      }
                      className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 shadow-sm hover:bg-gray-50 disabled:opacity-50"
                    >
                      <i className="fa-solid fa-plus text-[10px]" />
                      Add option
                    </button>
                  </div>

                  {(question.options ?? []).length === 0 ? (
                    <p className="rounded-lg border border-dashed border-gray-300 bg-white px-4 py-6 text-center text-xs text-gray-500">
                      No options yet. Add at least one choice.
                    </p>
                  ) : (
                    <div className="space-y-2">
                      <div className="hidden gap-2 px-1 text-[11px] font-semibold uppercase tracking-wide text-gray-500 md:grid md:grid-cols-[minmax(0,1.4fr)_minmax(0,1.2fr)_minmax(0,0.7fr)_auto_auto]">
                        <span>Label</span>
                        <span>Chinese label</span>
                        <span>Extra price (RM)</span>
                        <span className="text-center">Active</span>
                        <span className="sr-only">Actions</span>
                      </div>

                      {(question.options ?? []).map((option, oIndex) => (
                        <div
                          key={option.id ?? `q-${qIndex}-opt-${oIndex}`}
                          className="rounded-lg border border-gray-200 bg-white p-3 shadow-sm md:grid md:grid-cols-[minmax(0,1.4fr)_minmax(0,1.2fr)_minmax(0,0.7fr)_auto_auto] md:items-center md:gap-2 md:p-2 md:px-2"
                        >
                          <label className="grid gap-1 md:contents">
                            <span className="text-xs font-medium text-gray-500 md:sr-only">Label</span>
                            <input
                              value={option.label}
                              disabled={disabled}
                              onChange={(e) => setOption(qIndex, oIndex, { label: e.target.value })}
                              placeholder="Option label"
                              className={inputClass}
                            />
                          </label>
                          <label className="mt-2 grid gap-1 md:mt-0 md:contents">
                            <span className="text-xs font-medium text-gray-500 md:sr-only">Chinese label</span>
                            <input
                              value={option.cn_label ?? ''}
                              disabled={disabled}
                              onChange={(e) => setOption(qIndex, oIndex, { cn_label: e.target.value })}
                              placeholder="中文"
                              className={inputClass}
                            />
                          </label>
                          <label className="mt-2 grid gap-1 md:mt-0 md:contents">
                            <span className="text-xs font-medium text-gray-500 md:sr-only">Extra price</span>
                            <div className="relative">
                              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-xs text-gray-400">
                                RM
                              </span>
                              <input
                                type="number"
                                min={0}
                                step="0.01"
                                value={option.extra_price}
                                disabled={disabled}
                                onChange={(e) =>
                                  setOption(qIndex, oIndex, {
                                    extra_price: Number(e.target.value || 0),
                                  })
                                }
                                className={`${inputClass} pl-9`}
                              />
                            </div>
                          </label>
                          <div className="mt-2 flex items-center justify-between gap-2 md:mt-0 md:justify-center">
                            <span className="text-xs font-medium text-gray-500 md:sr-only">Active</span>
                            <Switch
                              checked={option.is_active}
                              disabled={disabled}
                              onCheckedChange={(checked) => setOption(qIndex, oIndex, { is_active: checked })}
                            />
                          </div>
                          <div className="mt-2 flex items-center justify-end gap-1 md:mt-0">
                            <button
                              type="button"
                              disabled={disabled || oIndex === 0}
                              onClick={() => moveOption(qIndex, oIndex, 'up')}
                              className="rounded-lg border border-gray-300 px-2 py-1.5 text-xs text-gray-600 hover:bg-gray-50 disabled:opacity-40"
                              aria-label="Move option up"
                            >
                              <i className="fa-solid fa-arrow-up" />
                            </button>
                            <button
                              type="button"
                              disabled={disabled || oIndex === (question.options?.length ?? 0) - 1}
                              onClick={() => moveOption(qIndex, oIndex, 'down')}
                              className="rounded-lg border border-gray-300 px-2 py-1.5 text-xs text-gray-600 hover:bg-gray-50 disabled:opacity-40"
                              aria-label="Move option down"
                            >
                              <i className="fa-solid fa-arrow-down" />
                            </button>
                            <button
                              type="button"
                              disabled={disabled}
                              onClick={() =>
                                setQuestion(qIndex, {
                                  options: (question.options ?? []).filter((_, index) => index !== oIndex),
                                })
                              }
                              className="rounded-lg border border-red-200 px-2 py-1.5 text-xs text-red-600 hover:bg-red-50 disabled:opacity-40"
                              aria-label="Remove option"
                            >
                              <i className="fa-solid fa-trash" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ) : null}
          </div>
        )
      })}
    </div>
  )
}
