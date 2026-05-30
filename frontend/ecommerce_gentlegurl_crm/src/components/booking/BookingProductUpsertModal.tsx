'use client'

import { ChangeEvent, useEffect, useRef, useState } from 'react'

import BookingProductCategoriesPicker from './BookingProductCategoriesPicker'
import type { BookingProductCategory, BookingProductQuestion, BookingProductRowData } from './bookingProductTypes'
import { IMAGE_ACCEPT } from '../mediaAccept'

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
    const mappedQuestions: BookingProductQuestion[] = rawQuestions
      .map((question, qIdx) => {
        if (!question || typeof question !== 'object') return null
        const q = question as Record<string, unknown>
        const optionsRaw = Array.isArray(q.options) ? q.options : []
        return {
          id: Number(q.id ?? 0) || undefined,
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
              return {
                id: Number(o.id ?? 0) || undefined,
                label: String(o.label ?? '').trim(),
                cn_label: typeof o.cn_label === 'string' ? o.cn_label : null,
                extra_price: Number(o.extra_price ?? 0) || 0,
                sort_order: Number(o.sort_order ?? oIdx) || 0,
                is_active: Boolean(o.is_active ?? true),
              }
            })
            .filter((option): option is NonNullable<typeof option> => Boolean(option)),
        }
      })
      .filter((question): question is BookingProductQuestion => Boolean(question))

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
      if (imageFile) fd.append('image', imageFile)

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
      <div className="relative flex max-h-[100dvh] w-full max-w-5xl flex-col overflow-hidden rounded-t-2xl bg-white shadow-lg sm:max-h-[90vh] sm:rounded-lg">
        <div className="flex shrink-0 items-center justify-between border-b border-gray-300 px-4 py-4 sm:px-5 sticky top-0 bg-white z-10">
          <h2 className="text-lg font-semibold">
            {isEditing ? 'Edit Booking Product' : 'Create Booking Product'}
          </h2>
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

        <div className="min-h-0 flex-1 overflow-y-auto p-4 pb-6 sm:p-5 space-y-6">
          {error && (
            <div className="rounded border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </div>
          )}

          <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
            <div className="space-y-4 w-full lg:w-1/2">
              <div>
                <h3 className="text-sm font-medium text-gray-700 mb-1">Image</h3>
                <div
                  onClick={handleImageClick}
                  className={`relative border-2 border-dashed rounded-lg p-4 cursor-pointer transition-colors ${
                    displayImageUrl ? 'border-gray-300' : 'border-gray-300 hover:border-blue-400'
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
                    <div className="relative group">
                      <img
                        src={displayImageUrl}
                        alt="Product"
                        className="w-full h-48 object-contain rounded"
                      />
                      <div className="absolute top-2 right-2 flex items-center gap-2 opacity-100 transition-opacity duration-200 sm:opacity-0 sm:group-hover:opacity-100">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation()
                            handleImageClick()
                          }}
                          className="w-8 h-8 bg-blue-500/95 backdrop-blur-md text-white rounded-full flex items-center justify-center shadow-lg border border-blue-400/30 hover:bg-blue-600"
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
                          className="w-8 h-8 bg-red-500/95 backdrop-blur-md text-white rounded-full flex items-center justify-center shadow-lg border border-red-400/30 hover:bg-red-600"
                          aria-label="Remove new upload"
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

            <div className="space-y-4 w-full lg:w-1/2">
              <div>
                <label htmlFor="booking-product-name" className="block text-sm font-medium text-gray-700 mb-1">
                  Name <span className="text-red-500">*</span>
                </label>
                <input
                  id="booking-product-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Product name"
                  disabled={submitting}
                />
              </div>

              <div>
                <label htmlFor="booking-product-cn-name" className="block text-sm font-medium text-gray-700 mb-1">
                  Chinese Name
                </label>
                <input
                  id="booking-product-cn-name"
                  value={cnName}
                  onChange={(e) => setCnName(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-blue-500 focus:border-blue-500"
                  placeholder="中文名（可选）"
                  disabled={submitting}
                />
              </div>

              <div>
                <label htmlFor="booking-product-description" className="block text-sm font-medium text-gray-700 mb-1">
                  Description
                </label>
                <textarea
                  id="booking-product-description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Product description"
                  rows={3}
                  disabled={submitting}
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="booking-product-price" className="block text-sm font-medium text-gray-700 mb-1">
                    Price <span className="text-red-500">*</span>
                  </label>
                  <input
                    id="booking-product-price"
                    type="number"
                    min={0}
                    step="0.01"
                    value={price}
                    onChange={(e) => setPrice(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-blue-500 focus:border-blue-500"
                    disabled={submitting}
                  />
                </div>

                <div>
                  <label htmlFor="booking-product-barcode" className="block text-sm font-medium text-gray-700 mb-1">
                    Barcode
                  </label>
                  <input
                    id="booking-product-barcode"
                    value={barcode}
                    onChange={(e) => setBarcode(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-blue-500 focus:border-blue-500"
                    placeholder="Optional"
                    disabled={submitting}
                  />
                </div>
              </div>

              <div>
                <BookingProductCategoriesPicker
                  categories={categories}
                  value={categoryIds}
                  onChange={setCategoryIds}
                  disabled={submitting}
                  label="Categories"
                />
              </div>


              <div className="rounded-lg border border-gray-200 p-3 space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-gray-800">Questions / Add-ons</h3>
                  <button type="button" className="text-xs rounded bg-blue-50 text-blue-700 px-2 py-1" onClick={() => setQuestions((prev) => [...prev, { title: '', cn_title: '', description: '', cn_description: '', question_type: 'single_choice', sort_order: prev.length + 1, is_required: false, is_active: true, options: [] }])}>+ Add Question</button>
                </div>
                {questions.map((q, qi) => (
                  <div key={`q-${qi}`} className="rounded border border-gray-200 p-2 space-y-2">
                    <div className="flex justify-between"><p className="text-xs font-medium">Question {qi + 1}</p><button type="button" className="text-xs text-red-600" onClick={() => setQuestions((prev) => prev.filter((_, i) => i !== qi))}>Remove</button></div>
                    <input className="w-full border rounded px-2 py-1 text-sm" placeholder="Title" value={q.title} onChange={(e) => setQuestions(prev => prev.map((it,i)=> i===qi ? {...it,title:e.target.value}:it))} />
                    <input className="w-full border rounded px-2 py-1 text-sm" placeholder="中文标题" value={q.cn_title ?? ''} onChange={(e) => setQuestions(prev => prev.map((it,i)=> i===qi ? {...it,cn_title:e.target.value}:it))} />
                    <div className="grid grid-cols-2 gap-2"><select className="border rounded px-2 py-1 text-sm" value={q.question_type} onChange={(e)=>setQuestions(prev=>prev.map((it,i)=>i===qi?{...it,question_type:e.target.value as 'single_choice'|'multi_choice'}:it))}><option value="single_choice">single_choice</option><option value="multi_choice">multi_choice</option></select><button type="button" className="text-xs rounded border px-2" onClick={() => setQuestions(prev => prev.map((it,i)=> i===qi ? {...it,is_required:!it.is_required}:it))}>Required: {q.is_required ? 'Yes' : 'No'}</button></div>
                    <div className="space-y-1">{(q.options ?? []).map((opt, oi) => <div key={`o-${qi}-${oi}`} className="grid grid-cols-12 gap-1"><input className="col-span-4 border rounded px-1 py-1 text-xs" value={opt.label} placeholder="Label" onChange={(e)=>setQuestions(prev=>prev.map((it,i)=>i!==qi?it:{...it,options:it.options.map((o,j)=>j===oi?{...o,label:e.target.value}:o)}))}/><input className="col-span-3 border rounded px-1 py-1 text-xs" value={opt.cn_label ?? ''} placeholder="中文" onChange={(e)=>setQuestions(prev=>prev.map((it,i)=>i!==qi?it:{...it,options:it.options.map((o,j)=>j===oi?{...o,cn_label:e.target.value}:o)}))}/><input type="number" className="col-span-3 border rounded px-1 py-1 text-xs" value={opt.extra_price} placeholder="Extra" onChange={(e)=>setQuestions(prev=>prev.map((it,i)=>i!==qi?it:{...it,options:it.options.map((o,j)=>j===oi?{...o,extra_price:Number(e.target.value||0)}:o)}))}/><button type="button" className="col-span-2 text-red-600 text-xs" onClick={()=>setQuestions(prev=>prev.map((it,i)=>i!==qi?it:{...it,options:it.options.filter((_,j)=>j!==oi)}))}>X</button></div>)}</div>
                    <button type="button" className="text-xs rounded bg-gray-100 px-2 py-1" onClick={() => setQuestions(prev => prev.map((it,i)=>i!==qi?it:{...it,options:[...(it.options ?? []),{label:'',cn_label:'',extra_price:0,sort_order:(it.options?.length ?? 0)+1,is_active:true}]}))}>+ Add Option</button>
                  </div>
                ))}
              </div>

              <div>
                <label htmlFor="booking-product-status" className="block text-sm font-medium text-gray-700 mb-1">
                  Status
                </label>
                <select
                  id="booking-product-status"
                  value={isActive ? 'active' : 'inactive'}
                  onChange={(e) => setIsActive(e.target.value === 'active')}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-blue-500 focus:border-blue-500"
                  disabled={submitting}
                >
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                </select>
              </div>
            </div>
          </div>
        </div>

        <div className="flex shrink-0 items-center justify-end gap-2 border-t border-gray-300 bg-white px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:px-5 sm:py-4 sm:pb-4 sticky bottom-0">
          <button
            type="button"
            onClick={() => {
              if (!submitting) close()
            }}
            className="rounded border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
            disabled={submitting}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            className="rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
            disabled={submitting}
          >
            {submitting ? 'Saving…' : isEditing ? 'Update' : 'Create'}
          </button>
        </div>
      </div>
    </div>
  )
}
