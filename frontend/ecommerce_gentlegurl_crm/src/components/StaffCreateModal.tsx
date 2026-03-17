'use client'

import { ChangeEvent, FormEvent, useRef, useState } from 'react'

import type { StaffRowData } from './staffUtils'
import { mapStaffApiItemToRow, type StaffApiItem } from './staffUtils'
import { useI18n } from '@/lib/i18n'
import { IMAGE_ACCEPT } from './mediaAccept'

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
  position: string
  description: string
  avatarFile: File | null
  commissionPercent: string
  serviceCommissionPercent: string
}

const initialFormState: FormState = {
  code: '',
  name: '',
  phone: '',
  email: '',
  password: '',
  position: '',
  description: '',
  avatarFile: null,
  commissionPercent: '0',
  serviceCommissionPercent: '0',
}

export default function StaffCreateModal({
  onClose,
  onSuccess,
}: StaffCreateModalProps) {
  const { t } = useI18n()
  const [form, setForm] = useState<FormState>({ ...initialFormState })
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [avatarPreview, setAvatarPreview] = useState<string | null>(null)
  const avatarInputRef = useRef<HTMLInputElement>(null)

  const handleChange = (
    event: ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>,
  ) => {
    const { name, value } = event.target
    setForm((prev) => ({ ...prev, [name]: value }))
  }

  const handleAvatarChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return
    setForm((prev) => ({ ...prev, avatarFile: file }))
    const reader = new FileReader()
    reader.onloadend = () => {
      setAvatarPreview(reader.result as string)
    }
    reader.readAsDataURL(file)
  }

  const handleAvatarClick = () => {
    avatarInputRef.current?.click()
  }

  const handleRemoveAvatar = () => {
    setForm((prev) => ({ ...prev, avatarFile: null }))
    setAvatarPreview(null)
    if (avatarInputRef.current) {
      avatarInputRef.current.value = ''
    }
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
      const serviceCommissionRate = Number(form.serviceCommissionPercent || 0) / 100
      const basePayload = {
        code: form.code.trim() || null,
        name: form.name.trim(),
        phone: form.phone.trim() || null,
        email: form.email.trim(),
        password: form.password.trim(),
        position: form.position.trim() || null,
        description: form.description.trim() || null,
        commission_rate: Number.isFinite(commissionRate) ? commissionRate : 0,
        service_commission_rate: Number.isFinite(serviceCommissionRate) ? serviceCommissionRate : 0,
        is_active: true,
      }

      const useMultipart = Boolean(form.avatarFile)
      const res = await fetch('/api/proxy/staffs', {
        method: 'POST',
        headers: useMultipart
          ? { Accept: 'application/json' }
          : {
              'Content-Type': 'application/json',
              Accept: 'application/json',
            },
        body: useMultipart
          ? (() => {
              const fd = new FormData()
              Object.entries(basePayload).forEach(([key, value]) => {
                if (value === null || value === undefined) return
                if (key === 'is_active') {
                  fd.append(key, value === true ? '1' : '0')
                  return
                }
                fd.append(key, String(value))
              })
              if (form.avatarFile) {
                fd.append('avatar', form.avatarFile)
              }
              return fd
            })()
          : JSON.stringify(basePayload),
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
            position: form.position.trim(),
            description: form.description.trim(),
            avatarPath: '',
            avatarUrl: '',
            loginUsername: '-',
            adminUserId: null,
            commissionRate: Number.isFinite(commissionRate) ? commissionRate : 0,
            serviceCommissionRate: Number.isFinite(serviceCommissionRate) ? serviceCommissionRate : 0,
            isActive: true,
            createdAt: new Date().toISOString(),
          }

      setForm({ ...initialFormState })
      setAvatarPreview(null)
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
      <div className="relative w-full max-w-4xl mx-auto bg-white rounded-lg shadow-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between border-b border-gray-300 px-5 py-4 sticky top-0 bg-white z-10">
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

        <form onSubmit={handleSubmit} className="p-5">
          <div className="flex flex-col gap-6 lg:flex-row">
            {/* Left Side - Avatar Upload */}
            <div className="space-y-4 w-full lg:w-1/2">
              <div>
                <h3 className="text-sm font-medium text-gray-700 mb-1">Avatar</h3>
                <div
                  onClick={handleAvatarClick}
                  className={`relative border-2 border-dashed rounded-lg p-4 cursor-pointer transition-colors ${
                    avatarPreview ? 'border-gray-300' : 'border-gray-300 hover:border-blue-400'
                  }`}
                >
                  <input
                    ref={avatarInputRef}
                    id="avatar"
                    name="avatar"
                    type="file"
                    accept={IMAGE_ACCEPT}
                    onChange={handleAvatarChange}
                    className="hidden"
                    disabled={submitting}
                  />
                  {avatarPreview ? (
                    <div className="relative group">
                      <img
                        src={avatarPreview}
                        alt="Avatar Preview"
                        className="w-full h-48 object-contain rounded"
                      />
                      <div className="absolute top-2 right-2 flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation()
                            handleAvatarClick()
                          }}
                          className="w-8 h-8 bg-blue-500/95 backdrop-blur-md text-white rounded-full flex items-center justify-center shadow-lg border border-blue-400/30 hover:bg-blue-600 hover:shadow-xl hover:scale-110 transition-all duration-200"
                          aria-label="Replace avatar"
                          disabled={submitting}
                        >
                          <i className="fa-solid fa-image text-xs" />
                        </button>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation()
                            handleRemoveAvatar()
                          }}
                          className="w-8 h-8 bg-red-500/95 backdrop-blur-md text-white rounded-full flex items-center justify-center shadow-lg border border-red-400/30 hover:bg-red-600 hover:shadow-xl hover:scale-110 transition-all duration-200"
                          aria-label="Delete avatar"
                          disabled={submitting}
                        >
                          <i className="fa-solid fa-trash-can text-xs" />
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center py-8">
                      <i className="fa-solid fa-cloud-arrow-up text-4xl text-gray-400 mb-2" />
                      <p className="text-sm text-gray-600">Click to upload</p>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Right Side - Form Fields */}
            <div className="space-y-4 w-full lg:w-1/2">
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
                    htmlFor="position"
                    className="block text-sm font-medium text-gray-700 mb-1"
                  >
                    Position
                  </label>
                  <input
                    id="position"
                    name="position"
                    type="text"
                    value={form.position}
                    onChange={handleChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-blue-500 focus:border-blue-500"
                    placeholder="Position"
                    disabled={submitting}
                  />
                </div>
                <div className="flex-1" />
              </div>

              <div>
                <label
                  htmlFor="description"
                  className="block text-sm font-medium text-gray-700 mb-1"
                >
                  Description
                </label>
                <textarea
                  id="description"
                  name="description"
                  value={form.description}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Description"
                  rows={3}
                  disabled={submitting}
                />
              </div>

              <div className="flex gap-4">
                <div className="flex-1">
                  <label
                    htmlFor="commissionPercent"
                    className="block text-sm font-medium text-gray-700 mb-1"
                  >
                    Product Commission Rate (%)
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
                    placeholder="Product Commission Rate (%)"
                    disabled={submitting}
                  />
                </div>
                <div className="flex-1">
                  <label
                    htmlFor="serviceCommissionPercent"
                    className="block text-sm font-medium text-gray-700 mb-1"
                  >
                    Service Commission Rate (%)
                  </label>
                  <input
                    id="serviceCommissionPercent"
                    name="serviceCommissionPercent"
                    type="number"
                    min="0"
                    max="100"
                    step="0.01"
                    value={form.serviceCommissionPercent}
                    onChange={handleChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-blue-500 focus:border-blue-500"
                    placeholder="Service Commission Rate (%)"
                    disabled={submitting}
                  />
                </div>
              </div>
            </div>
          </div>

          {error && (
            <div className="text-sm text-red-600 mt-4" role="alert">
              {error}
            </div>
          )}

          <div className="flex items-center justify-end gap-3 pt-4 mt-4 border-t border-gray-200">
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
