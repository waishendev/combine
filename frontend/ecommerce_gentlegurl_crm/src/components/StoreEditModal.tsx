'use client'

import { ChangeEvent, FormEvent, useEffect, useState } from 'react'

import type { StoreRowData } from './StoreRow'
import { mapStoreApiItemToRow, type StoreApiItem } from './storeUtils'
import { useI18n } from '@/lib/i18n'

interface StoreEditModalProps {
  storeId: number
  onClose: () => void
  onSuccess: (store: StoreRowData) => void
}

interface FormState {
  name: string
  code: string
  address_line1: string
  address_line2: string
  city: string
  state: string
  postcode: string
  country: string
  phone: string
  isActive: 'true' | 'false'
}

const initialFormState: FormState = {
  name: '',
  code: '',
  address_line1: '',
  address_line2: '',
  city: '',
  state: '',
  postcode: '',
  country: '',
  phone: '',
  isActive: 'true',
}

export default function StoreEditModal({
  storeId,
  onClose,
  onSuccess,
}: StoreEditModalProps) {
  const { t } = useI18n()
  const [form, setForm] = useState<FormState>({ ...initialFormState })
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loadedStore, setLoadedStore] = useState<StoreRowData | null>(null)

  useEffect(() => {
    const controller = new AbortController()

    const loadStore = async () => {
      setLoading(true)
      setError(null)
      try {
        const res = await fetch(
          `/api/proxy/ecommerce/store-locations/${storeId}`,
          {
            cache: 'no-store',
            signal: controller.signal,
            headers: {
              Accept: 'application/json',
              'Accept-Language': 'en',
            },
          },
        )

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
          setError('Failed to load store')
          return
        }

        const store = data?.data as StoreApiItem | undefined
        if (!store || typeof store !== 'object') {
          setError('Failed to load store')
          return
        }

        const mappedStore = mapStoreApiItemToRow(store)
        setLoadedStore(mappedStore)

        setForm({
          name: typeof store.name === 'string' ? store.name : '',
          code: typeof store.code === 'string' ? store.code : '',
          address_line1:
            typeof store.address_line1 === 'string' ? store.address_line1 : '',
          address_line2:
            typeof store.address_line2 === 'string' ? store.address_line2 : '',
          city: typeof store.city === 'string' ? store.city : '',
          state: typeof store.state === 'string' ? store.state : '',
          postcode: typeof store.postcode === 'string' ? store.postcode : '',
          country: typeof store.country === 'string' ? store.country : '',
          phone: typeof store.phone === 'string' ? store.phone : '',
          isActive:
            store.is_active === true ||
            store.is_active === 'true' ||
            store.is_active === 1
              ? 'true'
              : 'false',
        })
      } catch (err) {
        if (!(err instanceof DOMException && err.name === 'AbortError')) {
          setError('Failed to load store')
        }
      } finally {
        setLoading(false)
      }
    }

    loadStore().catch(() => {
      setLoading(false)
      setError('Failed to load store')
    })

    return () => controller.abort()
  }, [storeId])

  const handleChange = (
    event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>,
  ) => {
    const { name, value } = event.target
    setForm((prev) => ({ ...prev, [name]: value }))
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    const trimmedName = form.name.trim()
    const trimmedCode = form.code.trim()
    const trimmedAddressLine1 = form.address_line1.trim()
    const trimmedCity = form.city.trim()
    const trimmedState = form.state.trim()
    const trimmedPostcode = form.postcode.trim()
    const trimmedCountry = form.country.trim()
    const trimmedPhone = form.phone.trim()

    if (
      !trimmedName ||
      !trimmedCode ||
      !trimmedAddressLine1 ||
      !trimmedCity ||
      !trimmedState ||
      !trimmedPostcode ||
      !trimmedCountry ||
      !trimmedPhone
    ) {
      setError(t('common.allFieldsRequired'))
      return
    }

    setSubmitting(true)
    setError(null)

    try {
      const payload = {
        name: trimmedName,
        code: trimmedCode,
        address_line1: trimmedAddressLine1,
        address_line2: form.address_line2.trim(),
        city: trimmedCity,
        state: trimmedState,
        postcode: trimmedPostcode,
        country: trimmedCountry,
        phone: trimmedPhone,
        is_active: form.isActive === 'true',
      }

      const res = await fetch(
        `/api/proxy/ecommerce/store-locations/${storeId}`,
        {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
            'Accept-Language': 'en',
          },
          body: JSON.stringify(payload),
        },
      )

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
        setError('Failed to update store')
        return
      }

      const payloadData =
        data && typeof data === 'object' && 'data' in data
          ? ((data as { data?: StoreApiItem | null }).data ?? null)
          : null

      const storeRow: StoreRowData = payloadData
        ? mapStoreApiItemToRow(payloadData)
        : {
            id: loadedStore?.id ?? storeId,
            name: trimmedName,
            code: trimmedCode,
            address_line1: trimmedAddressLine1,
            address_line2: form.address_line2.trim(),
            city: trimmedCity,
            state: trimmedState,
            postcode: trimmedPostcode,
            country: trimmedCountry,
            phone: trimmedPhone,
            isActive: form.isActive === 'true',
            createdAt: loadedStore?.createdAt ?? '',
            updatedAt: new Date().toISOString(),
          }

      setLoadedStore(storeRow)
      onSuccess(storeRow)
    } catch (err) {
      console.error(err)
      setError('Failed to update store')
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
      <div className="relative w-full max-w-2xl mx-auto bg-white rounded-lg shadow-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between border-b border-gray-300 px-5 py-4 sticky top-0 bg-white z-10">
          <h2 className="text-lg font-semibold">Edit Store</h2>
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
            <div className="py-8 text-center text-sm text-gray-500">
              {t('common.loadingDetails')}
            </div>
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
                  placeholder="Store Name"
                  disabled={disableForm}
                />
              </div>

              <div>
                <label
                  htmlFor="edit-code"
                  className="block text-sm font-medium text-gray-700 mb-1"
                >
                  Code <span className="text-red-500">*</span>
                </label>
                <input
                  id="edit-code"
                  name="code"
                  type="text"
                  value={form.code}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Store Code"
                  disabled={disableForm}
                />
              </div>

              <div>
                <label
                  htmlFor="edit-address_line1"
                  className="block text-sm font-medium text-gray-700 mb-1"
                >
                  Address Line 1 <span className="text-red-500">*</span>
                </label>
                <input
                  id="edit-address_line1"
                  name="address_line1"
                  type="text"
                  value={form.address_line1}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Address Line 1"
                  disabled={disableForm}
                />
              </div>

              <div>
                <label
                  htmlFor="edit-address_line2"
                  className="block text-sm font-medium text-gray-700 mb-1"
                >
                  Address Line 2
                </label>
                <input
                  id="edit-address_line2"
                  name="address_line2"
                  type="text"
                  value={form.address_line2}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Address Line 2 (Optional)"
                  disabled={disableForm}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label
                    htmlFor="edit-city"
                    className="block text-sm font-medium text-gray-700 mb-1"
                  >
                    City <span className="text-red-500">*</span>
                  </label>
                  <input
                    id="edit-city"
                    name="city"
                    type="text"
                    value={form.city}
                    onChange={handleChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-blue-500 focus:border-blue-500"
                    placeholder="City"
                    disabled={disableForm}
                  />
                </div>

                <div>
                  <label
                    htmlFor="edit-state"
                    className="block text-sm font-medium text-gray-700 mb-1"
                  >
                    State <span className="text-red-500">*</span>
                  </label>
                  <input
                    id="edit-state"
                    name="state"
                    type="text"
                    value={form.state}
                    onChange={handleChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-blue-500 focus:border-blue-500"
                    placeholder="State"
                    disabled={disableForm}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label
                    htmlFor="edit-postcode"
                    className="block text-sm font-medium text-gray-700 mb-1"
                  >
                    Postcode <span className="text-red-500">*</span>
                  </label>
                  <input
                    id="edit-postcode"
                    name="postcode"
                    type="text"
                    value={form.postcode}
                    onChange={handleChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-blue-500 focus:border-blue-500"
                    placeholder="Postcode"
                    disabled={disableForm}
                  />
                </div>

                <div>
                  <label
                    htmlFor="edit-country"
                    className="block text-sm font-medium text-gray-700 mb-1"
                  >
                    Country <span className="text-red-500">*</span>
                  </label>
                  <input
                    id="edit-country"
                    name="country"
                    type="text"
                    value={form.country}
                    onChange={handleChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-blue-500 focus:border-blue-500"
                    placeholder="Country"
                    disabled={disableForm}
                  />
                </div>
              </div>

              <div>
                <label
                  htmlFor="edit-phone"
                  className="block text-sm font-medium text-gray-700 mb-1"
                >
                  Phone <span className="text-red-500">*</span>
                </label>
                <input
                  id="edit-phone"
                  name="phone"
                  type="text"
                  value={form.phone}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Phone Number"
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
            </>
          )}

          {error && (
            <div className="text-sm text-red-600" role="alert">
              {error}
            </div>
          )}

          <div className="flex items-center justify-end gap-3 pt-2 sticky bottom-0 bg-white pb-4">
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


