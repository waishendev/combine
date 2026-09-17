'use client'

import { ChangeEvent, FormEvent, useEffect, useMemo, useState } from 'react'

import type { AdminRowData } from './AdminRow'
import { AdminRoleOption } from './AdminFilters'
import {
  assignableAdminRoles,
  assignableRolesForBranch,
  collectSelectedBranchRoleIds,
  formatAdminRoleLabel,
  isOperationalStaffRole,
  mapAdminApiItemToRow,
  mapRoleApiToOption,
  roleIdsByBranchFromAdminRoles,
  type AdminApiItem,
} from './adminUtils'
import CrmFormModalShell from './CrmFormModalShell'
import { useI18n } from '@/lib/i18n'
import BranchAccessChecklist, { type BranchAccessOption } from './BranchAccessChecklist'
import { branchIdsFromAssignments } from './branch-access-selection'

type BranchOption = BranchAccessOption

interface AdminEditModalProps {
  adminId: number
  currentAdminId?: number | null
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
  isActive: 'true' | 'false'
  storeLocationIds: string[]
  roleByBranchId: Record<string, string>
  /** Legacy / platform Global Roles (store_location_id IS NULL). */
  globalRoleIds: string[]
}

const initialFormState: FormState = {
  username: '',
  password: '',
  email: '',
  isActive: 'true',
  storeLocationIds: [],
  roleByBranchId: {},
  globalRoleIds: [],
}

