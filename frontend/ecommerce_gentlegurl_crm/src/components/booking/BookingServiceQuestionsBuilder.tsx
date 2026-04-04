'use client'

export type QuestionOptionForm = {
  id?: number
  label: string
  linked_booking_service_id: string
  extra_duration_min: string
  extra_price: string
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
  extra_duration_min: '0',
  extra_price: '0',
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

interface Props {
  value: QuestionForm[]
  onChange: (next: QuestionForm[]) => void
  disabled?: boolean
}

export default function BookingServiceQuestionsBuilder({ value, onChange, disabled }: Props) {
  const setQuestion = (index: number, patch: Partial<QuestionForm>) => {
    const next = [...value]
    next[index] = { ...next[index], ...patch }
    onChange(next)
  }

  const setOption = (qIndex: number, oIndex: number, patch: Partial<QuestionOptionForm>) => {
    const next = [...value]
    const options = [...(next[qIndex]?.options ?? [])]
    options[oIndex] = { ...options[oIndex], ...patch }
    next[qIndex] = { ...next[qIndex], options }
    onChange(next)
  }

  return (
    <div className="space-y-4 rounded-lg border border-gray-200 p-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-800">Add-ons / Questions</h3>
        <button
          type="button"
          disabled={disabled}
          onClick={() => onChange([...value, { ...emptyQuestion(), sort_order: String(value.length + 1) }])}
          className="rounded-md border border-gray-300 px-3 py-1.5 text-xs font-semibold hover:bg-gray-50 disabled:opacity-50"
        >
          + Add Question
        </button>
      </div>

      {value.map((question, qIndex) => (
        <div key={`question-${qIndex}`} className="space-y-3 rounded-md border border-gray-200 p-3">
          <div className="flex justify-between">
            <p className="text-xs font-semibold uppercase text-gray-500">Question {qIndex + 1}</p>
            <button
              type="button"
              disabled={disabled}
              onClick={() => onChange(value.filter((_, index) => index !== qIndex))}
              className="text-xs text-red-600 hover:underline disabled:opacity-50"
            >
              Remove Question
            </button>
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <input value={question.title} disabled={disabled} onChange={(e) => setQuestion(qIndex, { title: e.target.value })} placeholder="Question title" className="w-full rounded border border-gray-300 px-3 py-2 text-sm" />
            <input value={question.description} disabled={disabled} onChange={(e) => setQuestion(qIndex, { description: e.target.value })} placeholder="Description (optional)" className="w-full rounded border border-gray-300 px-3 py-2 text-sm" />
            <select value={question.question_type} disabled={disabled} onChange={(e) => setQuestion(qIndex, { question_type: e.target.value as 'single_choice' | 'multi_choice' })} className="w-full rounded border border-gray-300 px-3 py-2 text-sm">
              <option value="single_choice">Single choice</option>
              <option value="multi_choice">Multi choice</option>
            </select>
            <input type="number" min={0} value={question.sort_order} disabled={disabled} onChange={(e) => setQuestion(qIndex, { sort_order: e.target.value })} placeholder="Sort order" className="w-full rounded border border-gray-300 px-3 py-2 text-sm" />
          </div>

          <div className="flex flex-wrap gap-4 text-sm">
            <label className="inline-flex items-center gap-2"><input type="checkbox" checked={question.is_required} disabled={disabled} onChange={(e) => setQuestion(qIndex, { is_required: e.target.checked })} /> Required</label>
            <label className="inline-flex items-center gap-2"><input type="checkbox" checked={question.is_active} disabled={disabled} onChange={(e) => setQuestion(qIndex, { is_active: e.target.checked })} /> Active</label>
          </div>

          <div className="space-y-2 rounded border border-gray-100 bg-gray-50 p-3">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold uppercase text-gray-500">Options</p>
              <button type="button" disabled={disabled} onClick={() => setQuestion(qIndex, { options: [...question.options, { ...emptyQuestionOption(), sort_order: String(question.options.length + 1) }] })} className="rounded border border-gray-300 px-2 py-1 text-xs hover:bg-white disabled:opacity-50">+ Add Option</button>
            </div>

            {question.options.map((option, oIndex) => (
              <div key={`question-${qIndex}-option-${oIndex}`} className="space-y-2 rounded border border-gray-200 bg-white p-2">
                <div className="flex justify-end">
                  <button type="button" disabled={disabled} onClick={() => setQuestion(qIndex, { options: question.options.filter((_, index) => index !== oIndex) })} className="text-xs text-red-600 hover:underline disabled:opacity-50">Remove Option</button>
                </div>
                <div className="grid gap-2 md:grid-cols-2">
                  <input value={option.label} disabled={disabled} onChange={(e) => setOption(qIndex, oIndex, { label: e.target.value })} placeholder="Label" className="w-full rounded border border-gray-300 px-3 py-2 text-sm" />
                  <input type="number" min={0} value={option.sort_order} disabled={disabled} onChange={(e) => setOption(qIndex, oIndex, { sort_order: e.target.value })} placeholder="Sort order" className="w-full rounded border border-gray-300 px-3 py-2 text-sm" />
                  <input type="number" min={0} value={option.extra_duration_min} disabled={disabled} onChange={(e) => setOption(qIndex, oIndex, { extra_duration_min: e.target.value })} placeholder="Extra duration (min)" className="w-full rounded border border-gray-300 px-3 py-2 text-sm" />
                  <input type="number" min={0} step="0.01" value={option.extra_price} disabled={disabled} onChange={(e) => setOption(qIndex, oIndex, { extra_price: e.target.value })} placeholder="Extra price" className="w-full rounded border border-gray-300 px-3 py-2 text-sm" />
                  <input type="number" min={0} value={option.linked_booking_service_id} disabled={disabled} onChange={(e) => setOption(qIndex, oIndex, { linked_booking_service_id: e.target.value })} placeholder="Linked booking service ID (optional)" className="w-full rounded border border-gray-300 px-3 py-2 text-sm md:col-span-2" />
                </div>
                <label className="inline-flex items-center gap-2 text-sm"><input type="checkbox" checked={option.is_active} disabled={disabled} onChange={(e) => setOption(qIndex, oIndex, { is_active: e.target.checked })} /> Active</label>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}
