'use client'

import { ChangeEvent, FormEvent, useEffect, useState } from 'react'

import type { PermissionGroupRowData } from './PermissionGroupRow'
import {
  mapPermissionGroupApiItemToRow,
  type PermissionGroupApiItem,
} from './permissionGroupUtils'
import { useI18n } from '@/lib/i18n'

interface PermissionGroupEditModalProps {
  groupId: number
  onClose: () => void
  onSuccess: (group: PermissionGroupRowData) => void
}

interface FormState {
  name: string
}

const initialFormState: FormState = {
  name: '',
}

export default function PermissionGroupEditModal({
  groupId,
  onClose,
  onSuccess,
}: PermissionGroupEditModalProps) {
  const { t } = useI18n()
  const [form, setForm] = useState<FormState>({ ...initialFormState })
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loadedGroup, setLoadedGroup] = useState<PermissionGroupRowData | null>(
    null,
  )

  useEffect(() => {
    const controller = new AbortController()

    const loadGroup = async () => {
      setLoading(true)
      setError(null)
      try {
        const res = await fetch(`/api/proxy/permission-groups/${groupId}`, {
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
          setError(t('permissionGroup.loadError'))
          return
        }

        const group = data?.data as PermissionGroupApiItem | undefined
        if (!group || typeof group !== 'object') {
          setError(t('permissionGroup.loadError'))
          return
        }

        const mappedGroup = mapPermissionGroupApiItemToRow(group)
        setLoadedGroup(mappedGroup)

        setForm({
          name: typeof group.name === 'string' ? group.name : '',
        })
      } catch (err) {
        if (!(err instanceof DOMException && err.name === 'AbortError')) {
          setError(t('permissionGroup.loadError'))
        }
      } finally {
        setLoading(false)
      }
    }

    loadGroup().catch(() => {
      setLoading(false)
      setError(t('permissionGroup.loadError'))
    })

    return () => controller.abort()
  }, [groupId, t])

  const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
    const { name, value } = event.target
    setForm((prev) => ({ ...prev, [name]: value }))
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    const trimmedName = form.name.trim()

    if (!trimmedName) {
      setError(t('common.allFieldsRequired'))
      return
    }

    setSubmitting(true)
    setError(null)

    try {
      const res = await fetch(`/api/proxy/permission-groups/${groupId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          'Accept-Language': 'en',
        },
        body: JSON.stringify({
          name: trimmedName,
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
        setError(t('permissionGroup.updateError'))
        return
      }

      const payloadData =
        data && typeof data === 'object' && 'data' in data
          ? ((data as { data?: PermissionGroupApiItem | null }).data ?? null)
          : null

      const groupRow: PermissionGroupRowData = payloadData
        ? mapPermissionGroupApiItemToRow(payloadData)
        : {
            id: loadedGroup?.id ?? groupId,
            name: trimmedName,
            sortOrder: loadedGroup?.sortOrder ?? null,
            createdAt: loadedGroup?.createdAt ?? '',
            updatedAt: new Date().toISOString(),
          }

      setLoadedGroup(groupRow)
      onSuccess(groupRow)
    } catch (err) {
      console.error(err)
      setError(t('permissionGroup.updateError'))
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
          <h2 className="text-lg font-semibold">
            {t('permissionGroup.editTitle')}
          </h2>
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
            <div className="py-8 text-center text-sm text-gray-500">
              {t('common.loadingDetails')}
            </div>
          ) : (
            <>
              <div>
                <label
                  htmlFor="edit-name"
                  className="block text-sm font-medium text-gray-700 mb-1"
                >
                  {t('permissionGroup.name')} <span className="text-red-500">*</span>
                </label>
                <input
                  id="edit-name"
                  name="name"
                  type="text"
                  value={form.name}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-blue-500 focus:border-blue-500"
                  placeholder={t('permissionGroup.namePlaceholder')}
                  disabled={disableForm}
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
              {submitting ? t('common.saving') : t('permissionGroup.saveChanges')}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

