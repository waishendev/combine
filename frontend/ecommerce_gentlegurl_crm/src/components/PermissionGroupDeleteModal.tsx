'use client'

import { useMemo, useState } from 'react'

import type { PermissionGroupRowData } from './PermissionGroupRow'
import { useI18n } from '@/lib/i18n'

interface PermissionGroupDeleteModalProps {
  group: PermissionGroupRowData
  onClose: () => void
  onDeleted: (groupId: number) => void
}

export default function PermissionGroupDeleteModal({
  group,
  onClose,
  onDeleted,
}: PermissionGroupDeleteModalProps) {
  const { t } = useI18n()
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const acceptLanguage = useMemo(() => {
    return 'en'
  }, [])

  const handleDelete = async () => {
    setSubmitting(true)
    setError(null)

    try {
      const res = await fetch(`/api/proxy/permission-groups/${group.id}`, {
        method: 'DELETE',
        headers: {
          Accept: 'application/json',
          'Accept-Language': acceptLanguage,
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
        setError(t('permissionGroup.deleteError'))
        return
      }

      onDeleted(group.id)
    } catch (err) {
      console.error(err)
      setError(t('permissionGroup.deleteError'))
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
      <div className="relative w-full max-w-md mx-auto bg-white rounded-lg shadow-lg">
        <div className="flex items-center justify-between border-b border-gray-300 px-5 py-4">
          <h2 className="text-lg font-semibold">
            {t('permissionGroup.deleteTitle')}
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

        <div className="px-5 py-4 space-y-4">
          <p className="text-sm text-gray-700">
            {t('permissionGroup.deletePrompt')}
          </p>
          <div className="rounded-md bg-yellow-100 px-4 py-3">
            <p className="text-sm font-semibold text-yellow-800">{group.name}</p>
          </div>

          {error && (
            <div
              className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
              role="alert"
            >
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
              type="button"
              className="px-4 py-2 text-sm text-white bg-red-600 rounded-md hover:bg-red-700 disabled:opacity-50"
              onClick={handleDelete}
              disabled={submitting}
            >
              {submitting ? t('permissionGroup.deleting') : t('permissionGroup.deleteAction')}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

