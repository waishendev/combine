'use client'

import { useState } from 'react'

import { RoleRowData } from './RoleRow'
import { useI18n } from '@/lib/i18n'

interface RoleDeleteModalProps {
  role: RoleRowData
  onClose: () => void
  onDeleted: (roleId: RoleRowData['id']) => void
}

export default function RoleDeleteModal({
  role,
  onClose,
  onDeleted,
}: RoleDeleteModalProps) {
  const { t } = useI18n()
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleDelete = async () => {
    setSubmitting(true)
    setError(null)

    try {
      const res = await fetch(`/api/proxy/roles/${role.id}`, {
        method: 'DELETE',
        headers: {
          Accept: 'application/json',
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
        }
        setError('Failed to delete role')
        return
      }

      onDeleted(role.id)
    } catch (err) {
      console.error(err)
      setError('Failed to delete role')
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
      <div className="relative mx-auto w-full max-w-md rounded-lg bg-white shadow-lg">
        <div className="flex items-center justify-between border-b border-gray-300 px-5 py-4">
          <h2 className="text-lg font-semibold">Delete Role</h2>
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

        <div className="space-y-4 px-5 py-4 text-sm text-gray-700">
          <p>
            Are you sure you want to delete <strong>{role.name}</strong>?
          </p>
          {error && <p className="text-red-600">{error}</p>}
        </div>

        <div className="flex items-center justify-end gap-3 border-t border-gray-300 px-5 py-3">
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
            type="button"
            className="rounded-md bg-red-600 px-4 py-2 text-sm text-white hover:bg-red-700 disabled:opacity-50"
            onClick={handleDelete}
            disabled={submitting}
          >
            {submitting ? 'Deleting...' : 'Delete'}
          </button>
        </div>
      </div>
    </div>
  )
}
