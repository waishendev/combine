'use client'

import { FormEvent, useEffect, useState } from 'react'

import CrmFormModalShell from '@/components/CrmFormModalShell'
import FormErrorAnchor from '@/components/FormErrorAnchor'
import BookingServiceQuestionsBuilder, {
  emptyQuestion,
  type QuestionForm,
} from './BookingServiceQuestionsBuilder'

export type QuestionPresetRow = {
  id: number
  name: string
  cn_name?: string | null
  is_active: boolean
  attached_services_count?: number
  questions_count?: number
}

type BookingServiceOption = {
  id: number
  name: string
  duration_min: number
  service_price: number
}

interface Props {
  mode: 'create' | 'edit'
  presetId?: number | null
  /** When create: open prefilled from this preset; Save POSTs a new row. */
  copyFromPresetId?: number | null
  onClose: () => void
  onSuccess: (createdId?: number) => void
}

const formId = 'booking-question-preset-form'

function mapApiQuestions(raw: unknown[], stripIds = false): QuestionForm[] {
  return raw.map((item, questionIndex) => {
    const question = item as Record<string, unknown>
    const options = Array.isArray(question.options) ? question.options : []
    return {
      id: stripIds || question.id == null ? undefined : Number(question.id),
      title: String(question.title ?? ''),
      cn_title: String(question.cn_title ?? ''),
      description: String(question.description ?? ''),
      cn_description: String(question.cn_description ?? ''),
      question_type: question.question_type === 'multi_choice' ? 'multi_choice' : 'single_choice',
      sort_order: String(question.sort_order ?? questionIndex),
      is_required: Boolean(question.is_required),
      is_active: question.is_active !== false,
      options:
        options.length > 0
          ? options.map((opt, optionIndex) => {
              const option = opt as Record<string, unknown>
              return {
                id: stripIds || option.id == null ? undefined : Number(option.id),
                label: String(option.label ?? ''),
                cn_label: String(option.cn_label ?? ''),
                linked_booking_service_id: option.linked_booking_service_id
                  ? String(option.linked_booking_service_id)
                  : '',
                sort_order: String(option.sort_order ?? optionIndex),
                is_active: option.is_active !== false,
                allow_quantity: option.allow_quantity !== false,
              }
            })
          : [emptyQuestion().options[0]],
    }
  })
}

