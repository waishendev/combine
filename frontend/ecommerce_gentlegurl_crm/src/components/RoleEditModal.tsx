'use client'

import { ChangeEvent, FormEvent, useEffect, useMemo, useState } from 'react'

import {
  GroupedPermissionOption,
  PermissionOption,
  groupPermissionsBySlug,
} from './RoleCreateModal'
import { useI18n } from '@/lib/i18n'
import type { RoleRowData } from './RoleRow'

interface RoleEditModalProps {
  roleId: number | string
  onClose: () => void
  onSuccess: (role: RoleRowData) => void
  permissions: PermissionOption[]
  permissionsLoading: boolean
}

type RoleApiPermission = {
  id?: number | string | null
  name?: string | null
  slug?: string | null
}

type RoleApiItem = {
  id?: number | string | null
  name?: string | null
  description?: string | null
  is_active?: boolean | number | string | null
  permissions?: RoleApiPermission[] | null
  created_at?: string | null
  updated_at?: string | null
}

const mapApiRoleToRow = (item: RoleApiItem): RoleRowData => {
  const permissions = Array.isArray(item.permissions)
    ? item.permissions.map((permission) => ({
        id: permission?.id ?? '',
        name: permission?.name ?? '-',
        slug: permission?.slug ?? '-',
      }))
    : []

  const permissionNames =
    permissions.length > 0
      ? permissions.map((permission) => permission.name).join(', ')
      : ''

  const isActiveValue = item.is_active
  const isActive =
    isActiveValue === true ||
    isActiveValue === 'true' ||
    isActiveValue === '1' ||
    isActiveValue === 1

  return {
    id: item.id ?? '',
    name: item.name ?? '-',
    description: item.description ?? null,
    isActive,
    permissions,
    permissionNames,
    permissionCount: permissions.length,
    createdAt: item.created_at ?? '',
    updatedAt: item.updated_at ?? '',
  }
}

interface FormState {
  name: string
  description: string
  isActive: boolean
  permissionIds: string[]
}

const initialFormState: FormState = {
  name: '',
  description: '',
  isActive: true,
  permissionIds: [],
}

