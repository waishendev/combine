'use client'

import { ChangeEvent, FormEvent, useEffect, useRef, useState } from 'react'

import type { StaffRowData } from './staffUtils'
import { mapStaffApiItemToRow, type StaffApiItem } from './staffUtils'
import { useI18n } from '@/lib/i18n'
import { IMAGE_ACCEPT } from './mediaAccept'

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
  position: string
  description: string
  avatarFile: File | null
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
  position: '',
  description: '',
  avatarFile: null,
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

  const [avatarPreview, setAvatarPreview] = useState<string | null>(null)
  const avatarInputRef = useRef<HTMLInputElement>(null)

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
        setAvatarPreview(mappedStaff.avatarUrl || null)

        setForm({
          code: mappedStaff.code === '-' ? '' : mappedStaff.code,
          name: mappedStaff.name === '-' ? '' : mappedStaff.name,
          phone: mappedStaff.phone === '-' ? '' : mappedStaff.phone,
          email: mappedStaff.email === '-' ? '' : mappedStaff.email,
          password: '',
          position: mappedStaff.position ?? '',
          description: mappedStaff.description ?? '',
          avatarFile: null,
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
    setAvatarPreview(loadedStaff?.avatarUrl || null)
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

    setSubmitting(true)
    setError(null)

    try {
      const commissionRate = Number(form.commissionPercent || 0) / 100
      const serviceCommissionRate = Number(form.serviceCommissionPercent || 0) / 100
      const fd = new FormData()
      fd.append('_method', 'PUT')
      fd.append('code', form.code.trim())
      fd.append('name', form.name.trim())
      fd.append('phone', form.phone.trim())
      fd.append('email', form.email.trim())
      fd.append('position', form.position.trim())
      fd.append('description', form.description.trim())
      fd.append(
        'commission_rate',
        String(Number.isFinite(commissionRate) ? commissionRate : 0),
      )
      fd.append(
        'service_commission_rate',
        String(Number.isFinite(serviceCommissionRate) ? serviceCommissionRate : 0),
      )
      fd.append('is_active', form.isActive === 'true' ? '1' : '0')

      const trimmedPassword = form.password.trim()
      if (trimmedPassword) {
        fd.append('password', trimmedPassword)
      }

      if (form.avatarFile) {
        fd.append('avatar', form.avatarFile)
      }

      const res = await fetch(`/api/proxy/staffs/${staffId}`, {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Accept-Language': 'en',
        },
        body: fd,
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
            position: form.position.trim(),
            description: form.description.trim(),
            avatarPath: loadedStaff?.avatarPath ?? '',
            avatarUrl: loadedStaff?.avatarUrl ?? '',
            loginUsername: loadedStaff?.loginUsername ?? '-',
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
      <div className="relative w-full max-w-4xl mx-auto bg-white rounded-lg shadow-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between border-b border-gray-300 px-5 py-4 sticky top-0 bg-white z-10">
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

        <form onSubmit={handleSubmit} className="p-5">
          {loading ? (
            <div className="py-8 text-center text-sm text-gray-500">{t('common.loadingDetails')}</div>
          ) : (
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
                      id="edit-avatar"
                      name="avatar"
                      type="file"
                      accept={IMAGE_ACCEPT}
                      onChange={handleAvatarChange}
                      className="hidden"
                      disabled={disableForm}
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
                            disabled={disableForm}
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
                            disabled={disableForm}
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
                      htmlFor="edit-position"
                      className="block text-sm font-medium text-gray-700 mb-1"
                    >
                      Position
                    </label>
                    <input
                      id="edit-position"
                      name="position"
                      type="text"
                      value={form.position}
                      onChange={handleChange}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-blue-500 focus:border-blue-500"
                      placeholder="Position"
                      disabled={disableForm}
                    />
                  </div>
                  <div className="flex-1" />
                </div>

                <div>
                  <label
                    htmlFor="edit-description"
                    className="block text-sm font-medium text-gray-700 mb-1"
                  >
                    Description
                  </label>
                  <textarea
                    id="edit-description"
                    name="description"
                    value={form.description}
                    onChange={handleChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-blue-500 focus:border-blue-500"
                    placeholder="Description"
                    rows={3}
                    disabled={disableForm}
                  />
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
            </div>
          )}

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
