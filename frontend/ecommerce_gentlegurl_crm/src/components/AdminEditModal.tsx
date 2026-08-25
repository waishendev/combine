'use client'

import { ChangeEvent, FormEvent, useEffect, useMemo, useState } from 'react'

import type { AdminRowData } from './AdminRow'
import { AdminRoleOption } from './AdminFilters'
import { mapAdminApiItemToRow, type AdminApiItem } from './adminUtils'
import CrmFormModalShell from './CrmFormModalShell'
import { useI18n } from '@/lib/i18n'
import BranchAccessChecklist, { type BranchAccessOption } from './BranchAccessChecklist'
import { branchIdsFromAssignments } from './branch-access-selection'

type BranchOption = BranchAccessOption

interface AdminEditModalProps {
  adminId: number
  onClose: () => void
  onReady?: () => void
  onSuccess: (admin: AdminRowData) => void
  roles: AdminRoleOption[]
  rolesLoading: boolean
  canManageSystemRoles: boolean
  branchOptions: BranchOption[]
  canAssignBranches: boolean
}

interface FormState {
  username: string
  password: string
  email: string
  roleId: string
  isActive: 'true' | 'false'
  storeLocationIds: string[]
}

const initialFormState: FormState = {
  username: '',
  password: '',
  email: '',
  roleId: '',
  isActive: 'true',
  storeLocationIds: [],
}

export default function AdminEditModal({
  adminId,
  onClose,
  onReady,
  onSuccess,
  roles,
  rolesLoading,
  canManageSystemRoles,
  branchOptions,
  canAssignBranches,
}: AdminEditModalProps) {
  const { t } = useI18n()
  const [form, setForm] = useState<FormState>({ ...initialFormState })
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loadedAdmin, setLoadedAdmin] = useState<AdminRowData | null>(null)
  const [currentRole, setCurrentRole] = useState<AdminRoleOption | null>(null)

  useEffect(() => {
    const controller = new AbortController()

    const loadAdmin = async () => {
      setLoading(true)
      setError(null)
      try {
        const res = await fetch(`/api/proxy/admins/${adminId}/query`, {
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

        const primaryRole =
          admin.role ??
          (Array.isArray(admin.roles) && admin.roles.length > 0
            ? admin.roles[0]
            : null)

        if (primaryRole) {
          setCurrentRole({
            id: primaryRole.id ?? null,
            name: primaryRole.name ?? null,
            isSystem:
              primaryRole.is_system === true ||
              primaryRole.is_system === 1 ||
              primaryRole.is_system === '1' ||
              primaryRole.is_system === 'true',
            isDefault: !(
              primaryRole.is_default === false ||
              primaryRole.is_default === 0 ||
              primaryRole.is_default === '0' ||
              primaryRole.is_default === 'false'
            ),
          })
        } else {
          setCurrentRole(null)
        }

        setForm({
          username: typeof admin.username === 'string' ? admin.username : '',
          password: '',
          email: typeof admin.email === 'string' ? admin.email : '',
          roleId: primaryRoleId != null ? String(primaryRoleId) : '',
          isActive: mappedAdmin.isActive ? 'true' : 'false',
          storeLocationIds: branchIdsFromAssignments(admin.store_locations),
        })
      } catch (err) {
        if (!(err instanceof DOMException && err.name === 'AbortError')) {
          setError(t('admin.loadError'))
        }
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false)
          onReady?.()
        }
      }
    }

    loadAdmin().catch(() => {
      if (controller.signal.aborted) return
      setLoading(false)
      setError(t('admin.loadError'))
      onReady?.()
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

    if (!trimmedEmail || !roleIdNumber) {
      setError(t('common.allFieldsRequired'))
      return
    }

    setSubmitting(true)
    setError(null)

    try {
      const payload: Record<string, unknown> = {
        name: trimmedUsername || trimmedEmail.split('@')[0],
        username: trimmedUsername || null,
        email: trimmedEmail,
        is_active: form.isActive === 'true',
        ...(canAssignBranches ? { store_location_ids: form.storeLocationIds.map(Number) } : {}),
      }

      if (!roleReadOnly) {
        payload.role_ids = [roleIdNumber]
      }

      const trimmedPassword = form.password.trim()
      if (trimmedPassword) {
        payload.password = trimmedPassword
      }

      const res = await fetch(`/api/proxy/admins/${adminId}/query`, {
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
            username: trimmedUsername || '',
            email: trimmedEmail,
            isActive: form.isActive === 'true',
            roleName,
            roleId: roleIdNumber || null,
            createdAt: loadedAdmin?.createdAt ?? '',
            updatedAt: new Date().toISOString(),
            storeLocations: branchOptions.filter((location) => form.storeLocationIds.includes(String(location.id))).map((location) => ({ id: location.id, name: location.name, code: location.code })),
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

  const disableForm = submitting
  const roleReadOnly =
    !canManageSystemRoles &&
    !!currentRole &&
    (currentRole.isSystem === true || currentRole.isDefault === false)

  const roleOptions = useMemo(() => {
    if (!currentRole?.id) {
      return roles
    }

    const hasCurrentRole = roles.some(
      (role) => String(role.id ?? '') === String(currentRole.id ?? ''),
    )

    return hasCurrentRole ? roles : [currentRole, ...roles]
  }, [currentRole, roles])

  if (loading) {
    return null
  }

  return (
    <CrmFormModalShell
      title={t('admin.editTitle')}
      onClose={onClose}
      closeDisabled={submitting}
      closeLabel={t('common.close')}
      footer={
        <>
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
            form="admin-edit-form"
            className="px-4 py-2 text-sm text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50"
            disabled={disableForm}
          >
            {submitting ? t('common.saving') : t('admin.saveChanges')}
          </button>
        </>
      }
    >
      <form id="admin-edit-form" onSubmit={handleSubmit} className="space-y-4 px-5 py-4">
              <div>
                <label
                  htmlFor="edit-password"
                  className="block text-sm font-medium text-gray-700 mb-1"
                >
                  {t('common.passwordKeepBlank')}
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
                  disabled={disableForm || rolesLoading || roleReadOnly}
                  title={roleReadOnly ? 'You cannot change this internal role.' : undefined}
                >
                  <option value="">{t('common.selectRole')}</option>
                  {roleOptions.map((role) => (
                    <option key={String(role.id)} value={String(role.id ?? '')}>
                      {role.name ?? role.id}
                    </option>
                  ))}
                </select>
                {roleReadOnly && (
                  <p className="mt-1 text-xs text-amber-700">
                    This role is internal and can only be changed by users with admins.manage-system.
                  </p>
                )}
              </div>

              {canAssignBranches && (
                <div>
                  <label htmlFor="edit-storeLocationIds" className="block text-sm font-medium text-gray-700 mb-1">
                    Branch access
                  </label>
                  <BranchAccessChecklist
                    id="edit-storeLocationIds"
                    options={branchOptions}
                    selectedIds={form.storeLocationIds}
                    onChange={(storeLocationIds) => setForm((previous) => ({ ...previous, storeLocationIds }))}
                    disabled={disableForm}
                  />
                  <p className="mt-1 text-xs text-gray-500">Select every Branch this Admin may access. Platform Super Admin users do not require branch rows.</p>
                </div>
              )}

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

          {error && (
            <div className="text-sm text-red-600" role="alert">
              {error}
            </div>
          )}
        </form>
    </CrmFormModalShell>
  )
}
