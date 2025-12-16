'use client'

import { ChangeEvent, FormEvent, useEffect, useState } from 'react'

import type { CategoryRowData } from './CategoryRow'
import { mapCategoryApiItemToRow, type CategoryApiItem } from './categoryUtils'
import MenuSelector from './MenuSelector'
import { useI18n } from '@/lib/i18n'

interface CategoryEditModalProps {
  categoryId: number
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
  isActive: 'true' | 'false'
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
  isActive: 'true',
  menuIds: [],
}

export default function CategoryEditModal({
  categoryId,
  onClose,
  onSuccess,
}: CategoryEditModalProps) {
  const { t } = useI18n()
  const [form, setForm] = useState<FormState>({ ...initialFormState })
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loadedCategory, setLoadedCategory] = useState<CategoryRowData | null>(null)
  const [menus, setMenus] = useState<MenuOption[]>([])
  const [menusLoading, setMenusLoading] = useState(false)

  useEffect(() => {
    const controller = new AbortController()

    const loadCategory = async () => {
      setLoading(true)
      setError(null)
      try {
        const res = await fetch(`/api/proxy/ecommerce/categories/${categoryId}`, {
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
          setError('Failed to load category')
          return
        }

        const category = data?.data as CategoryApiItem | undefined
        if (!category || typeof category !== 'object') {
          setError('Failed to load category')
          return
        }

        const mappedCategory = mapCategoryApiItemToRow(category)
        setLoadedCategory(mappedCategory)

        setForm({
          name: typeof category.name === 'string' ? category.name : '',
          slug: typeof category.slug === 'string' ? category.slug : '',
          description: typeof category.description === 'string' ? category.description : '',
          metaTitle: typeof category.meta_title === 'string' ? category.meta_title : '',
          metaDescription: typeof category.meta_description === 'string' ? category.meta_description : '',
          metaKeywords: typeof category.meta_keywords === 'string' ? category.meta_keywords : '',
          metaOgImage: typeof category.meta_og_image === 'string' ? category.meta_og_image : '',
          isActive:
            category.is_active === true || category.is_active === 'true' || category.is_active === 1
              ? 'true'
              : 'false',
          menuIds: mappedCategory.menuIds,
        })
      } catch (err) {
        if (!(err instanceof DOMException && err.name === 'AbortError')) {
          setError('Failed to load category')
        }
      } finally {
        setLoading(false)
      }
    }

    loadCategory().catch(() => {
      setLoading(false)
      setError('Failed to load category')
    })

    return () => controller.abort()
  }, [categoryId])

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
      const payload: Record<string, unknown> = {
        parent_id: null,
        name: trimmedName,
        slug: trimmedSlug,
        description: form.description.trim() || null,
        meta_title: form.metaTitle.trim() || null,
        meta_description: form.metaDescription.trim() || null,
        meta_keywords: form.metaKeywords.trim() || null,
        meta_og_image: form.metaOgImage.trim() || null,
        is_active: form.isActive === 'true',
        menu_ids: form.menuIds.length > 0 ? form.menuIds : [],
      }

      const res = await fetch(`/api/proxy/ecommerce/categories/${categoryId}`, {
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
        setError('Failed to update category')
        return
      }

      const payloadData =
        data && typeof data === 'object' && 'data' in data
          ? ((data as { data?: CategoryApiItem | null }).data ?? null)
          : null

      const categoryRow: CategoryRowData = payloadData
        ? mapCategoryApiItemToRow(payloadData)
        : {
            id: loadedCategory?.id ?? categoryId,
            name: trimmedName,
            slug: trimmedSlug,
            description: form.description.trim(),
            metaTitle: form.metaTitle.trim(),
            metaDescription: form.metaDescription.trim(),
            metaKeywords: form.metaKeywords.trim(),
            metaOgImage: form.metaOgImage.trim(),
            isActive: form.isActive === 'true',
            sortOrder: loadedCategory?.sortOrder ?? 0,
            menuIds: form.menuIds,
            menuNames: menus.filter(m => form.menuIds.includes(m.id)).map(m => m.name).join(', ') || '-',
            createdAt: loadedCategory?.createdAt ?? '',
            updatedAt: new Date().toISOString(),
          }

      setLoadedCategory(categoryRow)
      onSuccess(categoryRow)
    } catch (err) {
      console.error(err)
      setError('Failed to update category')
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
      <div className="relative w-full max-w-lg mx-auto bg-white rounded-lg shadow-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between border-b border-gray-300 px-5 py-4">
          <h2 className="text-lg font-semibold">Edit Category</h2>
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
                  placeholder="Category name"
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
                  placeholder="category-slug"
                  disabled={disableForm}
                />
              </div>



              <div>
                <label
                  htmlFor="edit-isActive"
                  className="block text-sm font-medium text-gray-700 mb-1"
                >
                  Status <span className="text-red-500">*</span>
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

              <MenuSelector
                menus={menus}
                selectedMenuIds={form.menuIds}
                onSelectionChange={handleMenuSelectionChange}
                disabled={disableForm}
                loading={menusLoading}
              />

              <div>
                <label
                  htmlFor="edit-description"
                  className="block text-sm font-medium text-gray-700 mb-1"
                >
                  Description
                </label>
                <input
                  id="edit-description"
                  name="description"
                  type="text"
                  value={form.description}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Category description"
                  disabled={disableForm}
                />
              </div>
              
              <div>
                <label
                  htmlFor="edit-metaTitle"
                  className="block text-sm font-medium text-gray-700 mb-1"
                >
                  Meta Title
                </label>
                <input
                  id="edit-metaTitle"
                  name="metaTitle"
                  type="text"
                  value={form.metaTitle}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Meta title"
                  disabled={disableForm}
                />
              </div>

              <div>
                <label
                  htmlFor="edit-metaDescription"
                  className="block text-sm font-medium text-gray-700 mb-1"
                >
                  Meta Description
                </label>
                <input
                  id="edit-metaDescription"
                  name="metaDescription"
                  type="text"
                  value={form.metaDescription}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Meta description"
                  disabled={disableForm}
                />
              </div>

              <div>
                <label
                  htmlFor="edit-metaKeywords"
                  className="block text-sm font-medium text-gray-700 mb-1"
                >
                  Meta Keywords
                </label>
                <input
                  id="edit-metaKeywords"
                  name="metaKeywords"
                  type="text"
                  value={form.metaKeywords}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-blue-500 focus:border-blue-500"
                  placeholder="keyword1, keyword2"
                  disabled={disableForm}
                />
              </div>

              <div>
                <label
                  htmlFor="edit-metaOgImage"
                  className="block text-sm font-medium text-gray-700 mb-1"
                >
                  Meta OG Image
                </label>
                <input
                  id="edit-metaOgImage"
                  name="metaOgImage"
                  type="text"
                  value={form.metaOgImage}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-blue-500 focus:border-blue-500"
                  placeholder="/uploads/seo/image.jpg"
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
              {submitting ? t('common.saving') : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