export default function RoleEditModal({
  roleId,
  onClose,
  onSuccess,
  permissions,
  permissionsLoading,
}: RoleEditModalProps) {
  const { t } = useI18n()
  const [form, setForm] = useState<FormState>({ ...initialFormState })
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)

  useEffect(() => {
    const controller = new AbortController()
    const fetchRole = async () => {
      setLoading(true)
      setLoadError(null)
      try {
        const res = await fetch(`/api/proxy/roles/${roleId}`, {
          cache: 'no-store',
          signal: controller.signal,
        })

        if (!res.ok) {
          const data = await res.json().catch(() => null)
          if (data && typeof data === 'object') {
            if (data?.success === false && data?.message === 'Unauthorized') {
              window.location.replace('/dashboard')
              return
            }
            if ('message' in data && typeof data.message === 'string') {
              setLoadError(data.message)
              return
            }
          }
          setLoadError('Failed to load role detail')
          return
        }

        const data = await res.json().catch(() => null)
        if (!data || typeof data !== 'object' || !('data' in data)) {
          setLoadError('Failed to load role detail')
          return
        }

        const roleData = (data as { data?: unknown }).data as
          | {
              name?: string | null
              description?: string | null
              is_active?: boolean | number | string | null
              permissions?: Array<{
                id?: number | string | null
              }>
            }
          | null
          | undefined

        const permissionIds = Array.isArray(roleData?.permissions)
          ? roleData?.permissions
              .map((permission) => permission?.id)
              .filter((id): id is number | string => id != null)
              .map((id) => String(id))
          : []

        const isActiveValue = roleData?.is_active
        const isActive =
          isActiveValue === true ||
          isActiveValue === 'true' ||
          isActiveValue === '1' ||
          isActiveValue === 1

        setForm({
          name: roleData?.name ?? '',
          description: roleData?.description ?? '',
          isActive,
          permissionIds,
        })
      } catch (err) {
        if (!(err instanceof DOMException && err.name === 'AbortError')) {
          console.error(err)
          setLoadError('Failed to load role detail')
        }
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false)
        }
      }
    }

    fetchRole().catch(() => {})

    return () => controller.abort()
  }, [roleId])

  const groupedPermissions: GroupedPermissionOption[] = useMemo(
    () => groupPermissionsBySlug(permissions),
    [permissions],
  )

  const handleInputChange = (
    event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
  ) => {
    const { name, value } = event.target
    setForm((prev) => ({ ...prev, [name]: value }))
  }

  const handleStatusChange = (event: ChangeEvent<HTMLSelectElement>) => {
    const { value } = event.target
    setForm((prev) => ({ ...prev, isActive: value === 'active' }))
  }

  const handlePermissionToggle = (event: ChangeEvent<HTMLInputElement>) => {
    const { value, checked } = event.target
    setForm((prev) => {
      const next = new Set(prev.permissionIds)
      if (checked) {
        next.add(value)
      } else {
        next.delete(value)
      }
      return { ...prev, permissionIds: Array.from(next) }
    })
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    const trimmedName = form.name.trim()
    if (!trimmedName) {
      setError('Name is required')
      return
    }

    setSubmitting(true)
    setError(null)

    try {
      const res = await fetch(`/api/proxy/roles/${roleId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({
          name: trimmedName,
          description: form.description.trim() || null,
          is_active: form.isActive,
          permission_ids: form.permissionIds.map((id) => Number(id)),
        }),
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
        setError('Failed to update role')
        return
      }

      const payload = (data as { data?: RoleApiItem | null })?.data
      if (!payload || payload?.id == null) {
        setError('Failed to update role')
        return
      }

      onSuccess(mapApiRoleToRow(payload))
    } catch (err) {
      console.error(err)
      setError('Failed to update role')
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
      <div className="relative mx-auto w-full max-w-4xl max-h-[90vh] rounded-lg bg-white shadow-lg flex flex-col">
        <div className="flex items-center justify-between border-b border-gray-300 px-5 py-4 flex-shrink-0">
          <h2 className="text-lg font-semibold">Edit Role</h2>
          <button
            onClick={() => {
              if (!submitting) onClose()
            }}
            className="text-2xl leading-none text-gray-500 hover:text-gray-700"
            aria-label={t('common.close')}
            type="button"
          >
            <i className="fa-solid fa-xmark" />
          </button>
        </div>

        {loadError ? (
          <div className="space-y-4 px-5 py-6 text-sm text-gray-700 overflow-y-auto flex-1 min-h-0">
            <p>{loadError}</p>
          </div>
        ) : (
          <form id="role-edit-form" onSubmit={handleSubmit} className="space-y-4 px-5 py-4 overflow-y-auto flex-1 min-h-0">
            <div className="grid gap-4">
              <div>
                <label
                  htmlFor="role-edit-name"
                  className="mb-1 block text-sm font-medium text-gray-700"
                >
                  {t('common.name')} <span className="text-red-500">*</span>
                </label>
                <input
                  id="role-edit-name"
                  name="name"
                  type="text"
                  value={form.name}
                  onChange={handleInputChange}
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-blue-500"
                  placeholder={t('common.name')}
                  disabled={disableForm}
                />
              </div>
              <div>
                <label
                  htmlFor="role-edit-description"
                  className="mb-1 block text-sm font-medium text-gray-700"
                >
                  Description
                </label>
                <textarea
                  id="role-edit-description"
                  name="description"
                  value={form.description}
                  onChange={handleInputChange}
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-blue-500"
                  placeholder="Enter description (optional)"
                  rows={3}
                  disabled={disableForm}
                />
              </div>
              <div>
                <label
                  htmlFor="role-edit-status"
                  className="mb-1 block text-sm font-medium text-gray-700"
                >
                  {t('common.status')}
                </label>
                <select
                  id="role-edit-status"
                  name="status"
                  value={form.isActive ? 'active' : 'inactive'}
                  onChange={handleStatusChange}
                  disabled={disableForm}
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-blue-500"
                >
                  <option value="active">{t('common.active')}</option>
                  <option value="inactive">{t('common.inactive')}</option>
                </select>
              </div>
            </div>

            <div>
              <div className="mb-2 flex items-center justify-between">
                <label className="block text-sm font-medium text-gray-700">
                  Permissions
                </label>
                <span className="text-xs text-gray-500">
                  Selected {form.permissionIds.length}
                </span>
              </div>
              <div className="max-h-[60vh] space-y-3 overflow-y-auto rounded border border-gray-200 p-3">
                {permissionsLoading ? (
                  <p className="text-sm text-gray-500">Loading permissions...</p>
                ) : permissions.length > 0 ? (
                  groupedPermissions.map((group) => (
                    <div key={group.groupKey} className="space-y-2">
                      <p className="text-xs font-semibold uppercase text-gray-500">
                        {group.groupLabel}
                      </p>
                      <div className="grid gap-2 md:grid-cols-2">
                        {group.permissions.map(({ id, permission, displayName }) => (
                          <label
                            key={id}
                            className="flex items-start gap-3 rounded border border-transparent px-2 py-2 hover:border-blue-200 hover:bg-blue-50"
                          >
                            <input
                              type="checkbox"
                              className="mt-1"
                              value={id}
                              checked={form.permissionIds.includes(id)}
                              onChange={handlePermissionToggle}
                              disabled={disableForm}
                            />
                            <div>
                              <p className="text-sm font-medium text-gray-900">
                                {displayName}
                              </p>
                              <p className="text-xs text-gray-500">{permission.slug}</p>
                            </div>
                          </label>
                        ))}
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-gray-500">No permissions found.</p>
                )}
              </div>
            </div>

            {error && <div className="text-sm text-red-600">{error}</div>}
          </form>
        )}

        {!loadError && (
          <div className="flex items-center justify-end gap-3 px-5 py-4 border-t border-gray-300 flex-shrink-0">
            <button
              type="button"
              className="rounded-md border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-200"
              onClick={() => {
                if (!submitting) onClose()
              }}
              disabled={submitting}
            >
              Cancel
            </button>
            <button
              type="submit"
              form="role-edit-form"
              className="rounded-md bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700 disabled:opacity-50"
              disabled={disableForm}
            >
              {submitting ? 'Updating...' : 'Update'}
            </button>
          </div>
        )}

        {loadError && (
          <div className="flex items-center justify-end gap-3 px-5 py-4 border-t border-gray-300 flex-shrink-0">
            <button
              type="button"
              className="rounded-md border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-200"
              onClick={onClose}
            >
              Close
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
