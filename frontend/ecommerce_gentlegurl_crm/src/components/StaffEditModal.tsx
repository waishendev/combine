'use client'

import { ChangeEvent, FormEvent, useEffect, useState } from 'react'

import type { StaffRowData } from './staffUtils'
import { mapStaffApiItemToRow, type StaffApiItem } from './staffUtils'
import { useI18n } from '@/lib/i18n'

interface StaffEditModalProps {
  staffId: number
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
  serviceCommissionPercent: string
  isActive: 'true' | 'false'
}

const initialFormState: FormState = {
  code: '',
  name: '',
  phone: '',
  email: '',
  password: '',
  username: '',
  commissionPercent: '0',
  serviceCommissionPercent: '0',
  isActive: 'true',
}

export default function StaffEditModal({
  staffId,
  onClose,
  onSuccess,
}: StaffEditModalProps) {
  const { t } = useI18n()
  const [form, setForm] = useState<FormState>({ ...initialFormState })
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loadedStaff, setLoadedStaff] = useState<StaffRowData | null>(null)

  useEffect(() => {
    const controller = new AbortController()

    const loadStaff = async () => {
      setLoading(true)
      setError(null)
      try {
        const res = await fetch(`/api/proxy/staffs/${staffId}`, {
          cache: 'no-store',
          signal: controller.signal,
          headers: {
            Accept: 'application/json',
            'Accept-Language': 'en',
          },
        })

        const data = await res.json().catch(() => null)
        if (data && typeof data === 'object') {
          if (data?.success === false && data?.message === 'Unauthorized') {
            window.location.replace('/dashboard')
            return
          }
        }

        if (!res.ok) {
          if (data && typeof data === 'object' && 'message' in data) {
            const message = (data as { message?: unknown }).message
            if (typeof message === 'string') {
              setError(message)
              return
            }
          }
          setError('Failed to load staff.')
          return
        }

        const staff = data?.data as StaffApiItem | undefined
        if (!staff || typeof staff !== 'object') {
          setError('Failed to load staff.')
          return
        }

        const mappedStaff = mapStaffApiItemToRow(staff)
        setLoadedStaff(mappedStaff)

        setForm({
          code: mappedStaff.code === '-' ? '' : mappedStaff.code,
          name: mappedStaff.name === '-' ? '' : mappedStaff.name,
          phone: mappedStaff.phone === '-' ? '' : mappedStaff.phone,
          email: mappedStaff.email === '-' ? '' : mappedStaff.email,
          password: '',
          username: mappedStaff.loginUsername === '-' ? '' : mappedStaff.loginUsername,
          commissionPercent: String((mappedStaff.commissionRate * 100).toFixed(2)).replace(/\.00$/, ''),
          serviceCommissionPercent: String((mappedStaff.serviceCommissionRate * 100).toFixed(2)).replace(/\.00$/, ''),
          isActive: mappedStaff.isActive ? 'true' : 'false',
        })
      } catch (err) {
        if (!(err instanceof DOMException && err.name === 'AbortError')) {
          setError('Failed to load staff.')
        }
      } finally {
        setLoading(false)
      }
    }

    loadStaff().catch(() => {
      setLoading(false)
      setError('Failed to load staff.')
    })

    return () => controller.abort()
  }, [staffId])

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

    setSubmitting(true)
    setError(null)

    try {
      const commissionRate = Number(form.commissionPercent || 0) / 100
      const serviceCommissionRate = Number(form.serviceCommissionPercent || 0) / 100
      const payload: Record<string, unknown> = {
        code: form.code.trim() || null,
        name: form.name.trim(),
        phone: form.phone.trim() || null,
        email: form.email.trim(),
        username: form.username.trim() || null,
        commission_rate: Number.isFinite(commissionRate) ? commissionRate : 0,
        service_commission_rate: Number.isFinite(serviceCommissionRate) ? serviceCommissionRate : 0,
        is_active: form.isActive === 'true',
      }

      const trimmedPassword = form.password.trim()
      if (trimmedPassword) {
        payload.password = trimmedPassword
      }

      const res = await fetch(`/api/proxy/staffs/${staffId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          'Accept-Language': 'en',
        },
        body: JSON.stringify(payload),
      })

      const data = await res.json().catch(() => null)
      if (data && typeof data === 'object') {
        if (data?.success === false && data?.message === 'Unauthorized') {
          window.location.replace('/dashboard')
          return
        }
      }

      if (!res.ok) {
        if (data && typeof data === 'object') {
          if ('message' in data && typeof data.message === 'string') {
            setError(data.message)
            return
          }
          if ('errors' in data && typeof data.errors === 'object') {
            const errors = data.errors as Record<string, unknown>
            const firstKey = Object.keys(errors)[0]
            if (firstKey) {
              const firstValue = errors[firstKey]
              if (Array.isArray(firstValue) && typeof firstValue[0] === 'string') {
                setError(firstValue[0])
                return
              }
              if (typeof firstValue === 'string') {
                setError(firstValue)
                return
              }
            }
          }
        }
        setError('Failed to update staff.')
        return
      }

      const payloadData =
        data && typeof data === 'object' && 'data' in data
          ? ((data as { data?: StaffApiItem | null }).data ?? null)
          : null

      const staffRow: StaffRowData = payloadData
        ? mapStaffApiItemToRow(payloadData)
        : {
            id: loadedStaff?.id ?? staffId,
            code: form.code.trim() || '-',
            name: form.name.trim(),
            phone: form.phone.trim() || '-',
            email: form.email.trim(),
            loginUsername: form.username.trim() || '-',
            adminUserId: loadedStaff?.adminUserId ?? null,
            commissionRate: Number.isFinite(commissionRate) ? commissionRate : 0,
            serviceCommissionRate: Number.isFinite(serviceCommissionRate) ? serviceCommissionRate : 0,
            isActive: form.isActive === 'true',
            createdAt: loadedStaff?.createdAt ?? '',
          }

      setLoadedStaff(staffRow)
      onSuccess(staffRow)
    } catch (err) {
      console.error(err)
      setError('Failed to update staff.')
    } finally {
      setSubmitting(false)
    }
  }

  const disableForm = loading || submitting

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
          <h2 className="text-lg font-semibold">Edit Staff</h2>
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
          {loading ? (
            <div className="py-8 text-center text-sm text-gray-500">{t('common.loadingDetails')}</div>
          ) : (
            <div className="space-y-4">
              <div className="flex gap-4">
                <div className="flex-1">
                  <label
                    htmlFor="edit-name"
                    className="block text-sm font-medium text-gray-700 mb-1"
                  >
                    Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    id="edit-name"
                    name="name"
                    type="text"
                    value={form.name}
                    onChange={handleChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-blue-500 focus:border-blue-500"
                    placeholder="Name *"
                    disabled={disableForm}
                  />
                </div>

                <div className="flex-1">
                  <label
                    htmlFor="edit-email"
                    className="block text-sm font-medium text-gray-700 mb-1"
                  >
                    Email <span className="text-red-500">*</span>
                  </label>
                  <input
                    id="edit-email"
                    name="email"
                    type="email"
                    value={form.email}
                    onChange={handleChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-blue-500 focus:border-blue-500"
                    placeholder="Email *"
                    disabled={disableForm}
                  />
                </div>
              </div>

              <div className="flex gap-4">
                <div className="flex-1">
                  <label
                    htmlFor="edit-password"
                    className="block text-sm font-medium text-gray-700 mb-1"
                  >
                    Password (leave blank to keep)
                  </label>
                  <input
                    id="edit-password"
                    name="password"
                    type="password"
                    value={form.password}
                    onChange={handleChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-blue-500 focus:border-blue-500"
                    placeholder="Password (leave blank to keep)"
                    disabled={disableForm}
                  />
                </div>

                <div className="flex-1">
                  <label
                    htmlFor="edit-phone"
                    className="block text-sm font-medium text-gray-700 mb-1"
                  >
                    Phone
                  </label>
                  <input
                    id="edit-phone"
                    name="phone"
                    type="text"
                    value={form.phone}
                    onChange={handleChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-blue-500 focus:border-blue-500"
                    placeholder="Phone"
                    disabled={disableForm}
                  />
                </div>
              </div>

              <div className="flex gap-4">
                <div className="flex-1">
                  <label
                    htmlFor="edit-commissionPercent"
                    className="block text-sm font-medium text-gray-700 mb-1"
                  >
                    Product Commission Rate (%)
                  </label>
                  <input
                    id="edit-commissionPercent"
                    name="commissionPercent"
                    type="number"
                    min="0"
                    max="100"
                    step="0.01"
                    value={form.commissionPercent}
                    onChange={handleChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-blue-500 focus:border-blue-500"
                    placeholder="Product Commission Rate (%)"
                    disabled={disableForm}
                  />
                </div>

                <div className="flex-1">
                  <label
                    htmlFor="edit-serviceCommissionPercent"
                    className="block text-sm font-medium text-gray-700 mb-1"
                  >
                    Service Commission Rate (%)
                  </label>
                  <input
                    id="edit-serviceCommissionPercent"
                    name="serviceCommissionPercent"
                    type="number"
                    min="0"
                    max="100"
                    step="0.01"
                    value={form.serviceCommissionPercent}
                    onChange={handleChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-blue-500 focus:border-blue-500"
                    placeholder="Service Commission Rate (%)"
                    disabled={disableForm}
                  />
                </div>
              </div>
              <div className="flex gap-4">
                <div className="flex-1">
                  <label
                    htmlFor="edit-isActive"
                    className="block text-sm font-medium text-gray-700 mb-1"
                  >
                    Status
                  </label>
                  <select
                    id="edit-isActive"
                    name="isActive"
                    value={form.isActive}
                    onChange={handleChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-blue-500 focus:border-blue-500"
                    disabled={disableForm}
                  >
                    <option value="true">Active</option>
                    <option value="false">Inactive</option>
                  </select>
                </div>
                <div className="flex-1" />
              </div>
            </div>
          )}

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
              disabled={disableForm}
            >
              {submitting ? t('common.saving') : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
