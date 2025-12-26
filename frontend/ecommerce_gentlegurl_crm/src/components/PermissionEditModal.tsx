'use client'

import { ChangeEvent, FormEvent, useEffect, useState } from 'react'

import type { PermissionRowData } from './PermissionRow'
import { PermissionGroupOption } from './PermissionFilters'
import { mapPermissionApiItemToRow, type PermissionApiItem } from './permissionUtils'
import { useI18n } from '@/lib/i18n'

interface PermissionEditModalProps {
  permissionId: number
  onClose: () => void
  onSuccess: (permission: PermissionRowData) => void
  groups: PermissionGroupOption[]
  groupsLoading: boolean
}

interface FormState {
  group_id: string
  name: string
  slug: string
  description: string
}

const initialFormState: FormState = {
  group_id: '',
  name: '',
  slug: '',
  description: '',
}

export default function PermissionEditModal({
  permissionId,
  onClose,
  onSuccess,
  groups,
  groupsLoading,
}: PermissionEditModalProps) {
  const { t } = useI18n()
  const [form, setForm] = useState<FormState>({ ...initialFormState })
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loadedPermission, setLoadedPermission] = useState<PermissionRowData | null>(null)

  useEffect(() => {
    const controller = new AbortController()

    const loadPermission = async () => {
      setLoading(true)
      setError(null)
      try {
        const res = await fetch(`/api/proxy/permissions/${permissionId}`, {
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
          setError('Failed to load permission')
          return
        }

        const permission = data?.data as PermissionApiItem | undefined
        if (!permission || typeof permission !== 'object') {
          setError('Failed to load permission')
          return
        }

        const mappedPermission = mapPermissionApiItemToRow(permission)
        setLoadedPermission(mappedPermission)

        setForm({
          group_id: permission.group_id ? String(permission.group_id) : '',
          name: typeof permission.name === 'string' ? permission.name : '',
          slug: typeof permission.slug === 'string' ? permission.slug : '',
          description: typeof permission.description === 'string' ? permission.description : '',
        })
      } catch (err) {
        if (!(err instanceof DOMException && err.name === 'AbortError')) {
          setError('Failed to load permission')
        }
      } finally {
        setLoading(false)
      }
    }

    loadPermission().catch(() => {
      setLoading(false)
      setError('Failed to load permission')
    })

    return () => controller.abort()
  }, [permissionId, t])

  const handleChange = (
    event: ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>,
  ) => {
    const { name, value } = event.target
    setForm((prev) => ({ ...prev, [name]: value }))
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    const trimmedName = form.name.trim()
    const trimmedSlug = form.slug.trim()
    const groupIdNumber = Number(form.group_id)

    if (!trimmedName || !trimmedSlug || !groupIdNumber) {
      setError(t('common.allFieldsRequired'))
      return
    }

    setSubmitting(true)
    setError(null)

    try {
      const payload: Record<string, unknown> = {
        group_id: groupIdNumber,
        name: trimmedName,
        slug: trimmedSlug,
      }

      if (form.description.trim()) {
        payload.description = form.description.trim()
      }

      const res = await fetch(`/api/proxy/permissions/${permissionId}`, {
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
        setError('Failed to update permission')
        return
      }

      const payloadData =
        data && typeof data === 'object' && 'data' in data
          ? ((data as { data?: PermissionApiItem | null }).data ?? null)
          : null

      const groupName =
        groups.find((group) => Number(group.id) === groupIdNumber)?.name ||
        loadedPermission?.groupName ||
        '-'

      const permissionRow: PermissionRowData = payloadData
        ? mapPermissionApiItemToRow(payloadData)
        : {
            id: loadedPermission?.id ?? permissionId,
            groupId: groupIdNumber || null,
            groupName,
            name: trimmedName,
            slug: trimmedSlug,
            description: form.description.trim() || null,
            createdAt: loadedPermission?.createdAt ?? '',
            updatedAt: new Date().toISOString(),
          }

      setLoadedPermission(permissionRow)
      onSuccess(permissionRow)
    } catch (err) {
      console.error(err)
      setError('Failed to update permission')
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
          <h2 className="text-lg font-semibold">Edit Permission</h2>
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
                  htmlFor="edit-group_id"
                  className="block text-sm font-medium text-gray-700 mb-1"
                >
                  Group <span className="text-red-500">*</span>
                </label>
                <select
                  id="edit-group_id"
                  name="group_id"
                  value={form.group_id}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-blue-500 focus:border-blue-500"
                  disabled={disableForm || groupsLoading}
                >
                  <option value="">Select Group</option>
                  {groups.map((group) => (
                    <option key={String(group.id)} value={String(group.id ?? '')}>
                      {group.name ?? group.id}
                    </option>
                  ))}
                </select>
              </div>

              <div>
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
                  placeholder="Name"
                  disabled={disableForm}
                />
              </div>

              <div>
                <label
                  htmlFor="edit-slug"
                  className="block text-sm font-medium text-gray-700 mb-1"
                >
                  Slug <span className="text-red-500">*</span>
                </label>
                <input
                  id="edit-slug"
                  name="slug"
                  type="text"
                  value={form.slug}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Slug"
                  disabled={disableForm}
                />
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
                  disabled={disableForm}
                  rows={3}
                />
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
              {submitting ? t('common.saving') : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

