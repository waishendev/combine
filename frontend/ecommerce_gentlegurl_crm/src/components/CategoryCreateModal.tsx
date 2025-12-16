'use client'

import { ChangeEvent, FormEvent, useEffect, useState } from 'react'

import type { CategoryRowData } from './CategoryRow'
import { mapCategoryApiItemToRow, type CategoryApiItem } from './categoryUtils'
import MenuSelector from './MenuSelector'
import { useI18n } from '@/lib/i18n'

interface CategoryCreateModalProps {
  onClose: () => void
  onSuccess: (category: CategoryRowData) => void
}

interface MenuOption {
  id: number
  name: string
}

interface FormState {
  name: string
  slug: string
  description: string
  metaTitle: string
  metaDescription: string
  metaKeywords: string
  metaOgImage: string
  menuIds: number[]
}

const initialFormState: FormState = {
  name: '',
  slug: '',
  description: '',
  metaTitle: '',
  metaDescription: '',
  metaKeywords: '',
  metaOgImage: '',
  menuIds: [],
}

export default function CategoryCreateModal({
  onClose,
  onSuccess,
}: CategoryCreateModalProps) {
  const { t } = useI18n()
  const [form, setForm] = useState<FormState>({ ...initialFormState })
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [menus, setMenus] = useState<MenuOption[]>([])
  const [menusLoading, setMenusLoading] = useState(false)

  useEffect(() => {
    const controller = new AbortController()
    const fetchMenus = async () => {
      setMenusLoading(true)
      try {
        const res = await fetch('/api/proxy/ecommerce/shop-menu-items?page=1&per_page=200', {
          cache: 'no-store',
          signal: controller.signal,
        })

        if (!res.ok) {
          return
        }

        const data = await res.json().catch(() => ({}))
        if (data?.success === false && data?.message === 'Unauthorized') {
          window.location.replace('/dashboard')
          return
        }

        if (data?.data) {
          let menuItems: MenuOption[] = []
          if (Array.isArray(data.data)) {
            menuItems = data.data
          } else if (typeof data.data === 'object' && 'data' in data.data && Array.isArray(data.data.data)) {
            menuItems = data.data.data
          }

          setMenus(
            menuItems
              .map((item: { id?: number | string | null; name?: string | null }) => ({
                id: typeof item.id === 'number' ? item.id : Number(item.id) || 0,
                name: item.name || '',
              }))
              .filter((item: MenuOption) => item.id > 0 && item.name)
          )
        }
      } catch (err) {
        if (!(err instanceof DOMException && err.name === 'AbortError')) {
          console.error(err)
        }
      } finally {
        if (!controller.signal.aborted) {
          setMenusLoading(false)
        }
      }
    }

    fetchMenus()
    return () => controller.abort()
  }, [])

  const handleChange = (
    event: ChangeEvent<HTMLInputElement | HTMLSelectElement>,
  ) => {
    const { name, value } = event.target
    setForm((prev) => ({ ...prev, [name]: value }))
  }

  const handleMenuSelectionChange = (menuIds: number[]) => {
    setForm((prev) => ({ ...prev, menuIds }))
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    const trimmedName = form.name.trim()
    const trimmedSlug = form.slug.trim()

    if (!trimmedName || !trimmedSlug) {
      setError('Name and slug are required')
      return
    }

    setSubmitting(true)
    setError(null)

    try {
      const res = await fetch('/api/proxy/ecommerce/categories', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({
          parent_id: null,
          name: trimmedName,
          slug: trimmedSlug,
          description: form.description.trim() || null,
          meta_title: form.metaTitle.trim() || null,
          meta_description: form.metaDescription.trim() || null,
          meta_keywords: form.metaKeywords.trim() || null,
          meta_og_image: form.metaOgImage.trim() || null,
          is_active: true,
          menu_ids: form.menuIds.length > 0 ? form.menuIds : [],
        }),
      })

      const data = await res.json().catch(() => null)

      if (!res.ok) {
        let message = 'Failed to create category'
        if (data && typeof data === 'object') {
          if (typeof (data as { message?: unknown }).message === 'string') {
            message = (data as { message: string }).message
          } else if (data && 'errors' in data) {
            const errors = (data as { errors?: unknown }).errors
            if (errors && typeof errors === 'object') {
              const firstKey = Object.keys(errors)[0]
              const firstValue = firstKey ? (errors as Record<string, unknown>)[firstKey] : null
              if (Array.isArray(firstValue) && typeof firstValue[0] === 'string') {
                message = firstValue[0]
              } else if (typeof firstValue === 'string') {
                message = firstValue
              }
            }
          }
        }
        setError(message)
        return
      }

      const payload =
        data && typeof data === 'object' && 'data' in data
          ? ((data as { data?: CategoryApiItem | null }).data ?? null)
          : null

      const categoryRow: CategoryRowData = payload
        ? mapCategoryApiItemToRow(payload)
        : {
            id: 0,
            name: trimmedName,
            slug: trimmedSlug,
            description: form.description.trim(),
            metaTitle: form.metaTitle.trim(),
            metaDescription: form.metaDescription.trim(),
            metaKeywords: form.metaKeywords.trim(),
            metaOgImage: form.metaOgImage.trim(),
            isActive: true,
            sortOrder: 0,
            menuIds: form.menuIds,
            menuNames: menus.filter(m => form.menuIds.includes(m.id)).map(m => m.name).join(', ') || '-',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          }

      setForm({ ...initialFormState })
      onSuccess(categoryRow)
    } catch (err) {
      console.error(err)
      setError('Failed to create category')
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
      <div className="relative w-full max-w-lg mx-auto bg-white rounded-lg shadow-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between border-b border-gray-300 px-5 py-4">
          <h2 className="text-lg font-semibold">Create Category</h2>
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
          <div>
            <label
              htmlFor="name"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              Name <span className="text-red-500">*</span>
            </label>
            <input
              id="name"
              name="name"
              type="text"
              value={form.name}
              onChange={handleChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-blue-500 focus:border-blue-500"
              placeholder="Category name"
              disabled={submitting}
            />
          </div>

          <div>
            <label
              htmlFor="slug"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              Slug <span className="text-red-500">*</span>
            </label>
            <input
              id="slug"
              name="slug"
              type="text"
              value={form.slug}
              onChange={handleChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-blue-500 focus:border-blue-500"
              placeholder="category-slug"
              disabled={submitting}
            />
          </div>

         
          <MenuSelector
            menus={menus}
            selectedMenuIds={form.menuIds}
            onSelectionChange={handleMenuSelectionChange}
            disabled={submitting}
            loading={menusLoading}
          />

          
          <div>
            <label
              htmlFor="description"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              Description
            </label>
            <input
              id="description"
              name="description"
              type="text"
              value={form.description}
              onChange={handleChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-blue-500 focus:border-blue-500"
              placeholder="Category description"
              disabled={submitting}
            />
          </div>

          <div>
            <label
              htmlFor="metaTitle"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              Meta Title
            </label>
            <input
              id="metaTitle"
              name="metaTitle"
              type="text"
              value={form.metaTitle}
              onChange={handleChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-blue-500 focus:border-blue-500"
              placeholder="Meta title"
              disabled={submitting}
            />
          </div>

          <div>
            <label
              htmlFor="metaDescription"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              Meta Description
            </label>
            <input
              id="metaDescription"
              name="metaDescription"
              type="text"
              value={form.metaDescription}
              onChange={handleChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-blue-500 focus:border-blue-500"
              placeholder="Meta description"
              disabled={submitting}
            />
          </div>

          <div>
            <label
              htmlFor="metaKeywords"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              Meta Keywords
            </label>
            <input
              id="metaKeywords"
              name="metaKeywords"
              type="text"
              value={form.metaKeywords}
              onChange={handleChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-blue-500 focus:border-blue-500"
              placeholder="keyword1, keyword2"
              disabled={submitting}
            />
          </div>

          <div>
            <label
              htmlFor="metaOgImage"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              Meta OG Image
            </label>
            <input
              id="metaOgImage"
              name="metaOgImage"
              type="text"
              value={form.metaOgImage}
              onChange={handleChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-blue-500 focus:border-blue-500"
              placeholder="/uploads/seo/image.jpg"
              disabled={submitting}
            />
          </div>

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
              disabled={submitting}
            >
              {submitting ? t('common.creating') : t('common.create')}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

