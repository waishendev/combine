'use client'

import { ChangeEvent, FormEvent, useEffect, useRef, useState } from 'react'

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
  const [openingHours, setOpeningHours] = useState<string[]>([''])
  const [existingImages, setExistingImages] = useState<
    { id: number; imageUrl: string }[]
  >([])
  const [deletedImageIds, setDeletedImageIds] = useState<number[]>([])
  const [newImages, setNewImages] = useState<
    { file: File; preview: string }[]
  >([])
  const imageInputRef = useRef<HTMLInputElement | null>(null)

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
        setOpeningHours(
          mappedStore.openingHours && mappedStore.openingHours.length > 0
            ? mappedStore.openingHours
            : [''],
        )
        setExistingImages(mappedStore.images ?? [])
        setDeletedImageIds([])
        setNewImages([])

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

  const handleImageChange = (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? [])
    if (!files.length) return

    const activeExistingCount = existingImages.length - deletedImageIds.length
    const remainingSlots = Math.max(6 - activeExistingCount - newImages.length, 0)
    const nextFiles = files.slice(0, remainingSlots)

    if (nextFiles.length < files.length) {
      setError('You can upload up to 6 photos.')
    }

    nextFiles.forEach((file) => {
      const reader = new FileReader()
      reader.onloadend = () => {
        setNewImages((prev) => [...prev, { file, preview: reader.result as string }])
      }
      reader.readAsDataURL(file)
    })

    if (imageInputRef.current) {
      imageInputRef.current.value = ''
    }
  }

  const handleImageClick = () => {
    if (!submitting) {
      imageInputRef.current?.click()
    }
  }

  const handleRemoveExistingImage = (imageId: number) => {
    if (submitting) return
    setDeletedImageIds((prev) => [...prev, imageId])
  }

  const handleRemoveNewImage = (index: number) => {
    if (submitting) return
    setNewImages((prev) => prev.filter((_, currentIndex) => currentIndex !== index))
  }

  const handleOpeningHourChange = (index: number, value: string) => {
    setOpeningHours((prev) => prev.map((item, idx) => (idx === index ? value : item)))
  }

  const handleAddOpeningHour = () => {
    setOpeningHours((prev) => [...prev, ''])
  }

  const handleRemoveOpeningHour = (index: number) => {
    setOpeningHours((prev) => prev.filter((_, idx) => idx !== index))
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
      const formData = new FormData()
      formData.append('name', trimmedName)
      formData.append('code', trimmedCode)
      formData.append('address_line1', trimmedAddressLine1)
      formData.append('address_line2', form.address_line2.trim())
      formData.append('city', trimmedCity)
      formData.append('state', trimmedState)
      formData.append('postcode', trimmedPostcode)
      formData.append('country', trimmedCountry)
      formData.append('phone', trimmedPhone)
      formData.append('is_active', form.isActive === 'true' ? '1' : '0')
      openingHours
        .map((value) => value.trim())
        .filter(Boolean)
        .forEach((value) => {
          formData.append('opening_hours[]', value)
        })
      newImages.forEach(({ file }) => {
        formData.append('images[]', file)
      })
      deletedImageIds.forEach((imageId) => {
        formData.append('delete_image_ids[]', String(imageId))
      })

      const res = await fetch(
        `/api/proxy/ecommerce/store-locations/${storeId}`,
        {
          method: 'PUT',
          headers: {
            Accept: 'application/json',
            'Accept-Language': 'en',
          },
          body: formData,
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
            imageUrl: loadedStore?.imageUrl ?? null,
            images: loadedStore?.images ?? [],
            openingHours: openingHours
              .map((value) => value.trim())
              .filter(Boolean),
            address_line1: trimmedAddressLine1,
            address_line2: form.address_line2.trim(),
            city: trimmedCity,
            state: trimmedState,
            postcode: trimmedPostcode,
            country: trimmedCountry,
            phone: trimmedPhone,
            isActive: form.isActive === 'true',
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
      <div className="relative w-full max-w-4xl mx-auto bg-white rounded-lg shadow-lg max-h-[90vh] overflow-y-auto">
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
              <div className="grid grid-cols-1 gap-6 lg:grid-cols-[280px_minmax(0,1fr)]">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-medium text-gray-700">Photos</h3>
                    <span className="text-xs text-gray-500">
                      {existingImages.length - deletedImageIds.length + newImages.length}
                      /6
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    {existingImages
                      .filter((image) => !deletedImageIds.includes(image.id))
                      .map((image) => (
                        <div
                          key={`existing-${image.id}`}
                          className="relative rounded-lg border border-gray-200 overflow-hidden group"
                        >
                          <img
                            src={image.imageUrl}
                            alt="Store"
                            className="h-28 w-full object-cover"
                          />
                          <button
                            type="button"
                            onClick={() => handleRemoveExistingImage(image.id)}
                            className="absolute top-2 right-2 h-7 w-7 rounded-full bg-red-500/90 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition"
                            aria-label="Remove image"
                          >
                            <i className="fa-solid fa-trash" />
                          </button>
                        </div>
                      ))}
                    {newImages.map((image, index) => (
                      <div
                        key={image.preview}
                        className="relative rounded-lg border border-gray-200 overflow-hidden group"
                      >
                        <img
                          src={image.preview}
                          alt="Preview"
                          className="h-28 w-full object-cover"
                        />
                        <button
                          type="button"
                          onClick={() => handleRemoveNewImage(index)}
                          className="absolute top-2 right-2 h-7 w-7 rounded-full bg-red-500/90 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition"
                          aria-label="Remove image"
                        >
                          <i className="fa-solid fa-trash" />
                        </button>
                      </div>
                    ))}
                    {existingImages.length - deletedImageIds.length + newImages.length < 6 && (
                      <button
                        type="button"
                        onClick={handleImageClick}
                        className="flex flex-col items-center justify-center h-28 rounded-lg border-2 border-dashed border-gray-300 text-gray-400 hover:border-blue-400 hover:text-blue-500 transition"
                      >
                        <i className="fa-regular fa-image text-xl mb-1" />
                        <span className="text-xs">Add Photo</span>
                      </button>
                    )}
                  </div>
                  <input
                    ref={imageInputRef}
                    id="imageFile"
                    name="imageFile"
                    type="file"
                    accept="image/*"
                    multiple
                    onChange={handleImageChange}
                    className="hidden"
                    disabled={disableForm}
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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

                  <div className="md:col-span-2">
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

                  <div className="md:col-span-2">
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

                  <div className="md:col-span-2">
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

                  <div className="md:col-span-2">
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

                  <div className="md:col-span-2 space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="block text-sm font-medium text-gray-700">
                        Opening Hours
                      </label>
                      <button
                        type="button"
                        onClick={handleAddOpeningHour}
                        className="inline-flex items-center gap-2 text-sm text-blue-600 hover:text-blue-700"
                      >
                        <i className="fa-solid fa-plus" />
                        Add line
                      </button>
                    </div>
                    <div className="space-y-2">
                      {openingHours.map((value, index) => (
                        <div key={`opening-${index}`} className="flex items-center gap-2">
                          <input
                            type="text"
                            value={value}
                            onChange={(event) =>
                              handleOpeningHourChange(index, event.target.value)
                            }
                            className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-blue-500 focus:border-blue-500"
                            placeholder="e.g. Mon-Fri 10:00 - 19:00"
                            disabled={disableForm}
                          />
                          {openingHours.length > 1 && (
                            <button
                              type="button"
                              onClick={() => handleRemoveOpeningHour(index)}
                              className="h-9 w-9 rounded-md border border-gray-300 text-gray-500 hover:text-red-500 hover:border-red-300"
                              aria-label="Remove opening hour"
                            >
                              <i className="fa-solid fa-xmark" />
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
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
