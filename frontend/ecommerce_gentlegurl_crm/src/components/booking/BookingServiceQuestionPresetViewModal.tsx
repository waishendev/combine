'use client'

import CrmFormModalShell from '@/components/CrmFormModalShell'
import type { QuestionPresetOption } from './BookingServiceQuestionPresetPickerModal'

interface Props {
  preset: QuestionPresetOption
  onClose: () => void
}

function formatPrice(amount: number | null | undefined): string | null {
  if (amount == null || Number.isNaN(Number(amount))) return null
  return `RM ${Number(amount).toFixed(2)}`
}

function formatDuration(minutes: number | null | undefined): string | null {
  if (minutes == null || Number.isNaN(Number(minutes))) return null
  const value = Number(minutes)
  if (value <= 0) return '0 min'
  return `${value} min`
}

function Field({
  label,
  value,
  muted,
}: {
  label: string
  value?: string | null
  muted?: boolean
}) {
  if (!value) return null
  return (
    <div>
      <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">{label}</p>
      <p className={`mt-0.5 text-sm ${muted ? 'text-gray-500' : 'font-medium text-gray-900'}`}>{value}</p>
    </div>
  )
}

export default function BookingServiceQuestionPresetViewModal({ preset, onClose }: Props) {
  const questions = preset.questions ?? []

  return (
    <CrmFormModalShell
      title={
        <div>
          <div>{preset.name}</div>
          <p className="mt-1 text-xs font-normal text-gray-500">
            Full preset details. Edit content on the Question Presets page.
          </p>
        </div>
      }
      onClose={onClose}
      size="lg"
      footer={
        <button
          type="button"
          onClick={onClose}
          className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          Done
        </button>
      }
    >
      <div className="space-y-4 px-4 py-4 sm:px-5">
        <div className="space-y-2 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
          <Field label="Preset name" value={preset.name} />
          <Field label="CN name" value={preset.cn_name} muted />
          <p className="text-xs text-slate-500">
            {questions.length} question{questions.length === 1 ? '' : 's'}
            {preset.is_active === false ? ' · Inactive' : ''}
          </p>
        </div>

        {questions.length === 0 ? (
          <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50 px-4 py-8 text-center text-sm text-gray-500">
            This preset has no questions.
          </div>
        ) : (
          questions.map((question, index) => {
            const options = question.options ?? []
            return (
              <div
                key={question.id ?? `${preset.id}-q-${index}`}
                className="overflow-hidden rounded-xl border border-gray-200 bg-white"
              >
                <div className="space-y-3 border-b border-gray-100 bg-gray-50/80 px-4 py-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                      Question {index + 1}
                    </span>
                    {question.is_required ? (
                      <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-semibold uppercase text-amber-700">
                        Required
                      </span>
                    ) : (
                      <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-medium uppercase text-gray-500">
                        Optional
                      </span>
                    )}
                    {question.question_type ? (
                      <span className="rounded-full bg-white px-2 py-0.5 text-[10px] font-medium uppercase text-gray-600 ring-1 ring-gray-200">
                        {question.question_type === 'multi_choice' ? 'Multi choice' : 'Single choice'}
                      </span>
                    ) : null}
                    {question.is_active === false ? (
                      <span className="rounded-full bg-red-50 px-2 py-0.5 text-[10px] font-semibold uppercase text-red-600">
                        Inactive
                      </span>
                    ) : null}
                  </div>

                  <Field label="Title" value={question.title || 'Untitled question'} />
                  <Field label="CN title" value={question.cn_title} muted />
                  <Field label="Description" value={question.description} muted />
                  <Field label="CN description" value={question.cn_description} muted />
                </div>

                <div className="px-4 py-3">
                  <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-gray-400">
                    Options · {options.length}
                  </p>
                  {options.length === 0 ? (
                    <p className="text-sm text-gray-500">No options</p>
                  ) : (
                    <ul className="space-y-2.5">
                      {options.map((option, optionIndex) => {
                        const linked = option.linked_booking_service
                        const linkedName =
                          option.linked_booking_service_name ||
                          linked?.name ||
                          null
                        const linkedCn =
                          option.linked_booking_service_cn_name || linked?.cn_name || null
                        const duration = formatDuration(
                          option.extra_duration_min ?? linked?.duration_min ?? null,
                        )
                        const priceMode = option.linked_price_mode
                        let priceLabel = formatPrice(option.extra_price ?? linked?.service_price ?? null)
                        if (
                          priceMode === 'range' &&
                          (option.linked_price_range_min != null || option.linked_price_range_max != null)
                        ) {
                          const min = formatPrice(option.linked_price_range_min)
                          const max = formatPrice(option.linked_price_range_max)
                          priceLabel = [min, max].filter(Boolean).join(' – ') || priceLabel
                        }

                        return (
                          <li
                            key={option.id ?? `${preset.id}-q-${index}-o-${optionIndex}`}
                            className="space-y-3 rounded-xl border border-gray-200 bg-gray-50/70 px-3.5 py-3"
                          >
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="text-[11px] font-semibold uppercase tracking-wide text-gray-400">
                                Option {optionIndex + 1}
                              </span>
                              {option.is_active === false ? (
                                <span className="rounded-full bg-red-50 px-2 py-0.5 text-[10px] font-semibold uppercase text-red-600">
                                  Inactive
                                </span>
                              ) : null}
                            </div>

                            <Field
                              label="Option label"
                              value={option.label || `Option ${optionIndex + 1}`}
                            />
                            <Field label="CN label" value={option.cn_label} muted />

                            <div className="grid gap-2 sm:grid-cols-2">
                              <div className="rounded-lg bg-white px-3 py-2 ring-1 ring-gray-100">
                                <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">
                                  Linked add-on
                                </p>
                                {linkedName ? (
                                  <>
                                    <p className="mt-1 text-sm font-medium text-gray-900">{linkedName}</p>
                                    {linkedCn ? (
                                      <p className="mt-0.5 text-xs text-gray-500">{linkedCn}</p>
                                    ) : null}
                                  </>
                                ) : (
                                  <p className="mt-1 text-sm text-gray-400">Not linked</p>
                                )}
                              </div>
                              <div className="space-y-2 rounded-lg bg-white px-3 py-2 ring-1 ring-gray-100">
                                <div>
                                  <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">
                                    Duration
                                  </p>
                                  <p className="mt-0.5 text-sm font-medium text-gray-900">{duration ?? '—'}</p>
                                </div>
                                <div>
                                  <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">
                                    Price{priceMode === 'range' ? ' (range)' : ''}
                                  </p>
                                  <p className="mt-0.5 text-sm font-medium text-gray-900">{priceLabel ?? '—'}</p>
                                </div>
                              </div>
                            </div>

                            <div>
                              <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">
                                Quantity
                              </p>
                              <p className="mt-0.5 text-sm font-medium text-gray-900">
                                {option.allow_quantity === false ? 'Locked (no qty)' : 'Allowed'}
                              </p>
                            </div>
                          </li>
                        )
                      })}
                    </ul>
                  )}
                </div>
              </div>
            )
          })
        )}
      </div>
    </CrmFormModalShell>
  )
}
