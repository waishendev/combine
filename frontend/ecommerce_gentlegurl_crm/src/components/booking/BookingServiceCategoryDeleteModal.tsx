'use client'

import { useEffect, useState } from 'react'

import type { BookingServiceCategoryRowData } from './BookingServiceCategoryRow'
import type { LinkedBookingProductCategorySummary } from './BookingServiceCategoryProductLinkPanel'
import { useI18n } from '@/lib/i18n'

interface BookingServiceCategoryDeleteModalProps {
  category: BookingServiceCategoryRowData
  onClose: () => void
  onSuccess: (categoryId: number) => void
}

export default function BookingServiceCategoryDeleteModal({
  category,
  onClose,
  onSuccess,
}: BookingServiceCategoryDeleteModalProps) {
  const { t } = useI18n()
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [deleteLinkedProductCategory, setDeleteLinkedProductCategory] = useState(false)
  const [linkedProductCategory, setLinkedProductCategory] =
    useState<LinkedBookingProductCategorySummary | null>(null)
  const [loadingLink, setLoadingLink] = useState(true)

  useEffect(() => {
    let ignore = false
    const controller = new AbortController()

    const loadLinkedProductCategory = async () => {
      setLoadingLink(true)
      try {
        const res = await fetch(`/api/proxy/admin/booking/categories/${category.id}`, {
          cache: 'no-store',
          signal: controller.signal,
          headers: { Accept: 'application/json' },
        })
        const data = await res.json().catch(() => null)
        if (ignore || !res.ok) return

        const linked = (data as { data?: { linked_booking_product_category?: LinkedBookingProductCategorySummary | null } } | null)
          ?.data?.linked_booking_product_category
        if (linked && typeof linked === 'object' && Number(linked.id) > 0) {
          setLinkedProductCategory({
            id: Number(linked.id),
            name: String(linked.name ?? ''),
            cn_name: linked.cn_name ?? null,
            is_active: linked.is_active !== false,
          })
          setDeleteLinkedProductCategory(true)
        } else {
          setLinkedProductCategory(null)
          setDeleteLinkedProductCategory(false)
        }
      } catch {
        if (!ignore) {
          setLinkedProductCategory(null)
          setDeleteLinkedProductCategory(false)
        }
      } finally {
        if (!ignore) setLoadingLink(false)
      }
    }

    void loadLinkedProductCategory()
    return () => {
      ignore = true
      controller.abort()
    }
  }, [category.id])

  const handleDelete = async () => {
    setSubmitting(true)
    setError(null)

    try {
      const params = new URLSearchParams()
      if (deleteLinkedProductCategory && linkedProductCategory) {
        params.set('delete_linked_product_category', '1')
      }

      const url =
        params.size > 0
          ? `/api/proxy/admin/booking/categories/${category.id}?${params.toString()}`
          : `/api/proxy/admin/booking/categories/${category.id}`

      const res = await fetch(url, {
        method: 'DELETE',
        headers: { Accept: 'application/json' },
      })

      const data = await res.json().catch(() => null)
      if (data && typeof data === 'object') {
        if (data?.success === false && data?.message === 'Unauthorized') {
          window.location.replace('/dashboard')
          return
        }
      }

      if (!res.ok) {
        const message =
          data && typeof data === 'object' && typeof (data as { message?: unknown }).message === 'string'
            ? (data as { message: string }).message
            : t('common.deleteError')
        setError(message)
        return
      }

      onSuccess(category.id)
      onClose()
    } catch (err) {
      console.error(err)
      setError(t('common.deleteError'))
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
          <h2 className="text-lg font-semibold">Delete Category</h2>
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

        <div className="space-y-4 px-5 py-4">
          <p className="text-sm text-gray-700">
            Are you sure you want to delete this category? This action cannot be undone.
          </p>
          <div className="rounded-md bg-yellow-100 px-4 py-3">
            <p className="text-sm font-semibold text-yellow-800">{category.name}</p>
            {category.cnName ? (
              <p className="text-xs text-yellow-800">{category.cnName}</p>
            ) : null}
            <p className="text-xs text-yellow-800">/{category.slug}</p>
          </div>

          {!loadingLink && linkedProductCategory ? (
            <label className="flex items-start gap-2 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900">
              <input
                type="checkbox"
                checked={deleteLinkedProductCategory}
                onChange={(event) => setDeleteLinkedProductCategory(event.target.checked)}
                disabled={submitting}
                className="mt-1"
              />
              <span>
                <span className="font-medium">Also delete linked product category</span>
                <span className="mt-1 block text-xs">
                  {linkedProductCategory.name}
                  {linkedProductCategory.cn_name ? ` (${linkedProductCategory.cn_name})` : ''}
                </span>
                <span className="mt-1 block text-xs text-red-800">
                  Booking → Product Categories
                </span>
              </span>
            </label>
          ) : null}

          {error && (
            <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700" role="alert">
              {error}
            </div>
          )}

          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              className="rounded-md border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 disabled:opacity-50"
              onClick={() => {
                if (!submitting) onClose()
              }}
              disabled={submitting}
            >
              {t('common.cancel')}
            </button>
            <button
              type="button"
              className="rounded-md bg-red-600 px-4 py-2 text-sm text-white hover:bg-red-700 disabled:opacity-50"
              onClick={() => void handleDelete()}
              disabled={submitting || loadingLink}
            >
              {submitting ? 'Deleting...' : t('common.delete')}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
