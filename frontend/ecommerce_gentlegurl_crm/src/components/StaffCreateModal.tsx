'use client'

import { ChangeEvent, FormEvent, useState } from 'react'

import type { StaffRowData } from './staffUtils'
import { mapStaffApiItemToRow, type StaffApiItem } from './staffUtils'
import { useI18n } from '@/lib/i18n'

interface StaffCreateModalProps {
  onClose: () => void
  onSuccess: (staff: StaffRowData) => void
}

interface FormState {
  code: string
  name: string
  phone: string
  email: string
  password: string
  username: string
  commissionPercent: string
}

const initialFormState: FormState = {
  code: '',
  name: '',
  phone: '',
  email: '',
  password: '',
  username: '',
  commissionPercent: '0',
}

export default function StaffCreateModal({
  onClose,
  onSuccess,
}: StaffCreateModalProps) {
  const { t } = useI18n()
  const [form, setForm] = useState<FormState>({ ...initialFormState })
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleChange = (
    event: ChangeEvent<HTMLInputElement | HTMLSelectElement>,
  ) => {
    const { name, value } = event.target
    setForm((prev) => ({ ...prev, [name]: value }))
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    if (!form.name.trim() || form.name.trim().length < 2) {
      setError('Name is required and minimum 2 characters.')
      return
    }
    if (!form.email.trim()) {
      setError('Email is required.')
      return
    }
    if (!form.password.trim()) {
      setError('Password is required.')
      return
    }

    setSubmitting(true)
    setError(null)

    try {
      const commissionRate = Number(form.commissionPercent || 0) / 100
      const payload = {
        code: form.code.trim() || null,
        name: form.name.trim(),
        phone: form.phone.trim() || null,
        email: form.email.trim(),
        password: form.password.trim(),
        username: form.username.trim() || null,
        commission_rate: Number.isFinite(commissionRate) ? commissionRate : 0,
        is_active: true,
      }

      const res = await fetch('/api/proxy/staffs', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify(payload),
      })

      const data = await res.json().catch(() => null)

      if (!res.ok) {
        let message = 'Failed to create staff.'
        if (data && typeof data === 'object') {
          if (typeof (data as { message?: unknown }).message === 'string') {
            message = (data as { message: string }).message
          } else if (data && 'errors' in data) {
            const errors = (data as { errors?: unknown }).errors
            if (errors && typeof errors === 'object') {
              const firstKey = Object.keys(errors)[0]
              const firstValue = firstKey ? (errors as Record<string, unknown>)[firstKey] : null
              if (Array.isArray(firstValue) && typeof firstValue[0] === 'string') {
                message = firstValue[0]
              } else if (typeof firstValue === 'string') {
                message = firstValue
              }
            }
          }
        }
        setError(message)
        return
      }

      const payloadData =
        data && typeof data === 'object' && 'data' in data
          ? ((data as { data?: StaffApiItem | null }).data ?? null)
          : null

      const staffRow: StaffRowData = payloadData
        ? mapStaffApiItemToRow(payloadData)
        : {
            id: 0,
            code: form.code.trim() || '-',
            name: form.name.trim(),
            phone: form.phone.trim() || '-',
            email: form.email.trim(),
            loginUsername: form.username.trim() || '-',
            adminUserId: null,
            commissionRate: Number.isFinite(commissionRate) ? commissionRate : 0,
            isActive: true,
            createdAt: new Date().toISOString(),
          }

      setForm({ ...initialFormState })
      onSuccess(staffRow)
    } catch (err) {
      console.error(err)
      setError('Failed to create staff.')
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
      <div className="relative w-full max-w-lg mx-auto bg-white rounded-lg shadow-lg">
        <div className="flex items-center justify-between border-b border-gray-300 px-5 py-4">
          <h2 className="text-lg font-semibold">Create Staff</h2>
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

        <form onSubmit={handleSubmit} className="px-5 py-4">
          <div className="space-y-4">
            <div className="flex gap-4">
              <div className="flex-1">
                <label
                  htmlFor="name"
                  className="block text-sm font-medium text-gray-700 mb-1"
                >
                  Name <span className="text-red-500">*</span>
                </label>
                <input
                  id="name"
                  name="name"
                  type="text"
                  value={form.name}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Name *"
                  disabled={submitting}
                />
              </div>

              <div className="flex-1">
                <label
                  htmlFor="email"
                  className="block text-sm font-medium text-gray-700 mb-1"
                >
                  Email <span className="text-red-500">*</span>
                </label>
                <input
                  id="email"
                  name="email"
                  type="email"
                  value={form.email}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Email *"
                  disabled={submitting}
                />
              </div>
            </div>

            <div className="flex gap-4">
              <div className="flex-1">
                <label
                  htmlFor="password"
                  className="block text-sm font-medium text-gray-700 mb-1"
                >
                  Password <span className="text-red-500">*</span>
                </label>
                <input
                  id="password"
                  name="password"
                  type="password"
                  value={form.password}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Password *"
                  disabled={submitting}
                />
              </div>

              <div className="flex-1">
                <label
                  htmlFor="phone"
                  className="block text-sm font-medium text-gray-700 mb-1"
                >
                  Phone
                </label>
                <input
                  id="phone"
                  name="phone"
                  type="text"
                  value={form.phone}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Phone"
                  disabled={submitting}
                />
              </div>
            </div>

            <div className="flex gap-4">
              <div className="flex-1">
                <label
                  htmlFor="commissionPercent"
                  className="block text-sm font-medium text-gray-700 mb-1"
                >
                  Commission Rate (%)
                </label>
                <input
                  id="commissionPercent"
                  name="commissionPercent"
                  type="number"
                  min="0"
                  max="100"
                  step="0.01"
                  value={form.commissionPercent}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Commission Rate (%)"
                  disabled={submitting}
                />
              </div>
              <div className="flex-1"></div>
            </div>
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
              {submitting ? 'Creating...' : t('common.create')}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