export default function AdminEditModal({
  adminId,
  currentAdminId = null,
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
  const isOwnAccount = currentAdminId != null && adminId === currentAdminId
  const showBranchAssignment = canAssignBranches && !isOwnAccount
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

        const assignedRoles = Array.isArray(admin.roles)
          ? admin.roles
          : admin.role
            ? [admin.role]
            : []

        const primaryRole = assignedRoles[0] ?? null
        if (primaryRole) {
          setCurrentRole(mapRoleApiToOption(primaryRole))
        } else {
          setCurrentRole(null)
        }

        const roleByBranchId = roleIdsByBranchFromAdminRoles(assignedRoles)
        const globalRoleIds = assignedRoles
          .filter((role) => {
            const owner = role.store_location_id ?? role.store_location?.id
            return role?.id != null && (owner == null || owner === '')
          })
          .map((role) => String(role.id))

        setForm({
          username: typeof admin.username === 'string' ? admin.username : '',
          password: '',
          email: typeof admin.email === 'string' ? admin.email : '',
          isActive: mappedAdmin.isActive ? 'true' : 'false',
          storeLocationIds: branchIdsFromAssignments(admin.store_locations),
          roleByBranchId,
          globalRoleIds,
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

  const handleBranchAccessChange = (storeLocationIds: string[]) => {
    setForm((prev) => {
      const roleByBranchId = { ...prev.roleByBranchId }
      Object.keys(roleByBranchId).forEach((branchId) => {
        if (!storeLocationIds.includes(branchId)) {
          delete roleByBranchId[branchId]
        }
      })
      return { ...prev, storeLocationIds, roleByBranchId }
    })
  }

  const roleReadOnly =
    !canManageSystemRoles &&
    !!currentRole &&
    (currentRole.isSystem === true || currentRole.isDefault === false)

  const selectedBranches = useMemo(
    () => branchOptions.filter((branch) => form.storeLocationIds.includes(String(branch.id))),
    [branchOptions, form.storeLocationIds],
  )

  const legacyRoleOptions = useMemo(
    () => assignableAdminRoles(roles, currentRole),
    [currentRole, roles],
  )
  const currentRoleIsStaff = isOperationalStaffRole(currentRole)

  const resolveRoleIdsForSubmit = (): number[] => {
    if (showBranchAssignment) {
      const branchRoleIds = collectSelectedBranchRoleIds(form.storeLocationIds, form.roleByBranchId)
      const globalIds = form.globalRoleIds
        .map(Number)
        .filter((id) => Number.isFinite(id) && id > 0)
      return [...new Set([...branchRoleIds, ...globalIds])]
    }

    const fallback = form.globalRoleIds[0] ?? Object.values(form.roleByBranchId)[0] ?? ''
    const id = Number(fallback)
    return Number.isFinite(id) && id > 0 ? [id] : []
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    const trimmedUsername = form.username.trim()
    const trimmedEmail = form.email.trim()
    const roleIds = resolveRoleIdsForSubmit()

    if (!trimmedEmail) {
      setError(t('common.allFieldsRequired'))
      return
    }

    if (showBranchAssignment && form.storeLocationIds.length === 0 && form.globalRoleIds.length === 0) {
      setError('Select at least one Branch, or keep a Global Role assignment.')
      return
    }

    if (
      showBranchAssignment &&
      form.storeLocationIds.length > 0 &&
      collectSelectedBranchRoleIds(form.storeLocationIds, form.roleByBranchId).length !==
        form.storeLocationIds.length
    ) {
      setError('Select a Role for each selected Branch. A Branch Role only applies to its owning Branch.')
      return
    }

    if (!roleReadOnly && roleIds.length === 0) {
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
        ...(showBranchAssignment ? { store_location_ids: form.storeLocationIds.map(Number) } : {}),
      }

      // Always send role_ids when Branch access changes so removed Branches drop their Roles.
      if (!roleReadOnly || showBranchAssignment) {
        payload.role_ids = roleIds
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
        roleIds
          .map((id) => roles.find((role) => Number(role.id) === id)?.name)
          .filter(Boolean)
          .join(', ') ||
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
            roleId: roleIds[0] ?? null,
            staffId: loadedAdmin?.staffId ?? null,
            isStaffLogin: loadedAdmin?.isStaffLogin ?? false,
            createdAt: loadedAdmin?.createdAt ?? '',
            updatedAt: new Date().toISOString(),
            storeLocations: branchOptions
              .filter((location) => form.storeLocationIds.includes(String(location.id)))
              .map((location) => ({ id: location.id, name: location.name, code: location.code })),
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

              {showBranchAssignment && (
                <div>
                  <label htmlFor="edit-storeLocationIds" className="block text-sm font-medium text-gray-700 mb-1">
                    Branch access
                  </label>
                  <BranchAccessChecklist
                    id="edit-storeLocationIds"
                    options={branchOptions}
                    selectedIds={form.storeLocationIds}
                    onChange={handleBranchAccessChange}
                    disabled={disableForm}
                  />
                  <p className="mt-1 text-xs text-gray-500">
                    Select every Branch this Admin may access. Unchecking a Branch also drops that Branch&apos;s Role.
                  </p>
                </div>
              )}
              {isOwnAccount && canAssignBranches ? (
                <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                  You cannot change your own Branch access here. Ask another Admin with Branch assign permission to update it.
                </p>
              ) : null}

              {showBranchAssignment ? (
                <div className="space-y-3">
                  <div className="text-sm font-medium text-gray-700">
                    Role per Branch {form.storeLocationIds.length > 0 ? <span className="text-red-500">*</span> : null}
                  </div>
                  {selectedBranches.length === 0 ? (
                    <p className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
                      {form.globalRoleIds.length > 0
                        ? 'No Branch access selected. Global Role assignment will be kept.'
                        : 'Select Branch access to assign Branch Roles.'}
                    </p>
                  ) : (
                    selectedBranches.map((branch) => {
                      const branchKey = String(branch.id)
                      const currentRoleId = form.roleByBranchId[branchKey] ?? null
                      const branchRoles = assignableRolesForBranch(roles, branch.id, currentRoleId)
                      return (
                        <div key={branch.id}>
                          <label
                            htmlFor={`edit-role-${branchKey}`}
                            className="mb-1 block text-sm font-medium text-gray-700"
                          >
                            {branch.name}
                          </label>
                          <select
                            id={`edit-role-${branchKey}`}
                            value={currentRoleId ?? ''}
                            onChange={(event) =>
                              setForm((prev) => ({
                                ...prev,
                                roleByBranchId: {
                                  ...prev.roleByBranchId,
                                  [branchKey]: event.target.value,
                                },
                              }))
                            }
                            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-blue-500"
                            disabled={disableForm || rolesLoading || roleReadOnly}
                            title={roleReadOnly ? 'You cannot change this internal role.' : undefined}
                          >
                            <option value="">{t('common.selectRole')}</option>
                            {branchRoles.map((role) => (
                              <option key={String(role.id)} value={String(role.id ?? '')}>
                                {formatAdminRoleLabel(role)}
                              </option>
                            ))}
                          </select>
                        </div>
                      )
                    })
                  )}
                  {roleReadOnly && (
                    <p className="text-xs text-amber-700">
                      This role are not able to change please contact your administrator.
                    </p>
                  )}
                  {!roleReadOnly && (
                    <p className="text-xs text-gray-500">
                      The Staff role can only be assigned from the Staffs page.
                    </p>
                  )}
                </div>
              ) : (
                <div>
                  <label
                    htmlFor="edit-roleId"
                    className="block text-sm font-medium text-gray-700 mb-1"
                  >
                    {t('common.role')} <span className="text-red-500">*</span>
                  </label>
                  <select
                    id="edit-roleId"
                    name="legacyRoleId"
                    value={form.globalRoleIds[0] ?? Object.values(form.roleByBranchId)[0] ?? ''}
                    onChange={(event) => {
                      const value = event.target.value
                      const selected = roles.find((role) => String(role.id) === value)
                      setForm((prev) => {
                        if (selected?.storeLocationId != null) {
                          return {
                            ...prev,
                            globalRoleIds: [],
                            roleByBranchId: { [String(selected.storeLocationId)]: value },
                          }
                        }
                        return {
                          ...prev,
                          globalRoleIds: value ? [value] : [],
                          roleByBranchId: {},
                        }
                      })
                    }}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-blue-500 focus:border-blue-500"
                    disabled={disableForm || rolesLoading || roleReadOnly}
                    title={roleReadOnly ? 'You cannot change this internal role.' : undefined}
                  >
                    <option value="">{t('common.selectRole')}</option>
                    {legacyRoleOptions.map((role) => (
                      <option key={String(role.id)} value={String(role.id ?? '')}>
                        {formatAdminRoleLabel(role)}
                      </option>
                    ))}
                  </select>
                  {roleReadOnly && (
                    <p className="mt-1 text-xs text-amber-700">
                      This role are not able to change please contact your administrator.
                    </p>
                  )}
                  {!roleReadOnly && currentRoleIsStaff && (
                    <p className="mt-1 text-xs text-gray-500">
                      This login uses the Staff role. Manage the staff profile on the Staffs page, or pick another role to promote this account.
                    </p>
                  )}
                  {!roleReadOnly && !currentRoleIsStaff && (
                    <p className="mt-1 text-xs text-gray-500">
                      The Staff role can only be assigned from the Staffs page.
                    </p>
                  )}
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
