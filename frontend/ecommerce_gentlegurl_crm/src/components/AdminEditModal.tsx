'use client'

import { ChangeEvent, FormEvent, useEffect, useState } from 'react'

import type { AdminRowData } from './AdminRow'
import { AdminRoleOption } from './AdminFilters'
import { mapAdminApiItemToRow, type AdminApiItem } from './adminUtils'
import { useI18n } from '@/lib/i18n'

interface AdminEditModalProps {
  adminId: number
  onClose: () => void
  onSuccess: (admin: AdminRowData) => void
  roles: AdminRoleOption[]
  rolesLoading: boolean
}

interface FormState {
  username: string
  password: string
  email: string
  roleId: string
  isActive: 'true' | 'false'
}

const initialFormState: FormState = {
  username: '',
  password: '',
  email: '',
  roleId: '',
  isActive: 'true',
}

export default function AdminEditModal({
  adminId,
  onClose,
  onSuccess,
  roles,
  rolesLoading,
}: AdminEditModalProps) {
  const { t } = useI18n()
  const [form, setForm] = useState<FormState>({ ...initialFormState })
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loadedAdmin, setLoadedAdmin] = useState<AdminRowData | null>(null)

  useEffect(() => {
    const controller = new AbortController()

    const loadAdmin = async () => {
      setLoading(true)
      setError(null)
      try {
        const res = await fetch(`/api/proxy/admins/${adminId}`, {
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
          setError(t('admin.loadError'))
          return
        }

        const admin = data?.data as AdminApiItem | undefined
        if (!admin || typeof admin !== 'object') {
          setError(t('admin.loadError'))
          return
        }

        const mappedAdmin = mapAdminApiItemToRow(admin)
        setLoadedAdmin(mappedAdmin)

        const primaryRoleId =
          admin.role?.id ??
          (Array.isArray(admin.roles) && admin.roles[0]?.id != null
            ? admin.roles[0].id
            : null)

        setForm({
          username: typeof admin.username === 'string' ? admin.username : '',
          password: '',
          email: typeof admin.email === 'string' ? admin.email : '',
          roleId: primaryRoleId != null ? String(primaryRoleId) : '',
          isActive:
            admin.is_active === true || admin.is_active === 'true' || admin.is_active === 1
              ? 'true'
              : 'false',
        })
      } catch (err) {
        if (!(err instanceof DOMException && err.name === 'AbortError')) {
          setError(t('admin.loadError'))
        }
      } finally {
        setLoading(false)
      }
    }

    loadAdmin().catch(() => {
      setLoading(false)
      setError(t('admin.loadError'))
    })

    return () => controller.abort()
  }, [adminId, t])

  const handleChange = (
    event: ChangeEvent<HTMLInputElement | HTMLSelectElement>,
  ) => {
    const { name, value } = event.target
    setForm((prev) => ({ ...prev, [name]: value }))
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    const trimmedUsername = form.username.trim()
    const trimmedEmail = form.email.trim()
    const roleIdNumber = Number(form.roleId)

    if (!trimmedUsername || !trimmedEmail || !roleIdNumber) {
      setError(t('common.allFieldsRequired'))
      return
    }

    setSubmitting(true)
    setError(null)

    try {
      const payload: Record<string, unknown> = {
        username: trimmedUsername,
        email: trimmedEmail,
        role_ids: [roleIdNumber],
        is_active: form.isActive === 'true',
      }

      const trimmedPassword = form.password.trim()
      if (trimmedPassword) {
        payload.password = trimmedPassword
      }

      const res = await fetch(`/api/proxy/admins/${adminId}`, {
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
        setError(t('admin.updateError'))
        return
      }

      const payloadData =
        data && typeof data === 'object' && 'data' in data
          ? ((data as { data?: AdminApiItem | null }).data ?? null)
          : null

      const roleName =
        roles.find((role) => Number(role.id) === roleIdNumber)?.name ||
        loadedAdmin?.roleName ||
        '-'

      const adminRow: AdminRowData = payloadData
        ? mapAdminApiItemToRow(payloadData)
        : {
            id: loadedAdmin?.id ?? adminId,
            username: trimmedUsername,
            email: trimmedEmail,
            isActive: form.isActive === 'true',
            roleName,
            roleId: roleIdNumber || null,
            createdAt: loadedAdmin?.createdAt ?? '',
            updatedAt: new Date().toISOString(),
          }

      setLoadedAdmin(adminRow)
      onSuccess(adminRow)
    } catch (err) {
      console.error(err)
      setError(t('admin.updateError'))
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
          <h2 className="text-lg font-semibold">{t('admin.editTitle')}</h2>
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
          {loading ? (
            <div className="py-8 text-center text-sm text-gray-500">{t('common.loadingDetails')}</div>
          ) : (
            <>
              <div>
                <label
                  htmlFor="edit-username"
                  className="block text-sm font-medium text-gray-700 mb-1"
                >
                  {t('common.username')} <span className="text-red-500">*</span>
                </label>
                <input
                  id="edit-username"
                  name="username"
                  type="text"
                  value={form.username}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-blue-500 focus:border-blue-500"
                  placeholder={t('common.username')}
                  disabled={disableForm}
                />
              </div>

              <div>
                <label
                  htmlFor="edit-password"
                  className="block text-sm font-medium text-gray-700 mb-1"
                >
                  {t('common.passwordKeepBlank')} <span className="text-red-500">*</span>
                </label>
                <input
                  id="edit-password"
                  name="password"
                  type="password"
                  value={form.password}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-blue-500 focus:border-blue-500"
                  placeholder={t('common.newPasswordPlaceholder')}
                  disabled={disableForm}
                />
              </div>

              <div>
                <label
                  htmlFor="edit-email"
                  className="block text-sm font-medium text-gray-700 mb-1"
                >
                  {t('common.email')} <span className="text-red-500">*</span>
                </label>
                <input
                  id="edit-email"
                  name="email"
                  type="email"
                  value={form.email}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-blue-500 focus:border-blue-500"
                  placeholder={t('common.emailPlaceholder')}
                  disabled={disableForm}
                />
              </div>

              <div>
                <label
                  htmlFor="edit-roleId"
                  className="block text-sm font-medium text-gray-700 mb-1"
                >
                  {t('common.role')} <span className="text-red-500">*</span>
                </label>
                <select
                  id="edit-roleId"
                  name="roleId"
                  value={form.roleId}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-blue-500 focus:border-blue-500"
                  disabled={disableForm || rolesLoading}
                >
                  <option value="">{t('common.selectRole')}</option>
                  {roles.map((role) => (
                    <option key={String(role.id)} value={String(role.id ?? '')}>
                      {role.name ?? role.id}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label
                  htmlFor="edit-isActive"
                  className="block text-sm font-medium text-gray-700 mb-1"
                >
                  {t('common.status')} <span className="text-red-500">*</span>
                </label>
                <select
                  id="edit-isActive"
                  name="isActive"
                  value={form.isActive}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-blue-500 focus:border-blue-500"
                  disabled={disableForm}
                >
                  <option value="true">{t('common.active')}</option>
                  <option value="false">{t('common.inactive')}</option>
                </select>
              </div>
            </>
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
              {submitting ? t('common.saving') : t('admin.saveChanges')}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
