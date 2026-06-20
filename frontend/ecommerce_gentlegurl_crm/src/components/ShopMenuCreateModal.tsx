'use client'

import { ChangeEvent, FormEvent, useState } from 'react'

import type { ShopMenuRowData } from './ShopMenuRow'
import { mapShopMenuApiItemToRow, type ShopMenuApiItem } from './shopMenuUtils'
import CrmFormModalShell from './CrmFormModalShell'
import { useI18n } from '@/lib/i18n'

interface ShopMenuCreateModalProps {
  onClose: () => void
  onSuccess: (shopMenu: ShopMenuRowData) => void
}

interface FormState {
  name: string
  slug: string
}

const initialFormState: FormState = {
  name: '',
  slug: '',
}

export default function ShopMenuCreateModal({
  onClose,
  onSuccess,
}: ShopMenuCreateModalProps) {
  const { t } = useI18n()
  const [form, setForm] = useState<FormState>({ ...initialFormState })
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

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
      const res = await fetch('/api/proxy/ecommerce/shop-menu-items', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({
          name: trimmedName,
          slug: trimmedSlug,
          is_active: true,
        }),
      })

      const data = await res.json().catch(() => null)

      if (!res.ok) {
        let message = t('common.createError')
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
          ? ((data as { data?: ShopMenuApiItem | null }).data ?? null)
          : null

      const shopMenuRow: ShopMenuRowData = payload
        ? mapShopMenuApiItemToRow(payload)
        : {
            id: 0,
            name: trimmedName,
            slug: trimmedSlug,
            sortOrder: null,
            isActive: true,
            createdAt: '',
            updatedAt: '',
          }

      setForm({ ...initialFormState })
      onSuccess(shopMenuRow)
    } catch (err) {
      console.error(err)
      setError(t('common.createError'))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <CrmFormModalShell
      title="Create Shop Menu"
      onClose={onClose}
      closeDisabled={submitting}
      closeLabel={t('common.close')}
      footer={
        <>
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
            form="shop-menu-create-form"
            className="px-4 py-2 text-sm text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50"
            disabled={submitting}
          >
            {submitting ? t('common.creating') : t('common.create')}
          </button>
        </>
      }
    >
      <form id="shop-menu-create-form" onSubmit={handleSubmit} className="space-y-4 px-5 py-4">
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
              placeholder="Menu name"
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
              placeholder="menu-slug"
              disabled={submitting}
            />
          </div>

          {error && (
            <div className="text-sm text-red-600" role="alert">
              {error}
            </div>
          )}
        </form>
    </CrmFormModalShell>
  )
}