export default function BookingQuestionPresetUpsertModal({
  mode,
  presetId,
  copyFromPresetId = null,
  onClose,
  onSuccess,
}: Props) {
  const copySourceId = (() => {
    if (mode !== 'create') return null
    const n = Number(copyFromPresetId)
    return Number.isFinite(n) && n > 0 ? n : null
  })()

  const [name, setName] = useState('')
  const [cnName, setCnName] = useState('')
  const [isActive, setIsActive] = useState(true)
  const [questions, setQuestions] = useState<QuestionForm[]>([emptyQuestion()])
  const [bookingServiceOptions, setBookingServiceOptions] = useState<BookingServiceOption[]>([])
  const [loading, setLoading] = useState(mode === 'edit' || copySourceId != null)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    const loadOptions = async () => {
      try {
        const res = await fetch('/api/proxy/admin/booking/services/options?limit=2000', {
          cache: 'no-store',
          headers: { Accept: 'application/json' },
        })
        const data = await res.json().catch(() => null)
        const list = Array.isArray(data?.data) ? data.data : []
        if (!cancelled) {
          setBookingServiceOptions(
            list.map((item: Record<string, unknown>) => ({
              id: Number(item.id),
              name: String(item.name ?? ''),
              duration_min: Number(item.duration_min ?? 0),
              service_price: Number(item.service_price ?? 0),
            })),
          )
        }
      } catch {
        // options picker can stay empty
      }
    }
    void loadOptions()
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (mode === 'edit') {
      if (!presetId) return
    } else if (copySourceId == null) {
      return
    }

    const sourceId = mode === 'edit' ? presetId : copySourceId
    if (!sourceId) return

    let cancelled = false
    const load = async () => {
      setLoading(true)
      setError(null)
      try {
        const res = await fetch(`/api/proxy/admin/booking/question-presets/${sourceId}`, {
          cache: 'no-store',
          headers: { Accept: 'application/json' },
        })
        const data = await res.json().catch(() => null)
        if (!res.ok || data?.success === false) {
          throw new Error(
            data?.message || (mode === 'edit' ? 'Failed to load preset' : 'Failed to load preset to copy'),
          )
        }
        const preset = data?.data ?? {}
        if (cancelled) return
        const rawName = String(preset.name ?? '').trim()
        setName(mode === 'edit' ? rawName : rawName || '')
        setCnName(String(preset.cn_name ?? ''))
        setIsActive(preset.is_active !== false)
        setQuestions(
          Array.isArray(preset.questions) && preset.questions.length > 0
            ? mapApiQuestions(preset.questions, mode === 'create')
            : [emptyQuestion()],
        )
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error
              ? err.message
              : mode === 'edit'
                ? 'Failed to load preset'
                : 'Failed to load preset to copy',
          )
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [mode, presetId, copySourceId])

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()
    if (!name.trim()) {
      setError('Name is required')
      return
    }
    const missingLinked = questions.some((q) =>
      q.options.some((o) => !o.linked_booking_service_id.trim()),
    )
    if (missingLinked) {
      setError('Each option must select a linked booking service')
      return
    }

    setSubmitting(true)
    setError(null)
    try {
      const payload = {
        name: name.trim(),
        cn_name: cnName.trim() || null,
        is_active: isActive,
        questions: questions.map((question, questionIndex) => ({
          title: question.title.trim(),
          cn_title: question.cn_title.trim() || null,
          description: question.description.trim() || null,
          cn_description: question.cn_description.trim() || null,
          question_type: question.question_type,
          sort_order: questionIndex,
          is_required: question.is_required,
          is_active: question.is_active,
          options: question.options.map((option, optionIndex) => ({
            label: option.label.trim(),
            cn_label: option.cn_label.trim() || null,
            linked_booking_service_id: Number(option.linked_booking_service_id),
            sort_order: optionIndex,
            is_active: option.is_active,
            allow_quantity: option.allow_quantity,
          })),
        })),
      }

      const url =
        mode === 'edit' && presetId
          ? `/api/proxy/admin/booking/question-presets/${presetId}`
          : '/api/proxy/admin/booking/question-presets'
      const res = await fetch(url, {
        method: mode === 'edit' ? 'PUT' : 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      })
      const data = await res.json().catch(() => null)
      if (!res.ok || data?.success === false) {
        const firstError =
          data?.errors && typeof data.errors === 'object'
            ? Object.values(data.errors as Record<string, string[]>).flat()[0]
            : null
        throw new Error(firstError || data?.message || 'Save failed')
      }
      onSuccess(mode === 'create' && data?.data?.id != null ? Number(data.data.id) : undefined)
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed')
    } finally {
      setSubmitting(false)
    }
  }

  const modalTitle = mode === 'edit' ? 'Edit Question Preset' : 'Create Question Preset'
  const submitLabel = submitting ? 'Saving…' : mode === 'edit' ? 'Save preset' : 'Create preset'
  const disableForm = submitting || loading

  return (
    <CrmFormModalShell
      title={
        <div>
          <div>{modalTitle}</div>
          {copySourceId != null ? (
            <p className="mt-1 text-xs font-normal text-gray-500">
              {loading
                ? 'Loading preset…'
                : 'Prefilled from the selected preset. Save to create a new preset.'}
            </p>
          ) : null}
        </div>
      }
      onClose={onClose}
      closeDisabled={disableForm}
      size="xl"
      footer={
        <>
          <button
            type="button"
            onClick={onClose}
            disabled={disableForm}
            className="rounded-md border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            form={formId}
            disabled={disableForm}
            className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {submitLabel}
          </button>
        </>
      }
    >
      <div className="space-y-4 px-4 py-4 sm:px-5">
        {error ? <FormErrorAnchor error={error} /> : null}
        {loading ? (
          <p className="text-sm text-gray-500">Loading…</p>
        ) : (
          <form id={formId} onSubmit={handleSubmit} className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Name</label>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                  disabled={submitting}
                  required
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">CN Name</label>
                <input
                  value={cnName}
                  onChange={(e) => setCnName(e.target.value)}
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                  disabled={submitting}
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Active</label>
                <select
                  value={isActive ? '1' : '0'}
                  onChange={(e) => setIsActive(e.target.value === '1')}
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                  disabled={submitting}
                >
                  <option value="1">Active</option>
                  <option value="0">Inactive</option>
                </select>
              </div>
            </div>

            {mode === 'edit' ? (
              <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
                Saving this preset updates questions on every service that attached it. Custom questions on those
                services are kept.
              </p>
            ) : null}

            <BookingServiceQuestionsBuilder
              value={questions}
              onChange={setQuestions}
              bookingServiceOptions={bookingServiceOptions}
              disabled={submitting}
            />
          </form>
        )}
      </div>
    </CrmFormModalShell>
  )
}
