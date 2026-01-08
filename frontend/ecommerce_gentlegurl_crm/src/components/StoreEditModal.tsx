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

const MAX_IMAGES = 6

type StoreImageItem =
  | { type: 'existing'; id: number; preview: string }
  | { type: 'new'; tempId: string; file: File; preview: string }

type OpeningHourEntry = {
  label: string
  time: string
}

const parseOpeningHour = (value: string): OpeningHourEntry => {
  const [labelPart, ...timeParts] = value.split(':')
  if (timeParts.length === 0) {
    return { label: value.trim(), time: '' }
  }
  return { label: labelPart.trim(), time: timeParts.join(':').trim() }
}

const buildOpeningHourValue = (entry: OpeningHourEntry) => {
  const label = entry.label.trim()
  const time = entry.time.trim()
  if (!label && !time) {
    return ''
  }
  if (!label) {
    return time
  }
  if (!time) {
    return `${label}:`
  }
  return `${label}: ${time}`
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
  const [openingHours, setOpeningHours] = useState<OpeningHourEntry[]>([
    { label: '', time: '' },
  ])
  const [imageItems, setImageItems] = useState<StoreImageItem[]>([])
  const [deletedImageIds, setDeletedImageIds] = useState<number[]>([])
  const [draggingIndex, setDraggingIndex] = useState<number | null>(null)
  const [replaceIndex, setReplaceIndex] = useState<number | null>(null)
  const imageInputRef = useRef<HTMLInputElement | null>(null)

  const readFile = (file: File) =>
    new Promise<{ file: File; preview: string }>((resolve) => {
      const reader = new FileReader()
      reader.onloadend = () => {
        resolve({ file, preview: reader.result as string })
      }
      reader.readAsDataURL(file)
    })

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
            ? mappedStore.openingHours.map(parseOpeningHour)
            : [{ label: '', time: '' }],
        )
        setImageItems(
          (mappedStore.images ?? []).map((image) => ({
            type: 'existing',
            id: image.id,
            preview: image.imageUrl,
          })),
        )
        setDeletedImageIds([])

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

    const processFiles = async () => {
      if (replaceIndex !== null) {
        const [file] = files
        if (!file) return
        const preview = await readFile(file)
        setImageItems((prev) => {
          const next = [...prev]
          const target = next[replaceIndex]
          if (target?.type === 'existing') {
            setDeletedImageIds((ids) => [...ids, target.id])
          }
          next[replaceIndex] = {
            type: 'new',
            tempId: `${Date.now()}-${Math.random()}`,
            file: preview.file,
            preview: preview.preview,
          }
          return next
        })
        setReplaceIndex(null)
      } else {
        const remainingSlots = Math.max(MAX_IMAGES - imageItems.length, 0)
        const nextFiles = files.slice(0, remainingSlots)

        if (nextFiles.length < files.length) {
          setError('You can upload up to 6 photos.')
        }

        const previews = await Promise.all(nextFiles.map(readFile))
        setImageItems((prev) => [
          ...prev,
          ...previews.map((preview) => ({
            type: 'new' as const,
            tempId: `${Date.now()}-${Math.random()}`,
            file: preview.file,
            preview: preview.preview,
          })),
        ])
      }
    }

    processFiles().finally(() => {
      if (imageInputRef.current) {
        imageInputRef.current.value = ''
      }
    })
  }

  const handleImageClick = () => {
    if (!submitting) {
      imageInputRef.current?.click()
    }
  }

  const handleRemoveImage = (index: number) => {
    if (submitting) return
    setImageItems((prev) => {
      const next = [...prev]
      const removed = next.splice(index, 1)
      const item = removed[0]
      if (item?.type === 'existing') {
        setDeletedImageIds((ids) => [...ids, item.id])
      }
      return next
    })
  }

  const handleReplaceImage = (index: number) => {
    if (submitting) return
    setReplaceIndex(index)
    imageInputRef.current?.click()
  }

  const handleImageReorder = (fromIndex: number, toIndex: number) => {
    if (fromIndex === toIndex) return
    setImageItems((prev) => {
      const next = [...prev]
      const [moved] = next.splice(fromIndex, 1)
      next.splice(toIndex, 0, moved)
      return next
    })
  }

  const handleOpeningHourChange = (
    index: number,
    field: keyof OpeningHourEntry,
    value: string,
  ) => {
    setOpeningHours((prev) =>
      prev.map((item, idx) => (idx === index ? { ...item, [field]: value } : item)),
    )
  }

  const handleAddOpeningHour = () => {
    setOpeningHours((prev) => [...prev, { label: '', time: '' }])
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
      formData.append('_method', 'PUT')
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
        .map(buildOpeningHourValue)
        .map((value) => value.trim())
        .filter(Boolean)
        .forEach((value) => {
          formData.append('opening_hours[]', value)
        })

      const newImageItems = imageItems.filter((item) => item.type === 'new')
      newImageItems.forEach((item) => {
        formData.append('images[]', item.file)
      })

      const imageOrder = imageItems.map((item) => {
        if (item.type === 'existing') {
          return `existing:${item.id}`
        }
        const newIndex = newImageItems.findIndex((newItem) => newItem === item)
        return `new:${newIndex}`
      })
      imageOrder.forEach((order) => {
        formData.append('image_order[]', order)
      })

      Array.from(new Set(deletedImageIds)).forEach((imageId) => {
        formData.append('delete_image_ids[]', String(imageId))
      })

      const res = await fetch(
        `/api/proxy/ecommerce/store-locations/${storeId}`,
        {
          method: 'POST',
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
              .map(buildOpeningHourValue)
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
              <div className="flex flex-col gap-6">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-medium text-gray-700">Photos</h3>
                    <span className="text-xs text-gray-500">
                      {imageItems.length}/{MAX_IMAGES}
                    </span>
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

                  <div className="grid grid-cols-3 gap-3 mb-2">
                    {Array.from({ length: MAX_IMAGES }).map((_, slotIndex) => {
                      const imageInSlot = imageItems[slotIndex]
                      const isEmpty = !imageInSlot
                      const imageIndex = slotIndex

                      return (
                        <div
                          key={slotIndex}
                          className={`relative aspect-square rounded-xl border-2 border-dashed overflow-hidden transition-all duration-200 flex items-center justify-center ${
                            isEmpty
                              ? 'border-gray-300 bg-gray-50 hover:border-blue-400 hover:bg-blue-50/50 hover:shadow-md cursor-pointer'
                              : 'border-gray-200 bg-white shadow-md hover:shadow-lg'
                          }`}
                          onClick={() => {
                            if (isEmpty) {
                              if (imageItems.length < MAX_IMAGES) {
                                handleImageClick()
                              }
                            }
                          }}
                          onDragOver={(event) => {
                            if (draggingIndex !== null) {
                              event.preventDefault()
                              event.dataTransfer.dropEffect = 'move'
                            }
                          }}
                          onDrop={(event) => {
                            event.preventDefault()
                            if (draggingIndex !== null && draggingIndex !== imageIndex) {
                              handleImageReorder(draggingIndex, imageIndex)
                            }
                            setDraggingIndex(null)
                          }}
                        >
                          {isEmpty ? (
                            <div className="w-full h-full flex flex-col items-center justify-center p-2 group">
                              <div className="w-10 h-10 rounded-full bg-gray-100 group-hover:bg-blue-100 flex items-center justify-center mb-2 transition-all duration-200 group-hover:scale-110">
                                <i className="fa-solid fa-cloud-arrow-up text-gray-400 group-hover:text-blue-500 text-lg transition-colors duration-200" />
                              </div>
                              <span className="text-[10px] text-gray-500 group-hover:text-blue-600 text-center font-medium transition-colors duration-200">
                                {t('product.clickToUpload')}
                              </span>
                            </div>
                          ) : (
                            <div className="w-full h-full cursor-pointer group relative flex items-center justify-center">
                              <img
                                src={imageInSlot.preview}
                                alt="Store"
                                className="w-full h-full object-cover group-hover:opacity-90 transition-opacity duration-200"
                              />
                              <div className="absolute top-2 right-2 flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                                <div
                                  draggable
                                  onDragStart={(event) => {
                                    setDraggingIndex(imageIndex)
                                    event.dataTransfer.effectAllowed = 'move'
                                    event.stopPropagation()
                                  }}
                                  onDragEnd={() => {
                                    setDraggingIndex(null)
                                  }}
                                  className="w-8 h-8 bg-white/95 backdrop-blur-md text-gray-700 rounded-full flex items-center justify-center shadow-lg border border-gray-200/50 cursor-move hover:bg-white hover:shadow-xl transition-all duration-200 hover:scale-110"
                                  onClick={(event) => {
                                    event.stopPropagation()
                                  }}
                                >
                                  <i className="fa-solid fa-grip-vertical text-xs" />
                                </div>
                                <button
                                  type="button"
                                  onClick={(event) => {
                                    event.stopPropagation()
                                    handleReplaceImage(imageIndex)
                                  }}
                                  className="w-8 h-8 bg-blue-500/95 backdrop-blur-md text-white rounded-full flex items-center justify-center shadow-lg border border-blue-400/30 hover:bg-blue-600 hover:shadow-xl hover:scale-110 transition-all duration-200"
                                  aria-label="Replace image"
                                >
                                  <i className="fa-solid fa-image text-xs" />
                                </button>
                                <button
                                  type="button"
                                  onClick={(event) => {
                                    event.stopPropagation()
                                    handleRemoveImage(imageIndex)
                                  }}
                                  className="w-8 h-8 bg-red-500/95 backdrop-blur-md text-white rounded-full flex items-center justify-center shadow-lg border border-red-400/30 hover:bg-red-600 hover:shadow-xl hover:scale-110 transition-all duration-200"
                                  aria-label="Remove image"
                                >
                                  <i className="fa-solid fa-trash-can text-xs" />
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>

                  <div className="flex items-center justify-between text-xs text-gray-500">
                    <span className="inline-flex items-center gap-1">
                      <i className="fa-solid fa-info-circle" />
                      Click image to preview. Drag to reorder.
                    </span>
                    <span>
                      {imageItems.length} / {MAX_IMAGES}
                    </span>
                  </div>
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
                            value={value.label}
                            onChange={(event) =>
                              handleOpeningHourChange(index, 'label', event.target.value)
                            }
                            className="w-40 px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-blue-500 focus:border-blue-500"
                            placeholder="Label"
                            disabled={disableForm}
                          />
                          <span className="text-gray-500 text-sm">:</span>
                          <input
                            type="text"
                            value={value.time}
                            onChange={(event) =>
                              handleOpeningHourChange(index, 'time', event.target.value)
                            }
                            className="flex-1 px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-blue-500 focus:border-blue-500"
                            placeholder="Time"
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
