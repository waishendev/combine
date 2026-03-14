'use client'

import { ChangeEvent, FormEvent, useEffect, useState } from 'react'

import type { BlockRowData } from './BlockRow'
import { mapBlockApiItemToRow, type BlockApiItem, type StaffOption } from './blockUtils'
import { useI18n } from '@/lib/i18n'

interface BlockCreateModalProps {
  onClose: () => void
  onSuccess: (block: BlockRowData) => void
  defaultScope?: 'STORE' | 'STAFF'
}

interface FormState {
  scope: 'STORE' | 'STAFF'
  staff_id: string
  start_at: string
  end_at: string
  reason: string
}

const initialFormState: FormState = {
  scope: 'STORE',
  staff_id: '',
  start_at: '',
  end_at: '',
  reason: '',
}

export default function BlockCreateModal({
  onClose,
  onSuccess,
  defaultScope,
}: BlockCreateModalProps) {
  const { t } = useI18n()
  const [form, setForm] = useState<FormState>({ ...initialFormState, scope: defaultScope || 'STORE' })
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [staffs, setStaffs] = useState<StaffOption[]>([])

  useEffect(() => {
    const controller = new AbortController()
    const fetchStaffs = async () => {
      try {
        const res = await fetch('/api/proxy/staffs?per_page=200&is_active=true', {
          cache: 'no-store',
          signal: controller.signal,
        })
        if (!res.ok) return
        const payload = await res.json().catch(() => ({}))
        const data = payload?.data
        if (Array.isArray(data)) {
          setStaffs(data as StaffOption[])
        } else if (data?.data && Array.isArray(data.data)) {
          setStaffs(data.data as StaffOption[])
        }
      } catch {
        // Ignore
      }
    }
    fetchStaffs()
    return () => controller.abort()
  }, [])

  const handleChange = (event: ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = event.target
    setForm((prev) => ({ ...prev, [name]: value }))
  }

  const validate = (): string | null => {
    if (!form.start_at || !form.end_at) return 'Start and end datetime are required.'
    const start = new Date(form.start_at)
    const end = new Date(form.end_at)
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
      return 'Start and end datetime are invalid.'
    }
    if (start >= end) return 'End datetime must be after start datetime.'
    if (form.scope === 'STAFF' && !form.staff_id) return 'Staff is required for STAFF scope blocks.'
    return null
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const validationError = validate()
    if (validationError) {
      setError(validationError)
      return
    }

    setSubmitting(true)
    setError(null)

    try {
      const res = await fetch('/api/proxy/admin/booking/blocks', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({
          scope: form.scope,
          staff_id: form.scope === 'STAFF' ? Number(form.staff_id) : null,
          start_at: new Date(form.start_at).toISOString(),
          end_at: new Date(form.end_at).toISOString(),
          reason: form.reason.trim() || null,
        }),
      })

      const data = await res.json().catch(() => null)
      if (!res.ok) {
        let message = 'Failed to create block'
        if (data && typeof data === 'object' && 'message' in data && typeof data.message === 'string') {
          message = data.message
        }
        setError(message)
        return
      }

      const payload = data?.data as BlockApiItem | undefined
      const staffNameMap = new Map(staffs.map(s => [s.id, s.name]))
      const blockRow: BlockRowData = payload
        ? mapBlockApiItemToRow(payload, staffNameMap)
        : {
            id: 0,
            scope: form.scope,
            staff_id: form.scope === 'STAFF' ? Number(form.staff_id) : null,
            staff_name: form.scope === 'STAFF' ? (staffs.find(s => s.id === Number(form.staff_id))?.name || null) : null,
            start_at: form.start_at,
            end_at: form.end_at,
            reason: form.reason.trim() || null,
          }

      setForm({ ...initialFormState })
      onSuccess(blockRow)
    } catch (err) {
      console.error(err)
      setError('Failed to create block')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div
        className="absolute inset-0 bg-black/50"
        onClick={() => {
          if (!submitting) onClose()
        }}
      />
      <div className="relative w-full max-w-lg mx-auto bg-white rounded-lg shadow-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between border-b border-gray-300 px-5 py-4">
          <h2 className="text-lg font-semibold">Create Block</h2>
          <button
            onClick={() => {
              if (!submitting) onClose()
            }}
            className="text-gray-500 hover:text-gray-700 text-2xl leading-none"
            aria-label={t('common.close')}
            type="button"
          >
            <i className="fa-solid fa-xmark" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="px-5 py-4 space-y-4">
          <div>
            <label htmlFor="scope" className="block text-sm font-medium text-gray-700 mb-1">
              Scope <span className="text-red-500">*</span>
            </label>
            <select
              id="scope"
              name="scope"
              value={form.scope}
              onChange={handleChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-blue-500 focus:border-blue-500"
              disabled={submitting}
            >
              <option value="STORE">STORE</option>
              <option value="STAFF">STAFF</option>
            </select>
          </div>

          <div>
            <label htmlFor="staff_id" className="block text-sm font-medium text-gray-700 mb-1">
              Staff {form.scope === 'STAFF' && <span className="text-red-500">*</span>}
            </label>
            <select
              id="staff_id"
              name="staff_id"
              value={form.staff_id}
              onChange={handleChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-blue-500 focus:border-blue-500"
              disabled={submitting || form.scope !== 'STAFF'}
            >
              <option value="">Select staff</option>
              {staffs.map((staff) => (
                <option key={staff.id} value={staff.id}>
                  {staff.name}
                </option>
              ))}
            </select>
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <div>
              <label htmlFor="start_at" className="block text-sm font-medium text-gray-700 mb-1">
                Start At <span className="text-red-500">*</span>
              </label>
              <input
                id="start_at"
                name="start_at"
                type="datetime-local"
                value={form.start_at}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-blue-500 focus:border-blue-500"
                disabled={submitting}
              />
            </div>
            <div>
              <label htmlFor="end_at" className="block text-sm font-medium text-gray-700 mb-1">
                End At <span className="text-red-500">*</span>
              </label>
              <input
                id="end_at"
                name="end_at"
                type="datetime-local"
                value={form.end_at}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-blue-500 focus:border-blue-500"
                disabled={submitting}
              />
            </div>
          </div>

          <div>
            <label htmlFor="reason" className="block text-sm font-medium text-gray-700 mb-1">
              Reason
            </label>
            <textarea
              id="reason"
              name="reason"
              value={form.reason}
              onChange={handleChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-blue-500 focus:border-blue-500"
              placeholder="Reason (optional)"
              rows={3}
              disabled={submitting}
            />
          </div>

          {error && (
            <div className="text-sm text-red-600" role="alert">
              {error}
            </div>
          )}

          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              className="px-4 py-2 text-sm text-gray-700 border border-gray-300 rounded-md hover:bg-gray-100 disabled:opacity-50"
              onClick={() => {
                if (!submitting) onClose()
              }}
              disabled={submitting}
            >
              {t('common.cancel')}
            </button>
            <button
              type="submit"
              className="px-4 py-2 text-sm text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50"
              disabled={submitting}
            >
              {submitting ? t('common.creating') : t('common.create')}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
