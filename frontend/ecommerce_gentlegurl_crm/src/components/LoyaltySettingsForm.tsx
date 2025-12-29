'use client'

import { FormEvent, useEffect, useMemo, useState } from 'react'

type LoyaltySetting = {
  id: number
  base_multiplier: string
  expiry_months: number
  evaluation_cycle_months: number
  rules_effective_at: string | null
  created_at?: string
  updated_at?: string
}

type LoyaltySettingsResponse = {
  data?: {
    current?: LoyaltySetting | null
    history?: LoyaltySetting[]
  } | null
  message?: string | null
  success?: boolean
}

type FeedbackState = {
  type: 'success' | 'error'
  message: string
}

type LoyaltySettingsFormProps = {
  canEdit: boolean
}

export default function LoyaltySettingsForm({ canEdit }: LoyaltySettingsFormProps) {
  const [formState, setFormState] = useState<LoyaltySetting | null>(null)
  const [initialState, setInitialState] = useState<LoyaltySetting | null>(null)
  const [history, setHistory] = useState<LoyaltySetting[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [feedback, setFeedback] = useState<FeedbackState | null>(null)

  const formattedEffectiveDate = useMemo(() => {
    if (!formState?.rules_effective_at) return ''
    const date = new Date(formState.rules_effective_at)
    if (Number.isNaN(date.getTime())) return ''
    return date.toISOString().slice(0, 10)
  }, [formState?.rules_effective_at])

  useEffect(() => {
    let abort = false
    const fetchSettings = async () => {
      try {
        const response = await fetch('/api/proxy/ecommerce/loyalty-settings', {
          cache: 'no-store',
        })

        if (!response.ok) {
          throw new Error('Failed to load loyalty settings')
        }

        const payload: LoyaltySettingsResponse = await response.json()
        const data = payload?.data?.current

        if (!data) {
          throw new Error('No loyalty settings returned')
        }

        if (!abort) {
          setFormState(data)
          setInitialState(data)
          setHistory(payload?.data?.history ?? [])
          setFeedback(null)
        }
      } catch (error) {
        if (!abort) {
          setFeedback({
            type: 'error',
            message:
              error instanceof Error
                ? error.message
                : 'Unable to fetch loyalty settings right now.',
          })
        }
      } finally {
        if (!abort) {
          setLoading(false)
        }
      }
    }

    fetchSettings()
    return () => {
      abort = true
    }
  }, [])

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!canEdit || !formState) return

    setSaving(true)
    setFeedback(null)

    try {
      const response = await fetch(`/api/proxy/ecommerce/loyalty-settings/${formState.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          base_multiplier: parseFloat(formState.base_multiplier),
          expiry_months: formState.expiry_months,
          evaluation_cycle_months: formState.evaluation_cycle_months,
          rules_effective_at: formattedEffectiveDate || null,
        }),
      })

      const payload: LoyaltySettingsResponse = await response.json().catch(() => ({
        success: false,
        message: 'Unable to parse response from server.',
      }))

      if (!response.ok || payload?.success === false) {
        throw new Error(payload?.message || 'Failed to update loyalty settings')
      }

      const updated = payload?.data?.current || payload?.data?.history?.[0]

      if (updated) {
        setFormState((prev) => ({
          ...(prev ?? updated),
          ...updated,
        }))
        setInitialState(updated)
        setHistory((prev) => {
          const filtered = prev.filter((entry) => entry.id !== updated.id || entry.updated_at !== updated.updated_at)
          return [updated, ...filtered].slice(0, 20)
        })
      }

      setFeedback({
        type: 'success',
        message: payload?.message || 'Loyalty settings updated successfully.',
      })
    } catch (error) {
      setFeedback({
        type: 'error',
        message:
          error instanceof Error
            ? error.message
            : 'Unable to update loyalty settings right now.',
      })
    } finally {
      setSaving(false)
    }
  }

  const handleReset = () => {
    if (!initialState) return
    setFormState(initialState)
    setFeedback(null)
  }

  const inputDisabled = !canEdit || saving

  return (
    <div className="space-y-6">
      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm">
        <div className="border-b border-slate-200 px-6 py-4 flex items-center justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-gray-500">Loyalty</p>
            <h3 className="text-xl font-semibold text-slate-900">Points Settings</h3>
            <p className="text-sm text-slate-500 mt-1">
              Configure how loyalty points accrue, expire, and when new rules take effect for customers.
            </p>
          </div>
          {formState?.updated_at && (
            <div className="text-right">
              <p className="text-[11px] uppercase tracking-[0.16em] text-slate-400">Last updated</p>
              <p className="text-sm font-medium text-slate-700">
                {new Date(formState.updated_at).toLocaleString()}
              </p>
            </div>
          )}
        </div>

        <form className="px-6 py-6 space-y-5" onSubmit={handleSubmit}>
          {feedback && (
            <div
              className={`rounded-lg border px-4 py-3 text-sm ${
                feedback.type === 'success'
                  ? 'border-green-200 bg-green-50 text-green-800'
                  : 'border-rose-200 bg-rose-50 text-rose-800'
              }`}
            >
              <div className="flex items-start">
                <i
                  className={`fa-solid ${
                    feedback.type === 'success' ? 'fa-circle-check' : 'fa-circle-exclamation'
                  } mr-2 mt-[2px]`}
                />
                <p>{feedback.message}</p>
              </div>
            </div>
          )}

          {loading || !formState ? (
            <div className="space-y-3">
              <div className="h-4 w-32 bg-slate-100 rounded animate-pulse" />
              <div className="h-11 w-full bg-slate-100 rounded-lg animate-pulse" />
              <div className="h-4 w-52 bg-slate-100 rounded animate-pulse" />
              <div className="h-11 w-full bg-slate-100 rounded-lg animate-pulse" />
              <div className="h-4 w-40 bg-slate-100 rounded animate-pulse" />
              <div className="h-11 w-full bg-slate-100 rounded-lg animate-pulse" />
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700" htmlFor="base_multiplier">
                  Base multiplier
                </label>
                <input
                  id="base_multiplier"
                  name="base_multiplier"
                  type="number"
                  step="0.01"
                  min="0"
                  value={formState.base_multiplier}
                  onChange={(event) =>
                    setFormState((prev) =>
                      prev
                        ? {
                            ...prev,
                            base_multiplier: event.target.value,
                          }
                        : prev
                    )
                  }
                  className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm shadow-sm focus:border-slate-400 focus:outline-none"
                  placeholder="e.g. 1.25"
                  disabled={inputDisabled}
                  required
                />
                <p className="text-xs text-slate-500">
                  Multiply every dollar spent by this factor to determine points earned.
                </p>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700" htmlFor="expiry_months">
                  Points expiry (months)
                </label>
                <input
                  id="expiry_months"
                  name="expiry_months"
                  type="number"
                  min="0"
                  value={formState.expiry_months}
                  onChange={(event) =>
                    setFormState((prev) =>
                      prev
                        ? {
                            ...prev,
                            expiry_months: Number(event.target.value),
                          }
                        : prev
                    )
                  }
                  className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm shadow-sm focus:border-slate-400 focus:outline-none"
                  placeholder="e.g. 12"
                  disabled={inputDisabled}
                  required
                />
                <p className="text-xs text-slate-500">
                  Set how long points remain valid after they are earned.
                </p>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700" htmlFor="evaluation_cycle_months">
                  Evaluation cycle (months)
                </label>
                <input
                  id="evaluation_cycle_months"
                  name="evaluation_cycle_months"
                  type="number"
                  min="1"
                  value={formState.evaluation_cycle_months}
                  onChange={(event) =>
                    setFormState((prev) =>
                      prev
                        ? {
                            ...prev,
                            evaluation_cycle_months: Number(event.target.value),
                          }
                        : prev
                    )
                  }
                  className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm shadow-sm focus:border-slate-400 focus:outline-none"
                  placeholder="e.g. 6"
                  disabled={inputDisabled}
                  required
                />
                <p className="text-xs text-slate-500">
                  Determine how often customer loyalty status is recalculated.
                </p>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700" htmlFor="rules_effective_at">
                  Rules effective date
                </label>
                <input
                  id="rules_effective_at"
                  name="rules_effective_at"
                  type="date"
                  value={formattedEffectiveDate}
                  onChange={(event) =>
                    setFormState((prev) =>
                      prev
                        ? {
                            ...prev,
                            rules_effective_at: event.target.value ? new Date(event.target.value).toISOString() : null,
                          }
                        : prev
                    )
                  }
                  className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm shadow-sm focus:border-slate-400 focus:outline-none"
                  placeholder="YYYY-MM-DD"
                  disabled={inputDisabled}
                />
                <p className="text-xs text-slate-500">
                  Choose when updated loyalty rules should start applying. Leave blank to apply immediately.
                </p>
              </div>
            </div>
          )}

          <div className="flex flex-wrap gap-3 pt-2">
            <button
              type="submit"
              className={`inline-flex items-center rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1 ${
                inputDisabled ? 'opacity-50 cursor-not-allowed' : ''
              }`}
              disabled={inputDisabled}
            >
              {saving ? (
                <>
                  <i className="fa-solid fa-spinner-third fa-spin mr-2" />
                  Saving...
                </>
              ) : (
                'Save settings'
              )}
            </button>
            <button
              type="button"
              className="inline-flex items-center rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-slate-300 focus:ring-offset-1"
              onClick={handleReset}
              disabled={saving || !initialState}
            >
              <i className="fa-solid fa-rotate-left mr-2" />
              Reset
            </button>
          </div>
        </form>
      </div>

      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm">
        <div className="border-b border-slate-200 px-6 py-4 flex items-center justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-gray-500">History</p>
            <h3 className="text-lg font-semibold text-slate-900">Recent versions</h3>
            <p className="text-sm text-slate-500 mt-1">
              Track how loyalty rules have changed over time.
            </p>
          </div>
        </div>

        <div className="px-6 py-4">
          {history.length === 0 ? (
            <p className="text-sm text-slate-500">No history available yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm text-left text-slate-700">
                <thead>
                  <tr className="border-b border-slate-200 text-slate-500 text-xs uppercase tracking-[0.12em]">
                    <th className="py-2 pr-4">Updated</th>
                    <th className="py-2 pr-4">Base multiplier</th>
                    <th className="py-2 pr-4">Expiry (months)</th>
                    <th className="py-2 pr-4">Evaluation (months)</th>
                    <th className="py-2 pr-4">Effective date</th>
                  </tr>
                </thead>
                <tbody>
                  {history.map((entry) => (
                    <tr key={`${entry.id}-${entry.updated_at}`} className="border-b border-slate-100 last:border-0">
                      <td className="py-3 pr-4 text-slate-600">
                        {entry.updated_at ? new Date(entry.updated_at).toLocaleString() : '—'}
                      </td>
                      <td className="py-3 pr-4 font-semibold text-slate-900">{entry.base_multiplier}</td>
                      <td className="py-3 pr-4">{entry.expiry_months}</td>
                      <td className="py-3 pr-4">{entry.evaluation_cycle_months}</td>
                      <td className="py-3 pr-4">
                        {entry.rules_effective_at
                          ? new Date(entry.rules_effective_at).toLocaleDateString()
                          : 'Immediate'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

