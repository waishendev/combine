'use client'

import { ChangeEvent, useEffect, useRef, useState } from 'react'

import BookingProductCategoriesPicker from './BookingProductCategoriesPicker'
import BookingProductQuestionsBuilder from './BookingProductQuestionsBuilder'
import type { BookingProductCategory, BookingProductQuestion, BookingProductRowData } from './bookingProductTypes'
import { IMAGE_ACCEPT } from '../mediaAccept'
import { compressImage } from '@/lib/compressImage'

const fieldClass =
  'w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm placeholder:text-gray-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 disabled:bg-gray-50 disabled:text-gray-500'

type Props = {
  show: boolean
  categories: BookingProductCategory[]
  product?: BookingProductRowData | null
  onClose: () => void
  onSuccess: () => Promise<void> | void
}

export default function BookingProductUpsertModal({
  show,
  categories,
  product,
  onClose,
  onSuccess,
}: Props) {
  const isEditing = Boolean(product?.id)
  const [name, setName] = useState('')
  const [cnName, setCnName] = useState('')
  const [price, setPrice] = useState('0')
  const [barcode, setBarcode] = useState('')
  const [description, setDescription] = useState('')
  const [categoryIds, setCategoryIds] = useState<number[]>([])
  const [isActive, setIsActive] = useState(true)
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [questions, setQuestions] = useState<BookingProductQuestion[]>([])
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const imageInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!show) return
    const rawQuestions = Array.isArray((product as { questions?: unknown[] } | null)?.questions)
      ? ((product as { questions?: unknown[] }).questions ?? [])
      : []
    const mappedQuestions = rawQuestions
      .map((question, qIdx) => {
        if (!question || typeof question !== 'object') return null
        const q = question as Record<string, unknown>
        const optionsRaw = Array.isArray(q.options) ? q.options : []
        const questionId = Number(q.id ?? 0)
        const mapped: BookingProductQuestion = {
          ...(questionId > 0 ? { id: questionId } : {}),
          title: String(q.title ?? '').trim(),
          cn_title: typeof q.cn_title === 'string' ? q.cn_title : null,
          description: typeof q.description === 'string' ? q.description : null,
          cn_description: typeof q.cn_description === 'string' ? q.cn_description : null,
          question_type: q.question_type === 'multi_choice' ? 'multi_choice' : 'single_choice',
          sort_order: Number(q.sort_order ?? qIdx) || 0,
          is_required: Boolean(q.is_required ?? false),
          is_active: Boolean(q.is_active ?? true),
          options: optionsRaw
            .map((option, oIdx) => {
              if (!option || typeof option !== 'object') return null
              const o = option as Record<string, unknown>
              const optionId = Number(o.id ?? 0)
              return {
                ...(optionId > 0 ? { id: optionId } : {}),
                label: String(o.label ?? '').trim(),
                cn_label: typeof o.cn_label === 'string' ? o.cn_label : null,
                extra_price: Number(o.extra_price ?? 0) || 0,
                sort_order: Number(o.sort_order ?? oIdx) || 0,
                is_active: Boolean(o.is_active ?? true),
              }
            })
            .filter((option): option is NonNullable<typeof option> => Boolean(option)),
        }
        return mapped
      })
      .filter((question): question is BookingProductQuestion => question !== null)

    setName(product?.name ?? '')
    setCnName(product?.cn_name ?? '')
    setPrice(String(product?.price ?? 0))
    setBarcode(product?.barcode ?? '')
    setDescription(product?.description ?? '')
    setCategoryIds(Array.isArray(product?.categories) ? product.categories.map((c) => Number(c.id)) : [])
    setIsActive(Boolean(product?.is_active ?? true))
    setQuestions(mappedQuestions)
    setImageFile(null)
    setPreviewUrl(null)
    setError(null)
  }, [show, product])

  const revokePreview = () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl)
  }

  const close = () => {
    revokePreview()
    onClose()
  }

  const handleImageChange = (event: ChangeEvent<HTMLInputElement>) => {
    const f = event.target.files?.[0] ?? null
    revokePreview()
    setImageFile(f)
    setPreviewUrl(f ? URL.createObjectURL(f) : null)
  }

  const handleImageClick = () => imageInputRef.current?.click()

  const handleRemoveImage = () => {
    revokePreview()
    setImageFile(null)
    setPreviewUrl(null)
    if (imageInputRef.current) imageInputRef.current.value = ''
  }

  const displayImageUrl = previewUrl || product?.image_url || null

  const handleSubmit = async () => {
    setError(null)
    const trimmedName = name.trim()
    if (!trimmedName) {
      setError('Name is required.')
      return
    }
    const p = Number(price)
    if (!Number.isFinite(p) || p < 0) {
      setError('Price must be 0 or greater.')
      return
    }

    setSubmitting(true)
    try {
      const fd = new FormData()
      fd.append('name', trimmedName)
      if (cnName.trim()) fd.append('cn_name', cnName.trim())
      fd.append('price', String(p))
      if (barcode.trim()) fd.append('barcode', barcode.trim())
      if (description.trim()) fd.append('description', description.trim())
      fd.append('is_active', isActive ? '1' : '0')
      categoryIds.forEach((id) => fd.append('category_ids[]', String(id)))
      if (imageFile) {
        const compressed = await compressImage(imageFile)
        fd.append('image', compressed)
      }

      questions.forEach((q, qi) => {
        if (!q.title?.trim()) return
        if (q.id) fd.append(`questions[${qi}][id]`, String(q.id))
        fd.append(`questions[${qi}][title]`, q.title)
        if (q.cn_title?.trim()) fd.append(`questions[${qi}][cn_title]`, q.cn_title)
        if (q.description?.trim()) fd.append(`questions[${qi}][description]`, q.description)
        if (q.cn_description?.trim()) fd.append(`questions[${qi}][cn_description]`, q.cn_description)
        fd.append(`questions[${qi}][question_type]`, q.question_type)
        fd.append(`questions[${qi}][sort_order]`, String(q.sort_order ?? 0))
        fd.append(`questions[${qi}][is_required]`, q.is_required ? '1' : '0')
        fd.append(`questions[${qi}][is_active]`, q.is_active ? '1' : '0')
        ;(q.options ?? []).forEach((opt, oi) => {
          if (!opt.label?.trim()) return
          if (opt.id) fd.append(`questions[${qi}][options][${oi}][id]`, String(opt.id))
          fd.append(`questions[${qi}][options][${oi}][label]`, opt.label)
          if (opt.cn_label?.trim()) fd.append(`questions[${qi}][options][${oi}][cn_label]`, opt.cn_label)
          fd.append(`questions[${qi}][options][${oi}][extra_price]`, String(opt.extra_price ?? 0))
          fd.append(`questions[${qi}][options][${oi}][sort_order]`, String(opt.sort_order ?? 0))
          fd.append(`questions[${qi}][options][${oi}][is_active]`, opt.is_active ? '1' : '0')
        })
      })

      if (isEditing && product?.id) fd.append('_method', 'PUT')

      const url =
        isEditing && product?.id
          ? `/api/proxy/admin/booking/products/${product.id}`
          : '/api/proxy/admin/booking/products'

      const res = await fetch(url, {
        method: 'POST',
        headers: { Accept: 'application/json' },
        body: fd,
      })
      const json = await res.json().catch(() => null)
      if (!res.ok) {
        const firstError =
          json && typeof json === 'object' && 'errors' in json && json.errors && typeof json.errors === 'object'
            ? Object.values(json.errors as Record<string, unknown[]>)[0]
            : null
        const msg =
          (json &&
            (json.message ||
              (Array.isArray(firstError) ? firstError[0] : null))) ||
          'Failed to save booking product.'
        setError(typeof msg === 'string' ? msg : 'Failed to save booking product.')
        return
      }

      await onSuccess()
      close()
    } catch (e) {
      console.error(e)
      setError('Failed to save booking product.')
    } finally {
      setSubmitting(false)
    }
  }

  if (!show) return null

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-4">
      <div
        className="absolute inset-0 bg-black/50"
        onClick={() => {
          if (!submitting) close()
        }}
      />
      <div className="relative flex max-h-[100dvh] w-full max-w-4xl flex-col overflow-hidden rounded-t-2xl bg-slate-50 shadow-xl sm:max-h-[92vh] sm:rounded-2xl">
        <div className="sticky top-0 z-10 flex shrink-0 items-center justify-between border-b border-gray-200 bg-white px-4 py-4 sm:px-6">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">
              {isEditing ? 'Edit Booking Product' : 'Create Booking Product'}
            </h2>
            <p className="mt-0.5 text-sm text-gray-500">Product details, pricing, and optional add-on questions.</p>
          </div>
          <button
            onClick={() => {
              if (!submitting) close()
            }}
            className="text-gray-500 hover:text-gray-700 text-2xl leading-none"
            aria-label="Close modal"
            type="button"
          >
            <i className="fa-solid fa-xmark" />
          </button>
        </div>

        <div className="min-h-0 flex-1 space-y-5 overflow-y-auto p-4 pb-6 sm:p-6">
          {error ? (
            <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          ) : null}

          <section className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm sm:p-5">
            <h3 className="mb-4 text-sm font-semibold uppercase tracking-wide text-gray-500">Basic information</h3>

            <div className="grid gap-5 lg:grid-cols-[220px_minmax(0,1fr)]">
              <div>
                <p className="mb-2 text-sm font-medium text-gray-700">Image</p>
                <div
                  onClick={handleImageClick}
                  className={`relative cursor-pointer rounded-xl border-2 border-dashed p-3 transition-colors ${
                    displayImageUrl
                      ? 'border-gray-200 bg-gray-50'
                      : 'border-gray-300 bg-gray-50/50 hover:border-blue-400 hover:bg-blue-50/30'
                  }`}
                >
                  <input
                    ref={imageInputRef}
                    type="file"
                    accept={IMAGE_ACCEPT}
                    onChange={handleImageChange}
                    className="hidden"
                    disabled={submitting}
                  />
                  {displayImageUrl ? (
                    <div className="group relative">
                      <img
                        src={displayImageUrl}
                        alt="Product"
                        className="h-44 w-full rounded-lg object-contain"
                      />
                      <div className="absolute right-2 top-2 flex items-center gap-2 opacity-100 transition-opacity sm:opacity-0 sm:group-hover:opacity-100">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation()
                            handleImageClick()
                          }}
                          className="flex h-8 w-8 items-center justify-center rounded-full border border-blue-400/30 bg-blue-500/95 text-white shadow-lg backdrop-blur-md hover:bg-blue-600"
                          aria-label="Replace image"
                          disabled={submitting}
                        >
                          <i className="fa-solid fa-image text-xs" />
                        </button>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation()
                            handleRemoveImage()
                          }}
                          className="flex h-8 w-8 items-center justify-center rounded-full border border-red-400/30 bg-red-500/95 text-white shadow-lg backdrop-blur-md hover:bg-red-600"
                          aria-label="Remove new upload"
                          disabled={submitting}
                        >
                          <i className="fa-solid fa-trash-can text-xs" />
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center py-10">
                      <i className="fa-solid fa-cloud-arrow-up mb-2 text-3xl text-gray-400" />
                      <p className="text-sm font-medium text-gray-600">Upload image</p>
                      <p className="mt-1 text-xs text-gray-400">Click to browse</p>
                    </div>
                  )}
                </div>
              </div>

              <div className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label htmlFor="booking-product-name" className="mb-1.5 block text-sm font-medium text-gray-700">
                      Name <span className="text-red-500">*</span>
                    </label>
                    <input
                      id="booking-product-name"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className={fieldClass}
                      placeholder="Product name"
                      disabled={submitting}
                    />
                  </div>
                  <div>
                    <label htmlFor="booking-product-cn-name" className="mb-1.5 block text-sm font-medium text-gray-700">
                      Chinese name
                    </label>
                    <input
                      id="booking-product-cn-name"
                      value={cnName}
                      onChange={(e) => setCnName(e.target.value)}
                      className={fieldClass}
                      placeholder="中文名（可选）"
                      disabled={submitting}
                    />
                  </div>
                </div>

                <div>
                  <label htmlFor="booking-product-description" className="mb-1.5 block text-sm font-medium text-gray-700">
                    Description
                  </label>
                  <textarea
                    id="booking-product-description"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    className={fieldClass}
                    placeholder="Product description"
                    rows={3}
                    disabled={submitting}
                  />
                </div>

                <BookingProductCategoriesPicker
                  categories={categories}
                  value={categoryIds}
                  onChange={setCategoryIds}
                  disabled={submitting}
                  label="Categories"
                />
              </div>
            </div>
          </section>

          <section className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm sm:p-5">
            <h3 className="mb-4 text-sm font-semibold uppercase tracking-wide text-gray-500">Pricing & inventory</h3>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <div>
                <label htmlFor="booking-product-price" className="mb-1.5 block text-sm font-medium text-gray-700">
                  Price <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-gray-400">
                    RM
                  </span>
                  <input
                    id="booking-product-price"
                    type="number"
                    min={0}
                    step="0.01"
                    value={price}
                    onChange={(e) => setPrice(e.target.value)}
                    className={`${fieldClass} pl-10`}
                    disabled={submitting}
                  />
                </div>
              </div>
              <div>
                <label htmlFor="booking-product-barcode" className="mb-1.5 block text-sm font-medium text-gray-700">
                  Barcode
                </label>
                <input
                  id="booking-product-barcode"
                  value={barcode}
                  onChange={(e) => setBarcode(e.target.value)}
                  className={fieldClass}
                  placeholder="Optional SKU / barcode"
                  disabled={submitting}
                />
              </div>
              <div className="sm:col-span-2 lg:col-span-1">
                <label htmlFor="booking-product-status" className="mb-1.5 block text-sm font-medium text-gray-700">
                  Status
                </label>
                <select
                  id="booking-product-status"
                  value={isActive ? 'active' : 'inactive'}
                  onChange={(e) => setIsActive(e.target.value === 'active')}
                  className={fieldClass}
                  disabled={submitting}
                >
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                </select>
              </div>
            </div>
          </section>

          <section className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm sm:p-5">
            <BookingProductQuestionsBuilder
              value={questions}
              onChange={setQuestions}
              disabled={submitting}
            />
          </section>
        </div>

        <div className="sticky bottom-0 flex shrink-0 items-center justify-end gap-2 border-t border-gray-200 bg-white px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:px-6 sm:py-4 sm:pb-4">
          <button
            type="button"
            onClick={() => {
              if (!submitting) close()
            }}
            className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            disabled={submitting}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            className="rounded-lg bg-blue-600 px-5 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-700 disabled:opacity-50"
            disabled={submitting}
          >
            {submitting ? 'Saving…' : isEditing ? 'Update product' : 'Create product'}
          </button>
        </div>
      </div>
    </div>
  )
}
