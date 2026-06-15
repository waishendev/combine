'use client'

import { ChangeEvent, FormEvent, useEffect, useRef, useState } from 'react'

import type { CategoryRowData } from './CategoryRow'
import { mapCategoryApiItemToRow, type CategoryApiItem } from './categoryUtils'
import MenuSelector from './MenuSelector'
import { IMAGE_ACCEPT } from './mediaAccept'
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
  cnName: string
  slug: string
  description: string
  metaTitle: string
  metaDescription: string
  metaKeywords: string
  isActive: 'true' | 'false'
  menuIds: number[]
}

const initialFormState: FormState = {
  name: '',
  cnName: '',
  slug: '',
  description: '',
  metaTitle: '',
  metaDescription: '',
  metaKeywords: '',
  isActive: 'true',
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
  const [ogFile, setOgFile] = useState<File | null>(null)
  const [ogPreview, setOgPreview] = useState<string | null>(null)
  const ogInputRef = useRef<HTMLInputElement>(null)

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

  useEffect(() => {
    return () => {
      if (ogPreview) URL.revokeObjectURL(ogPreview)
    }
  }, [ogPreview])

  const handleChange = (
    event: ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>,
  ) => {
    const { name, value } = event.target
    setForm((prev) => ({ ...prev, [name]: value }))
  }

  const handleMenuSelectionChange = (menuIds: number[]) => {
    setForm((prev) => ({ ...prev, menuIds }))
  }

  const handleOgFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] ?? null
    setOgPreview((prev) => {
      if (prev) URL.revokeObjectURL(prev)
      return null
    })
    if (!file) {
      setOgFile(null)
      return
    }
    setOgFile(file)
    setOgPreview(URL.createObjectURL(file))
  }

  const clearOgImage = () => {
    setOgFile(null)
    setOgPreview((prev) => {
      if (prev) URL.revokeObjectURL(prev)
      return null
    })
    if (ogInputRef.current) ogInputRef.current.value = ''
  }

  const handleOgZoneClick = () => {
    if (!submitting) ogInputRef.current?.click()
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
      const fd = new FormData()
      fd.append('name', trimmedName)
      if (form.cnName.trim()) fd.append('cn_name', form.cnName.trim())
      fd.append('slug', trimmedSlug)
      if (form.description.trim()) fd.append('description', form.description.trim())
      if (form.metaTitle.trim()) fd.append('meta_title', form.metaTitle.trim())
      if (form.metaDescription.trim()) fd.append('meta_description', form.metaDescription.trim())
      if (form.metaKeywords.trim()) fd.append('meta_keywords', form.metaKeywords.trim())
      fd.append('is_active', form.isActive === 'true' ? '1' : '0')
      form.menuIds.forEach((id) => fd.append('menu_ids[]', String(id)))
      if (ogFile) {
        fd.append('meta_og_image_file', ogFile)
      }

      const res = await fetch('/api/proxy/ecommerce/categories', {
        method: 'POST',
        headers: {
          Accept: 'application/json',
        },
        body: fd,
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
            cnName: form.cnName.trim(),
            slug: trimmedSlug,
            description: form.description.trim(),
            metaTitle: form.metaTitle.trim(),
            metaDescription: form.metaDescription.trim(),
            metaKeywords: form.metaKeywords.trim(),
            metaOgImage: '',
            isActive: form.isActive === 'true',
            sortOrder: 0,
            menuIds: form.menuIds,
            menuNames: menus.filter(m => form.menuIds.includes(m.id)).map(m => m.name).join(', ') || '-',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          }

      clearOgImage()
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
      <div className="relative w-full max-w-4xl mx-auto bg-white rounded-lg shadow-lg max-h-[90vh] overflow-y-auto">
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
          <div className="grid grid-cols-1 gap-8 md:grid-cols-2 md:gap-10">
            <div className="space-y-4 md:border-r md:border-gray-100 md:pr-8">
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">SEO</p>

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
                <textarea
                  id="metaDescription"
                  name="metaDescription"
                  value={form.metaDescription}
                  onChange={handleChange}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-blue-500 focus:border-blue-500 resize-y min-h-[80px]"
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
                <span className="block text-sm font-medium text-gray-700 mb-1">Meta OG Image</span>
                <p className="text-xs text-gray-500 mb-2">
                  JPEG, PNG, GIF or WebP (max 5MB). Click the area below to choose a file.
                </p>
                <div
                  onClick={handleOgZoneClick}
                  className={`relative border-2 border-dashed rounded-lg p-4 cursor-pointer transition-colors ${
                    ogPreview ? 'border-gray-300' : 'border-gray-300 hover:border-blue-400'
                  } ${submitting ? 'opacity-60 pointer-events-none' : ''}`}
                >
                  <input
                    ref={ogInputRef}
                    type="file"
                    accept={IMAGE_ACCEPT}
                    onChange={handleOgFileChange}
                    className="hidden"
                    disabled={submitting}
                  />
                  {ogPreview ? (
                    <div className="relative group">
                      <img
                        src={ogPreview}
                        alt="Open Graph preview"
                        className="w-full h-48 object-contain rounded bg-gray-50"
                      />
                      <div className="absolute top-2 right-2 flex items-center gap-2 opacity-100 transition-opacity duration-200 sm:opacity-0 sm:group-hover:opacity-100">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation()
                            handleOgZoneClick()
                          }}
                          className="w-8 h-8 bg-blue-500/95 backdrop-blur-md text-white rounded-full flex items-center justify-center shadow-lg border border-blue-400/30 hover:bg-blue-600"
                          aria-label="Replace Open Graph image"
                          disabled={submitting}
                        >
                          <i className="fa-solid fa-image text-xs" />
                        </button>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation()
                            clearOgImage()
                          }}
                          className="w-8 h-8 bg-red-500/95 backdrop-blur-md text-white rounded-full flex items-center justify-center shadow-lg border border-red-400/30 hover:bg-red-600"
                          aria-label="Remove image"
                          disabled={submitting}
                        >
                          <i className="fa-solid fa-trash-can text-xs" />
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center py-8">
                      <i className="fa-solid fa-cloud-arrow-up text-4xl text-gray-400 mb-2" />
                      <p className="text-sm text-gray-600">Click to upload</p>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Category</p>

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
                  placeholder="English category name"
                  disabled={submitting}
                />
              </div>

              <div>
                <label
                  htmlFor="cnName"
                  className="block text-sm font-medium text-gray-700 mb-1"
                >
                  CN Name
                </label>
                <input
                  id="cnName"
                  name="cnName"
                  type="text"
                  value={form.cnName}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-blue-500 focus:border-blue-500"
                  placeholder="中文分类名称"
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

              <div>
                <label
                  htmlFor="create-isActive"
                  className="block text-sm font-medium text-gray-700 mb-1"
                >
                  Status <span className="text-red-500">*</span>
                </label>
                <select
                  id="create-isActive"
                  name="isActive"
                  value={form.isActive}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-blue-500 focus:border-blue-500"
                  disabled={submitting}
                >
                  <option value="true">{t('common.active')}</option>
                  <option value="false">{t('common.inactive')}</option>
                </select>
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
                <textarea
                  id="description"
                  name="description"
                  value={form.description}
                  onChange={handleChange}
                  rows={5}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-blue-500 focus:border-blue-500 resize-y min-h-[100px]"
                  placeholder="Category description"
                  disabled={submitting}
                />
              </div>
            </div>
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

