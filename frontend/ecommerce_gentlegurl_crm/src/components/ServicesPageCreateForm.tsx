'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useMemo, useState } from 'react'

import ServicesMenuCreateModal from './ServicesMenuCreateModal'
import type { ServicesMenuRowData } from './ServicesMenuRow'

type ServicesMenuItem = {
  id: number
  name: string
  slug: string
  sort_order: number
  is_active: boolean
  page?: { id?: number } | null
}

type ApiResponse = {
  data?:
    | ServicesMenuItem[]
    | {
        data?: ServicesMenuItem[]
      }
  message?: string | null
}

function normalizeMenuItems(response: ApiResponse): ServicesMenuItem[] {
  if (!response?.data) return []
  if (Array.isArray(response.data)) return response.data
  return Array.isArray(response.data.data) ? response.data.data : []
}

export default function ServicesPageCreateForm({ permissions }: { permissions: string[] }) {
  const router = useRouter()
  const canCreate = permissions.includes('ecommerce.services-pages.create')
  const canCreateMenu = permissions.includes('ecommerce.services-menu.create')

  const [menuItems, setMenuItems] = useState<ServicesMenuItem[]>([])
  const [menuId, setMenuId] = useState<string>('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)

  useEffect(() => {
    const controller = new AbortController()
    const loadMenus = async () => {
      setLoading(true)
      setError(null)
      try {
        const qs = new URLSearchParams({ per_page: '200' })
        const res = await fetch(`/api/proxy/ecommerce/services-menu-items?${qs.toString()}`, {
          cache: 'no-store',
          signal: controller.signal,
        })
        if (!res.ok) {
          throw new Error('Failed to load services menu items.')
        }
        const json: ApiResponse = await res.json().catch(() => ({}))
        const items = normalizeMenuItems(json)
        setMenuItems(items)
      } catch (err) {
        if (!(err instanceof DOMException && err.name === 'AbortError')) {
          setError(err instanceof Error ? err.message : 'Failed to load services menu items.')
        }
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false)
        }
      }
    }

    loadMenus()
    return () => controller.abort()
  }, [])

  const availableMenus = useMemo(
    () =>
      menuItems
        .filter((item) => !item.page?.id)
        .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0)),
    [menuItems],
  )

  const selectedMenu = useMemo(
    () => availableMenus.find((item) => String(item.id) === menuId) ?? null,
    [availableMenus, menuId],
  )

  const handleContinue = () => {
    if (!menuId) {
      setError('Please select a Services Menu item first.')
      return
    }
    if (!selectedMenu) {
      setError('The selected Services Menu item could not be found.')
      return
    }

    setSaving(true)
    setError(null)
    router.push(`/services-pages/${selectedMenu.id}`)
  }

  const handleServicesMenuCreated = (servicesMenu: ServicesMenuRowData) => {
    setMenuItems((prev) => [
      {
        id: servicesMenu.id,
        name: servicesMenu.name,
        slug: servicesMenu.slug,
        sort_order: servicesMenu.sortOrder ?? 0,
        is_active: servicesMenu.isActive,
        page: null,
      },
      ...prev,
    ])
    setMenuId(String(servicesMenu.id))
    setError(null)
  }

  if (loading) {
    return <div className="rounded-lg border border-gray-200 bg-white p-6 text-sm text-gray-500">Loading services menus...</div>
  }

  return (
    <div className="space-y-4 rounded-lg border border-gray-200 bg-white p-6">
      {isCreateModalOpen && (
        <ServicesMenuCreateModal
          onClose={() => setIsCreateModalOpen(false)}
          onSuccess={(servicesMenu) => {
            setIsCreateModalOpen(false)
            handleServicesMenuCreated(servicesMenu)
          }}
        />
      )}
      <div>
        <h3 className="text-base font-semibold text-gray-900">Create Services Page</h3>
        <p className="text-xs text-gray-500">You must select a Services Menu item before continuing.</p>
      </div>

      <div className="flex flex-col items-start gap-2">
        {canCreateMenu && (
          <button
            type="button"
            className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded text-sm flex items-center gap-2"
            onClick={() => setIsCreateModalOpen(true)}
          >
            <i className="fa-solid fa-plus" />
            Create Services Menu
          </button>
        )}

        {!availableMenus.length && (
          <span className="text-xs text-amber-700">
            All Services Menu items already have pages. Create a new menu item first.
          </span>
        )}
      </div>

      <label className="space-y-1 text-sm text-gray-700">
        <span className="font-medium">Services Menu</span>
        <select
          value={menuId}
          onChange={(e) => setMenuId(e.target.value)}
          className="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          disabled={!canCreate || saving || !availableMenus.length}
        >
          <option value="">Select a services menu...</option>
          {availableMenus.map((item) => (
            <option key={item.id} value={item.id}>
              {item.name} ({item.slug})
            </option>
          ))}
        </select>
      </label>


      {error && (
        <div className="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="flex items-center justify-end gap-2 pt-2">
        <button
          type="button"
          onClick={() => router.push('/services-pages')}
          className="rounded border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
          disabled={saving}
        >
          Back
        </button>
        <button
          type="button"
          onClick={handleContinue}
          className="rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
          disabled={!canCreate || saving || !menuId}
        >
          Continue
        </button>
      </div>
    </div>
  )
}
