'use client'

import { ChangeEvent, FormEvent, useEffect, useState } from 'react'

import type { ShopMenuRowData } from './ShopMenuRow'
import { mapShopMenuApiItemToRow, type ShopMenuApiItem } from './shopMenuUtils'
import { useI18n } from '@/lib/i18n'

interface ShopMenuEditModalProps {
  shopMenuId: number
  onClose: () => void
  onSuccess: (shopMenu: ShopMenuRowData) => void
}

interface FormState {
  name: string
  slug: string
  status: 'active' | 'inactive'
}

const initialFormState: FormState = {
  name: '',
  slug: '',
  status: 'active',
}

export default function ShopMenuEditModal({
  shopMenuId,
  onClose,
  onSuccess,
}: ShopMenuEditModalProps) {
  const { t } = useI18n()
  const [form, setForm] = useState<FormState>({ ...initialFormState })
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loadedShopMenu, setLoadedShopMenu] = useState<ShopMenuRowData | null>(null)

  useEffect(() => {
    const controller = new AbortController()

    const loadShopMenu = async () => {
      setLoading(true)
      setError(null)
      try {
        const res = await fetch(`/api/proxy/ecommerce/shop-menu-items/${shopMenuId}`, {
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
          setError(t('common.loadError'))
          return
        }

        const shopMenu = data?.data as ShopMenuApiItem | undefined
        if (!shopMenu || typeof shopMenu !== 'object') {
          setError(t('common.loadError'))
          return
        }

        const mappedShopMenu = mapShopMenuApiItemToRow(shopMenu)
        setLoadedShopMenu(mappedShopMenu)

        setForm({
          name: typeof shopMenu.name === 'string' ? shopMenu.name : '',
          slug: typeof shopMenu.slug === 'string' ? shopMenu.slug : '',
          status:
            shopMenu.is_active === true || shopMenu.is_active === 'true' || shopMenu.is_active === 1
              ? 'active'
              : 'inactive',
        })
      } catch (err) {
        if (!(err instanceof DOMException && err.name === 'AbortError')) {
          setError(t('common.loadError'))
        }
      } finally {
        setLoading(false)
      }
    }

    loadShopMenu().catch(() => {
      setLoading(false)
      setError(t('common.loadError'))
    })

    return () => controller.abort()
  }, [shopMenuId, t])

  const handleChange = (
    event: ChangeEvent<HTMLInputElement | HTMLSelectElement>,
  ) => {
    const { name, value } = event.target
    setForm((prev) => ({ ...prev, [name]: value }))
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    const trimmedName = form.name.trim()
    const trimmedSlug = form.slug.trim()

    if (!trimmedName || !trimmedSlug) {
      setError(t('common.allFieldsRequired'))
      return
    }

    setSubmitting(true)
    setError(null)

    try {
      const payload: Record<string, unknown> = {
        name: trimmedName,
        slug: trimmedSlug,
        is_active: form.status === 'active',
      }

      const res = await fetch(`/api/proxy/ecommerce/shop-menu-items/${shopMenuId}`, {
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
        setError(t('common.updateError'))
        return
      }

      const payloadData =
        data && typeof data === 'object' && 'data' in data
          ? ((data as { data?: ShopMenuApiItem | null }).data ?? null)
          : null

      const shopMenuRow: ShopMenuRowData = payloadData
        ? mapShopMenuApiItemToRow(payloadData)
        : {
            id: loadedShopMenu?.id ?? shopMenuId,
            name: trimmedName,
            slug: trimmedSlug,
            sortOrder: loadedShopMenu?.sortOrder ?? null,
            isActive: form.status === 'active',
            createdAt: loadedShopMenu?.createdAt ?? '',
            updatedAt: new Date().toISOString(),
          }

      setLoadedShopMenu(shopMenuRow)
      onSuccess(shopMenuRow)
    } catch (err) {
      console.error(err)
      setError(t('common.updateError'))
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
          <h2 className="text-lg font-semibold">Edit Shop Menu</h2>
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
                  placeholder="Menu name"
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
                  placeholder="menu-slug"
                  disabled={disableForm}
                />
              </div>

              <div>
                <label
                  htmlFor="edit-status"
                  className="block text-sm font-medium text-gray-700 mb-1"
                >
                  Status <span className="text-red-500">*</span>
                </label>
                <select
                  id="edit-status"
                  name="status"
                  value={form.status}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-blue-500 focus:border-blue-500"
                  disabled={disableForm}
                >
                  <option value="active">{t('common.active')}</option>
                  <option value="inactive">{t('common.inactive')}</option>
                </select>
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
              {submitting ? t('common.saving') : t('common.save')}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

