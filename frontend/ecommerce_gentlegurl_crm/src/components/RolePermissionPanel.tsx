'use client'

import { useEffect, useMemo, useState } from 'react'

import { RoleRowData } from './RoleRow'
import { useI18n } from '@/lib/i18n'

interface RolePermissionPanelProps {
  role: RoleRowData
  onClose: () => void
}

type LoadedPermission = {
  id: number | string
  name: string
  slug: string
}

export default function RolePermissionPanel({
  role,
  onClose,
}: RolePermissionPanelProps) {
  const { t } = useI18n()
  const [loadedPermissions, setLoadedPermissions] = useState<LoadedPermission[] | null>(
    Array.isArray(role.permissions) && role.permissions.length > 0 ? role.permissions : null,
  )
  const [loading, setLoading] = useState(!(Array.isArray(role.permissions) && role.permissions.length > 0))
  const [error, setError] = useState('')

  useEffect(() => {
    if (Array.isArray(role.permissions) && role.permissions.length > 0) {
      setLoadedPermissions(role.permissions)
      setLoading(false)
      return
    }

    const controller = new AbortController()
    const load = async () => {
      setLoading(true)
      setError('')
      try {
        const res = await fetch(`/api/proxy/roles/${role.id}`, {
          cache: 'no-store',
          signal: controller.signal,
        })
        if (!res.ok) {
          setError('Unable to load permissions.')
          setLoadedPermissions([])
          return
        }
        const json = await res.json().catch(() => null)
        const payload = json?.data || {}
        const permissions = Array.isArray(payload.permissions) ? payload.permissions : []
        setLoadedPermissions(
          permissions.map((permission: { id?: number | string; name?: string; slug?: string }) => ({
            id: permission.id ?? '',
            name: permission.name ?? '-',
            slug: permission.slug ?? '-',
          })),
        )
      } catch (err) {
        if (!(err instanceof DOMException && err.name === 'AbortError')) {
          setError('Unable to load permissions.')
          setLoadedPermissions([])
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false)
      }
    }

    void load()
    return () => controller.abort()
  }, [role.id, role.permissions])

  const permissionItems = useMemo(() => loadedPermissions ?? [], [loadedPermissions])

  return (
    <div
      className="fixed inset-0 z-50 flex bg-black/40 px-0 md:bg-transparent md:px-0"
      role="dialog"
      aria-modal="true"
      onClick={onClose}
    >
      <div className="hidden flex-1 bg-black/40 md:block" />
      <aside
        className="ml-auto flex h-full w-full max-w-md flex-col bg-white shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-gray-200 px-5 py-4">
          <h3 className="text-sm font-semibold text-gray-900">
            {t('role.detailTitle')}
          </h3>
          <button
            type="button"
            className="text-gray-500 hover:text-gray-700"
            onClick={onClose}
            aria-label={t('common.close')}
          >
            <i className="fa-solid fa-xmark" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-4">
          <div className="space-y-5">
            <section className="rounded border border-gray-200">
              <div className="border-b border-gray-200 bg-gray-50 px-4 py-3">
                <p className="text-sm font-semibold text-gray-900">{role.name}</p>
                {role.description && (
                  <p className="text-xs text-gray-600 mt-1">{role.description}</p>
                )}
              </div>
            </section>

            <section className="rounded border border-gray-200">
              <div className="border-b border-gray-200 bg-gray-50 px-4 py-3">
                <p className="text-sm font-semibold text-gray-900">
                  {t('common.permissions')} ({loading ? '…' : permissionItems.length})
                </p>
              </div>
              <div className="px-4 py-3">
                {loading ? (
                  <p className="text-sm text-gray-500">Loading permissions…</p>
                ) : error ? (
                  <p className="text-sm text-red-600">{error}</p>
                ) : permissionItems.length > 0 ? (
                  <ul className="space-y-2 text-sm text-gray-700">
                    {permissionItems.map((permission) => (
                      <li key={permission.id} className="rounded border border-gray-200 px-3 py-2">
                        <p className="font-medium text-gray-900">{permission.name}</p>
                        <p className="text-xs text-gray-500">{permission.slug}</p>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-gray-500">{t('table.no_data')}</p>
                )}
              </div>
            </section>
          </div>
        </div>
      </aside>
    </div>
  )
}
