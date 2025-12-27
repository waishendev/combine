'use client'

import { ChangeEvent, FormEvent, useMemo, useState } from 'react'

import { useI18n } from '@/lib/i18n'
import type { RoleRowData } from './RoleRow'

export interface PermissionOption {
  id: number | string
  name: string
  slug: string
}

export interface GroupedPermissionOption {
  groupKey: string
  groupLabel: string
  permissions: Array<{
    id: string
    permission: PermissionOption
    displayName: string
  }>
}

const formatTitle = (value: string) => {
  return value
    .split(/[_\s]+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')
}

const createPermissionDisplayName = (
  permission: PermissionOption,
  groupLabel: string,
  actionRaw: string,
) => {
  const normalizedName = permission.name?.trim() ?? ''
  const normalizedSlug = permission.slug?.trim() ?? ''

  if (
    normalizedName &&
    normalizedSlug &&
    normalizedName.toLowerCase() !== normalizedSlug.toLowerCase()
  ) {
    return normalizedName
  }

  const actionLabel = formatTitle(actionRaw)

  if (actionLabel && groupLabel) {
    return `${actionLabel} ${groupLabel}`
  }

  if (actionLabel) {
    return actionLabel
  }

  if (groupLabel) {
    return groupLabel
  }

  if (normalizedName) {
    return normalizedName
  }

  return normalizedSlug || 'Permission'
}

export const groupPermissionsBySlug = (
  permissions: PermissionOption[],
): GroupedPermissionOption[] => {
  const groups: GroupedPermissionOption[] = []
  const groupMap = new Map<string, GroupedPermissionOption>()

  permissions.forEach((permission) => {
    const slug = permission.slug ?? ''
    const [groupRaw = 'other', actionRaw = ''] = slug.split('.', 2)
    const groupKey = groupRaw || 'other'
    const groupLabel = formatTitle(groupKey) || 'Other'
    const id = String(permission.id)
    const displayName = createPermissionDisplayName(
      permission,
      groupLabel,
      actionRaw,
    )

    let group = groupMap.get(groupKey)

    if (!group) {
      group = {
        groupKey,
        groupLabel,
        permissions: [],
      }
      groupMap.set(groupKey, group)
      groups.push(group)
    }

    group.permissions.push({
      id,
      permission,
      displayName,
    })
  })

  return groups
}

interface RoleCreateModalProps {
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
  permissionIds: string[]
}

const initialFormState: FormState = {
  name: '',
  description: '',
  permissionIds: [],
}

export default function RoleCreateModal({
  onClose,
  onSuccess,
  permissions,
  permissionsLoading,
}: RoleCreateModalProps) {
  const { t } = useI18n()
  const [form, setForm] = useState<FormState>({ ...initialFormState })
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const groupedPermissions = useMemo(
    () => groupPermissionsBySlug(permissions),
    [permissions],
  )

  const handleInputChange = (
    event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
  ) => {
    const { name, value } = event.target
    setForm((prev) => ({ ...prev, [name]: value }))
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
      const res = await fetch('/api/proxy/roles', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({
          name: trimmedName,
          description: form.description.trim() || null,
          is_active: true,
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
        setError(t('role.createError'))
        return
      }

      const payload = (data as { data?: RoleApiItem | null })?.data
      if (!payload || payload?.id == null) {
        setError(t('role.createError'))
        return
      }

      setForm({ ...initialFormState })
      onSuccess(mapApiRoleToRow(payload))
    } catch (err) {
      console.error(err)
      setError(t('role.createError'))
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
      <div className="relative mx-auto w-full max-w-4xl max-h-[90vh] rounded-lg bg-white shadow-lg flex flex-col">
        <div className="flex items-center justify-between border-b border-gray-300 px-5 py-4 flex-shrink-0">
          <h2 className="text-lg font-semibold">{t('role.createTitle')}</h2>
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

        <form id="role-create-form" onSubmit={handleSubmit} className="space-y-4 px-5 py-4 overflow-y-auto flex-1 min-h-0">
          <div className="grid gap-4">
            <div>
              <label
                htmlFor="name"
                className="mb-1 block text-sm font-medium text-gray-700"
              >
                {t('common.name')} <span className="text-red-500">*</span>
              </label>
              <input
                id="name"
                name="name"
                type="text"
                value={form.name}
                onChange={handleInputChange}
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-blue-500"
                placeholder={t('common.name')}
                disabled={submitting}
              />
            </div>
            <div>
              <label
                htmlFor="description"
                className="mb-1 block text-sm font-medium text-gray-700"
              >
                Description
              </label>
              <textarea
                id="description"
                name="description"
                value={form.description}
                onChange={handleInputChange}
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-blue-500"
                placeholder="Enter description (optional)"
                rows={3}
                disabled={submitting}
              />
            </div>
          </div>

          <div>
            <div className="mb-2 flex items-center justify-between">
              <label className="block text-sm font-medium text-gray-700">
                {t('role.permissionsLabel')}
              </label>
              <span className="text-xs text-gray-500">
                {t('role.selectedCount')} {form.permissionIds.length}
              </span>
            </div>
            <div className="max-h-[60vh] space-y-3 overflow-y-auto rounded border border-gray-200 p-3">
              {permissionsLoading ? (
                <p className="text-sm text-gray-500">{t('role.loadingPermissions')}</p>
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
                            disabled={submitting}
                          />
                          <div>
                            <p className="text-sm font-medium text-gray-900">
                              {displayName}
                            </p>
                            <p className="text-xs text-gray-500">
                              {permission.slug}
                            </p>
                          </div>
                        </label>
                      ))}
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-sm text-gray-500">{t('role.noPermissions')}</p>
              )}
            </div>
          </div>

          {error && <div className="text-sm text-red-600">{error}</div>}
        </form>

        <div className="flex items-center justify-end gap-3 px-5 py-4 border-t border-gray-300 flex-shrink-0">
          <button
            type="button"
            className="rounded-md border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-200"
            onClick={() => {
              if (!submitting) onClose()
            }}
            disabled={submitting}
          >
            {t('common.cancel')}
          </button>
          <button
            type="submit"
            form="role-create-form"
            className="rounded-md bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700 disabled:opacity-50"
            disabled={submitting}
          >
            {submitting ? t('common.creating') : t('common.create')}
          </button>
        </div>
      </div>
    </div>
  )
}
