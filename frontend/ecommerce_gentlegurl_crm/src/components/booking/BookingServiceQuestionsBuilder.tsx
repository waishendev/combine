'use client'

import { useEffect, useState } from 'react'

import { Switch } from '@/components/ui/switch'
import BookingServiceLinkedBookingServicePicker from './BookingServiceLinkedBookingServicePicker'

export type QuestionOptionForm = {
  id?: number
  label: string
  linked_booking_service_id: string
  sort_order: string
  is_active: boolean
}

export type QuestionForm = {
  id?: number
  title: string
  description: string
  question_type: 'single_choice' | 'multi_choice'
  sort_order: string
  is_required: boolean
  is_active: boolean
  options: QuestionOptionForm[]
}

export const emptyQuestionOption = (): QuestionOptionForm => ({
  label: '',
  linked_booking_service_id: '',
  sort_order: '0',
  is_active: true,
})

export const emptyQuestion = (): QuestionForm => ({
  title: '',
  description: '',
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
          onClick={addQuestion}
          className="inline-flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 md:w-auto w-full shrink-0"
        >
          <i className="fa-solid fa-plus" />
          Add Question
        </button>
      </div>

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
                  <input
                    value={question.title}
                    disabled={disabled}
                    onChange={(e) => setQuestion(qIndex, { title: e.target.value })}
                    placeholder="Question title"
                    className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
                  />
                  <input
                    value={question.description}
                    disabled={disabled}
                    onChange={(e) => setQuestion(qIndex, { description: e.target.value })}
                    placeholder="Description (optional)"
                    className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
                  />
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
                        <BookingServiceLinkedBookingServicePicker
                          options={bookingServiceOptions}
                          value={option.linked_booking_service_id}
                          onChange={(next) => setOption(qIndex, oIndex, { linked_booking_service_id: next })}
                          disabled={disabled}
                        />
                       
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
