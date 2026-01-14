'use client'

import { ChangeEvent, FormEvent, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'

import { mapProductApiItemToRow, type ProductApiItem } from './productUtils'
import type { ProductImage, ProductRowData, ProductVideo } from './ProductRow'
import { useI18n } from '@/lib/i18n'
import { Switch } from '@/components/ui/switch'
import ErrorBox from './ErrorBox'

interface CategoryOption {
  id: number
  name: string
}

type ProductFormMode = 'create' | 'edit'

type PendingImageUpload = {
  id: string
  file: File
  preview: string
  progress: number
  status: 'pending' | 'uploading' | 'failed'
}

type PendingVideoUpload = {
  file: File
  preview: string
  progress: number
  status: 'pending' | 'uploading' | 'failed'
}

type VariantFormValue = {
  id?: number
  name: string
  sku: string
  price: string
  costPrice: string
  stock: string
  lowStockThreshold: string
  trackStock: boolean
  isActive: boolean
  sortOrder: number
  imageUrl?: string | null
  imageFile?: File | null
  imagePreview?: string | null
  removeImage?: boolean
}

type ProductFormValues = {
  name: string
  slug: string
  sku: string
  type: string
  description: string
  price: string
  costPrice: string
  stock: string
  lowStockThreshold: string
  dummySoldCount: string
  isFeatured: boolean
  metaTitle: string
  metaDescription: string
  metaKeywords: string
  metaOgImage: string
  status: 'active' | 'inactive'
  categoryIds: number[]
  metaOgImageFile?: File | null
}

const emptyForm: ProductFormValues = {
  name: '',
  slug: '',
  sku: '',
  type: 'single',
  description: '',
  price: '',
  costPrice: '',
  stock: '',
  lowStockThreshold: '',
  dummySoldCount: '',
  isFeatured: false,
  metaTitle: '',
  metaDescription: '',
  metaKeywords: '',
  metaOgImage: '',
  status: 'active',
  categoryIds: [],
  metaOgImageFile: null,
}

const emptyVariant = (sortOrder = 0): VariantFormValue => ({
  name: '',
  sku: '',
  price: '',
  costPrice: '',
  stock: '',
  lowStockThreshold: '',
  trackStock: true,
  isActive: true,
  sortOrder,
  imageUrl: null,
  imageFile: null,
  imagePreview: null,
  removeImage: false,
})

type RewardFormValues = {
  title: string
  description: string
  pointsRequired: string
  status: 'active' | 'inactive'
}

const emptyRewardForm: RewardFormValues = {
  title: '',
  description: '',
  pointsRequired: '',
  status: 'active',
}

interface ProductFormProps {
  mode: ProductFormMode
  product?: ProductRowData | null
  onSuccess?: (product: ProductRowData) => void
  onCancel?: () => void
  redirectPath?: string
  showCategories?: boolean
  showFeatured?: boolean
  rewardOnly?: boolean
}

export default function ProductForm({
  mode,
  product,
  onSuccess,
  onCancel,
  redirectPath,
  showCategories = true,
  showFeatured = true,
  rewardOnly = false,
}: ProductFormProps) {
  const { t } = useI18n()
  const router = useRouter()
  const [form, setForm] = useState<ProductFormValues>(() => {
    if (mode === 'edit' && product) {
      return {
        name: product.name,
        slug: product.slug,
        sku: product.sku,
        type: product.type || 'single',
        description: product.description,
        price: product.price ? String(product.price) : '',
        costPrice: product.costPrice ? String(product.costPrice) : '',
        stock: product.stock ? String(product.stock) : '',
        lowStockThreshold: product.lowStockThreshold
          ? String(product.lowStockThreshold)
          : '',
        dummySoldCount: product.dummySoldCount !== undefined
          ? String(product.dummySoldCount)
          : '',
        isFeatured: showFeatured ? product.isFeatured : false,
        metaTitle: product.metaTitle,
        metaDescription: product.metaDescription,
        metaKeywords: product.metaKeywords,
        metaOgImage: product.metaOgImage,
        status: product.isActive ? 'active' : 'inactive',
        categoryIds: showCategories ? (product.categoryIds ?? []) : [],
        metaOgImageFile: null,
      }
    }
    return {
      ...emptyForm,
      isFeatured: showFeatured ? emptyForm.isFeatured : false,
      categoryIds: showCategories ? emptyForm.categoryIds : [],
    }
  })
  const [rewardForm, setRewardForm] = useState<RewardFormValues>({ ...emptyRewardForm })
  const [rewardId, setRewardId] = useState<number | null>(null)
  const [existingImages, setExistingImages] = useState<ProductImage[]>(
    product?.images ?? [],
  )
  const [pendingImages, setPendingImages] = useState<PendingImageUpload[]>([])
  const [pendingVideo, setPendingVideo] = useState<PendingVideoUpload | null>(null)
  const [existingVideo, setExistingVideo] = useState<ProductVideo | null>(
    product?.video ?? null,
  )
  const [variants, setVariants] = useState<VariantFormValue[]>(() => {
    if (mode === 'edit' && product?.variants?.length) {
      return product.variants.map((variant, index) => ({
        id: variant.id,
        name: variant.name ?? '',
        sku: variant.sku ?? '',
        price: variant.price !== null && variant.price !== undefined ? String(variant.price) : '',
        costPrice:
          variant.costPrice !== null && variant.costPrice !== undefined
            ? String(variant.costPrice)
            : '',
        stock: variant.stock !== null && variant.stock !== undefined ? String(variant.stock) : '',
        lowStockThreshold:
          variant.lowStockThreshold !== null && variant.lowStockThreshold !== undefined
            ? String(variant.lowStockThreshold)
            : '',
        trackStock: variant.trackStock ?? true,
        isActive: variant.isActive ?? true,
        sortOrder: variant.sortOrder ?? index,
        imageUrl: variant.imageUrl ?? null,
        imageFile: null,
        imagePreview: null,
        removeImage: false,
      }))
    }
    return []
  })
  const pendingImagesRef = useRef<PendingImageUpload[]>([])
  const [draggingIndex, setDraggingIndex] = useState<number | null>(null)
  const [draggingType, setDraggingType] = useState<'new' | 'existing' | null>(null)
  const [categories, setCategories] = useState<CategoryOption[]>([])
  const [loadingCategories, setLoadingCategories] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isCategoryDropdownOpen, setIsCategoryDropdownOpen] = useState(false)
  const [categorySearchQuery, setCategorySearchQuery] = useState('')
  const [isSeoMetadataOpen, setIsSeoMetadataOpen] = useState(false)
  const [createdProductId, setCreatedProductId] = useState<number | null>(null)
  const categoryDropdownRef = useRef<HTMLDivElement>(null)
  const categorySearchRef = useRef<HTMLInputElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const videoInputRef = useRef<HTMLInputElement>(null)
  const metaOgImageFileInputRef = useRef<HTMLInputElement>(null)
  const [metaOgImagePreview, setMetaOgImagePreview] = useState<string | null>(null)
  const metaOgImagePreviewRef = useRef<string | null>(null)
  const [previewImage, setPreviewImage] = useState<{
    type: 'new' | 'existing'
    src: string
    index: number
  } | null>(null)

  // Close category dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        categoryDropdownRef.current &&
        !categoryDropdownRef.current.contains(event.target as Node)
      ) {
        setIsCategoryDropdownOpen(false)
        setCategorySearchQuery('')
      }
    }

    if (isCategoryDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside)
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isCategoryDropdownOpen])

  useEffect(() => {
    return () => {
      variants.forEach((variant) => {
        if (variant.imagePreview) {
          URL.revokeObjectURL(variant.imagePreview)
        }
      })
    }
  }, [variants])

  useEffect(() => {
    if (form.type === 'variant' && variants.length === 0) {
      setVariants([emptyVariant(0)])
    }
  }, [form.type, variants.length])

  useEffect(() => {
    if (!showCategories) {
      return undefined
    }
    const controller = new AbortController()
    const fetchCategories = async () => {
      setLoadingCategories(true)
      try {
        const res = await fetch('/api/proxy/ecommerce/categories?page=1&per_page=200', {
          cache: 'no-store',
          signal: controller.signal,
        })

        if (!res.ok) return

        const data = await res.json().catch(() => ({}))
        if (data?.success === false && data?.message === 'Unauthorized') {
          window.location.replace('/dashboard')
          return
        }

        if (data?.data) {
          let categoryData: CategoryOption[] = []
          if (Array.isArray(data.data)) {
            categoryData = data.data
          } else if (typeof data.data === 'object' && 'data' in data.data) {
            categoryData = data.data.data
          }

          setCategories(
            categoryData
              .map((item: { id?: number | string | null; name?: string | null }) => ({
                id:
                  typeof item.id === 'number'
                    ? item.id
                    : Number(item.id) || Number.parseInt(String(item.id), 10) || 0,
                name: item.name || '',
              }))
              .filter((item) => item.id > 0 && item.name)
          )
        }
      } catch (err) {
        if (!(err instanceof DOMException && err.name === 'AbortError')) {
          console.error(err)
        }
      } finally {
        if (!controller.signal.aborted) {
          setLoadingCategories(false)
        }
      }
    }

    fetchCategories()
    return () => controller.abort()
  }, [showCategories])

  useEffect(() => {
    setExistingImages(product?.images ?? [])
    setExistingVideo(product?.video ?? null)
    setPendingImages([])
    setPendingVideo(null)
    if (mode === 'edit' && product) {
      setForm((prev) => ({ ...prev }))
    }
  }, [mode, product])

  useEffect(() => {
    if (!rewardOnly) {
      return undefined
    }

    if (mode !== 'edit' || !product?.id) {
      setRewardForm({ ...emptyRewardForm })
      setRewardId(null)
      return undefined
    }

    const controller = new AbortController()
    const fetchReward = async () => {
      try {
        const res = await fetch(
          '/api/proxy/ecommerce/loyalty/rewards?type=product&per_page=200',
          {
            cache: 'no-store',
            signal: controller.signal,
          },
        )

        if (!res.ok) return

        const data = await res.json().catch(() => null)
        if (data?.success === false && data?.message === 'Unauthorized') {
          window.location.replace('/dashboard')
          return
        }

        const list = Array.isArray(data?.data)
          ? data.data
          : Array.isArray(data?.data?.data)
            ? data.data.data
            : []

        const match = list.find(
          (item: { product_id?: number | string | null }) =>
            Number(item?.product_id) === Number(product.id),
        )

        if (match) {
          setRewardId(
            typeof match.id === 'number'
              ? match.id
              : Number(match.id) || Number.parseInt(String(match.id), 10),
          )
          setRewardForm({
            title: match.title ?? '',
            description: match.description ?? '',
            pointsRequired:
              match.points_required != null ? String(match.points_required) : '',
            status:
              match.is_active === false ||
              match.is_active === 0 ||
              match.is_active === '0' ||
              match.is_active === 'false'
                ? 'inactive'
                : 'active',
          })
        }
      } catch (error) {
        if (!(error instanceof DOMException && error.name === 'AbortError')) {
          console.error(error)
        }
      }
    }

    fetchReward()
    return () => controller.abort()
  }, [mode, product?.id, rewardOnly])

  // Keep track of the latest previews for cleanup on unmount
  useEffect(() => {
    pendingImagesRef.current = pendingImages
  }, [pendingImages])

  // Keep track of meta OG image preview for cleanup
  useEffect(() => {
    metaOgImagePreviewRef.current = metaOgImagePreview
  }, [metaOgImagePreview])

  // Clean up object URLs on unmount
  useEffect(() => {
    return () => {
      pendingImagesRef.current.forEach((item) => {
        if (item.preview) {
          URL.revokeObjectURL(item.preview)
        }
      })
      if (pendingVideo?.preview) {
        URL.revokeObjectURL(pendingVideo.preview)
      }
      if (metaOgImagePreviewRef.current) {
        URL.revokeObjectURL(metaOgImagePreviewRef.current)
      }
    }
  }, [pendingVideo])

  const handleChange = (
    event: ChangeEvent<
      HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
    >,
  ) => {
    const target = event.target
    const { name, value, type } = target
    const checked = 'checked' in target ? target.checked : false
    setForm((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }))
  }

  const handleCategoryToggle = (id: number) => {
    setForm((prev) => {
      const exists = prev.categoryIds.includes(id)
      const categoryIds = exists
        ? prev.categoryIds.filter((item) => item !== id)
        : [...prev.categoryIds, id]
      return { ...prev, categoryIds }
    })
  }

  const handleSelectAllCategories = () => {
    const filteredCategories = categorySearchQuery
      ? categories.filter((cat) =>
          cat.name.toLowerCase().includes(categorySearchQuery.toLowerCase())
        )
      : categories

    const allFilteredIds = filteredCategories.map((cat) => cat.id)
    const allSelected = allFilteredIds.every((id) =>
      form.categoryIds.includes(id)
    )

    setForm((prev) => {
      if (allSelected) {
        // Deselect all filtered categories
        return {
          ...prev,
          categoryIds: prev.categoryIds.filter(
            (id) => !allFilteredIds.includes(id)
          ),
        }
      } else {
        // Select all filtered categories (merge with existing)
        const newIds = allFilteredIds.filter(
          (id) => !prev.categoryIds.includes(id)
        )
        return { ...prev, categoryIds: [...prev.categoryIds, ...newIds] }
      }
    })
  }

  const handleClearAllCategories = () => {
    setForm((prev) => ({ ...prev, categoryIds: [] }))
  }

  const filteredCategories = useMemo(() => {
    if (!categorySearchQuery.trim()) return categories
    return categories.filter((cat) =>
      cat.name.toLowerCase().includes(categorySearchQuery.toLowerCase())
    )
  }, [categories, categorySearchQuery])

  const handleMetaFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] || null
    if (file) {
      // Clean up old preview
      if (metaOgImagePreview) {
        URL.revokeObjectURL(metaOgImagePreview)
      }
      // Create new preview
      const preview = URL.createObjectURL(file)
      setMetaOgImagePreview(preview)
      setForm((prev) => ({ ...prev, metaOgImageFile: file, metaOgImage: '' }))
    }
  }

  const handleMetaImageRemove = (e?: React.MouseEvent) => {
    if (e) {
      e.stopPropagation()
    }
    if (metaOgImagePreview) {
      URL.revokeObjectURL(metaOgImagePreview)
      setMetaOgImagePreview(null)
    }
    setForm((prev) => ({ ...prev, metaOgImageFile: null, metaOgImage: '' }))
    if (metaOgImageFileInputRef.current) {
      metaOgImageFileInputRef.current.value = ''
    }
  }

  const MAX_IMAGES = 6
  const IMAGE_MAX_MB = 10
  const VIDEO_MAX_MB = 50
  const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp']
  const VIDEO_TYPES = ['video/mp4', 'video/quicktime']

  const activeProductId = product?.id ?? createdProductId

  const formatBytes = (bytes?: number) => {
    if (!bytes) return ''
    const units = ['B', 'KB', 'MB', 'GB']
    let value = bytes
    let index = 0
    while (value >= 1024 && index < units.length - 1) {
      value /= 1024
      index += 1
    }
    return `${value.toFixed(1)} ${units[index]}`
  }

  const getFileNameFromUrl = (url?: string) => {
    if (!url) return ''
    const baseUrl = url.split('?')[0] ?? url
    const parts = baseUrl.split('/')
    return parts[parts.length - 1] ?? ''
  }

  const uploadMediaFile = (
    mediaType: 'image' | 'video',
    file: File,
    onProgress: (progress: number) => void,
    productId?: number,
  ) => {
    const targetProductId = productId ?? activeProductId
    if (!targetProductId) {
      return Promise.reject(new Error('Product ID is missing.'))
    }

    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest()
      xhr.open('POST', `/api/proxy/ecommerce/products/${targetProductId}/media`)
      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          try {
            resolve(JSON.parse(xhr.responseText))
          } catch (error) {
            reject(error)
          }
        } else {
          reject(new Error(xhr.responseText))
        }
      }
      xhr.onerror = () => reject(new Error('Upload failed.'))
      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable) {
          const percent = Math.round((event.loaded / event.total) * 100)
          onProgress(percent)
        }
      }
      const formData = new FormData()
      formData.append('type', mediaType)
      formData.append('file', file)
      xhr.send(formData)
    })
  }

  const buildImageFromResponse = (payload: { data?: unknown } | unknown) => {
    const media =
      payload && typeof payload === 'object' && 'data' in payload
        ? (payload as { data?: unknown }).data
        : payload
    if (!media || typeof media !== 'object') return null
    const item = media as {
      id?: number | string
      url?: string | null
      sort_order?: number | string | null
      size_bytes?: number | string | null
    }
    const id =
      typeof item.id === 'number' ? item.id : Number(item.id) || Number.parseInt(String(item.id ?? ''), 10)
    return {
      id: Number.isFinite(id) ? id : 0,
      url: item.url ?? '',
      isMain: typeof item.sort_order === 'number'
        ? item.sort_order === 0
        : typeof item.sort_order === 'string'
          ? Number.parseInt(item.sort_order, 10) === 0
          : false,
      sortOrder:
        typeof item.sort_order === 'number'
          ? item.sort_order
          : typeof item.sort_order === 'string'
            ? Number.parseInt(item.sort_order, 10)
            : 0,
      sizeBytes:
        typeof item.size_bytes === 'number'
          ? item.size_bytes
          : typeof item.size_bytes === 'string'
            ? Number.parseInt(item.size_bytes, 10)
            : undefined,
    }
  }

  const buildVideoFromResponse = (payload: { data?: unknown } | unknown): ProductVideo | null => {
    const media =
      payload && typeof payload === 'object' && 'data' in payload
        ? (payload as { data?: unknown }).data
        : payload
    if (!media || typeof media !== 'object') return null
    const item = media as {
      id?: number | string
      url?: string | null
      thumbnail_url?: string | null
      status?: string | null
      size_bytes?: number | string | null
      duration_seconds?: number | string | null
      width?: number | string | null
      height?: number | string | null
    }
    const id =
      typeof item.id === 'number' ? item.id : Number(item.id) || Number.parseInt(String(item.id ?? ''), 10)
    return {
      id: Number.isFinite(id) ? id : 0,
      url: item.url ?? '',
      thumbnailUrl: item.thumbnail_url ?? undefined,
      status: item.status ?? undefined,
      sizeBytes:
        typeof item.size_bytes === 'number'
          ? item.size_bytes
          : typeof item.size_bytes === 'string'
            ? Number.parseInt(item.size_bytes, 10)
            : undefined,
      durationSeconds:
        typeof item.duration_seconds === 'number'
          ? item.duration_seconds
          : typeof item.duration_seconds === 'string'
            ? Number.parseFloat(item.duration_seconds)
            : undefined,
      width:
        typeof item.width === 'number'
          ? item.width
          : typeof item.width === 'string'
            ? Number.parseInt(item.width, 10)
            : undefined,
      height:
        typeof item.height === 'number'
          ? item.height
          : typeof item.height === 'string'
            ? Number.parseInt(item.height, 10)
            : undefined,
    }
  }

  const handleGalleryChange = (event: ChangeEvent<HTMLInputElement>) => {
    const newFiles = event.target.files ? Array.from(event.target.files) : []
    if (newFiles.length === 0) return

    const currentTotal = pendingImages.length + existingImages.length
    const remainingSlots = MAX_IMAGES - currentTotal

    if (remainingSlots <= 0) {
      alert(t('product.maxImagesAlert').replace('{count}', String(MAX_IMAGES)))
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
      return
    }

    const filesToAdd = newFiles.slice(0, remainingSlots)
    if (newFiles.length > remainingSlots) {
      const plural = remainingSlots === 1 ? '' : 's'
      alert(
        t('product.maxImagesAddAlert')
          .replace('{count}', String(remainingSlots))
          .replace('{plural}', plural),
      )
    }

    const validFiles = filesToAdd.filter((file) => {
      const isValidType = IMAGE_TYPES.includes(file.type)
      const isValidSize = file.size <= IMAGE_MAX_MB * 1024 * 1024
      return isValidType && isValidSize
    })

    if (validFiles.length !== filesToAdd.length) {
      setError(t('product.invalidImage'))
    }

    const newUploads = validFiles.map((file) => ({
      id: crypto.randomUUID(),
      file,
      preview: URL.createObjectURL(file),
      progress: 0,
      status: 'pending' as const,
    }))

    setPendingImages((prev) => [...prev, ...newUploads])

    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  const persistImageOrder = async (images: ProductImage[]) => {
    if (!activeProductId) return

    const items = images.map((image, index) => ({
      id: image.id,
      sort_order: index,
    }))

    await fetch(`/api/proxy/ecommerce/products/${activeProductId}/media/reorder`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ items }),
    })
  }

  const handleGalleryReorder = (
    fromIndex: number,
    toSlotIndex: number,
    fromType: 'new' | 'existing' = 'new',
  ) => {
    const existingCount = existingImages.length

    if (fromType === 'existing') {
      if (fromIndex < 0 || fromIndex >= existingCount) return

      const imageToMove = existingImages[fromIndex]
      if (!imageToMove) return

      const newExisting = [...existingImages]
      newExisting.splice(fromIndex, 1)

      if (toSlotIndex < existingCount) {
        const targetIndex = Math.max(0, Math.min(toSlotIndex, newExisting.length))
        newExisting.splice(targetIndex, 0, imageToMove)
      } else {
        newExisting.push(imageToMove)
      }

      const reordered = newExisting.map((image, index) => ({
        ...image,
        sortOrder: index,
        isMain: index === 0,
      }))

      setExistingImages(reordered)
      void persistImageOrder(reordered)
    } else {
      if (fromIndex < 0 || fromIndex >= pendingImages.length) return

      setPendingImages((prev) => {
        const next = [...prev]
        const [moved] = next.splice(fromIndex, 1)
        if (!moved) return prev

        const targetIndex = Math.max(0, Math.min(toSlotIndex - existingCount, next.length))
        next.splice(targetIndex, 0, moved)
        return next
      })
    }
  }

  const moveImage = (index: number, direction: 'up' | 'down', type: 'existing' | 'new') => {
    if (type === 'existing') {
      const nextIndex = direction === 'up' ? index - 1 : index + 1
      if (nextIndex < 0 || nextIndex >= existingImages.length) {
        return
      }
      const nextImages = [...existingImages]
      const [moved] = nextImages.splice(index, 1)
      if (!moved) return
      nextImages.splice(nextIndex, 0, moved)
      const reordered = nextImages.map((image, idx) => ({
        ...image,
        sortOrder: idx,
        isMain: idx === 0,
      }))
      setExistingImages(reordered)
      void persistImageOrder(reordered)
      return
    }

    const nextIndex = direction === 'up' ? index - 1 : index + 1
    if (nextIndex < 0 || nextIndex >= pendingImages.length) {
      return
    }
    setPendingImages((prev) => {
      const next = [...prev]
      const [moved] = next.splice(index, 1)
      if (!moved) return prev
      next.splice(nextIndex, 0, moved)
      return next
    })
  }

  const setCoverImage = (index: number, type: 'existing' | 'new') => {
    if (type === 'existing') {
      if (index === 0) return
      const nextImages = [...existingImages]
      const [moved] = nextImages.splice(index, 1)
      if (!moved) return
      nextImages.unshift(moved)
      const reordered = nextImages.map((image, idx) => ({
        ...image,
        sortOrder: idx,
        isMain: idx === 0,
      }))
      setExistingImages(reordered)
      void persistImageOrder(reordered)
      return
    }

    if (existingImages.length > 0 || index === 0) {
      return
    }
    setPendingImages((prev) => {
      const next = [...prev]
      const [moved] = next.splice(index, 1)
      if (!moved) return prev
      next.unshift(moved)
      return next
    })
  }

  const handleGalleryRemove = (index: number, isExisting: boolean = false) => {
    if (isExisting) {
      const imageToRemove = existingImages[index]
      if (!imageToRemove) return

      if (activeProductId) {
        void fetch(`/api/proxy/ecommerce/products/${activeProductId}/media/${imageToRemove.id}`, {
          method: 'DELETE',
        })
      }

      const nextImages = existingImages.filter((_, idx) => idx !== index)
      setExistingImages(
        nextImages.map((image, idx) => ({
          ...image,
          sortOrder: idx,
          isMain: idx === 0,
        })),
      )
      void persistImageOrder(
        nextImages.map((image, idx) => ({
          ...image,
          sortOrder: idx,
          isMain: idx === 0,
        })),
      )
    } else {
      setPendingImages((prev) => {
        const next = prev.filter((_, idx) => idx !== index)
        const removedItem = prev[index]
        if (removedItem?.preview) {
          URL.revokeObjectURL(removedItem.preview)
        }
        return next
      })
    }
  }

  const handleGalleryReplace = (
    index: number,
    isExisting: boolean = false,
    existingIndex?: number,
  ) => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = IMAGE_TYPES.join(',')
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0]
      if (!file) return

      if (!IMAGE_TYPES.includes(file.type) || file.size > IMAGE_MAX_MB * 1024 * 1024) {
        setError(t('product.invalidImage'))
        return
      }

      if (isExisting && typeof existingIndex === 'number') {
        const existing = existingImages[existingIndex]
        if (existing && activeProductId) {
          void fetch(`/api/proxy/ecommerce/products/${activeProductId}/media/${existing.id}`, {
            method: 'DELETE',
          })
        }
        setExistingImages((prev) => prev.filter((_, idx) => idx !== existingIndex))
      }

      const newUpload: PendingImageUpload = {
        id: crypto.randomUUID(),
        file,
        preview: URL.createObjectURL(file),
        progress: 0,
        status: 'pending',
      }

      setPendingImages((prev) => {
        if (!isExisting && index >= 0 && index < prev.length) {
          const next = [...prev]
          const oldItem = next[index]
          if (oldItem?.preview) {
            URL.revokeObjectURL(oldItem.preview)
          }
          next[index] = newUpload
          return next
        }
        return [...prev, newUpload]
      })

      if (activeProductId) {
        setPendingImages((prev) =>
          prev.map((item) =>
            item.id === newUpload.id ? { ...item, status: 'uploading' } : item,
          ),
        )
        uploadMediaFile('image', file, (progress) => {
          setPendingImages((prev) =>
            prev.map((item) => (item.id === newUpload.id ? { ...item, progress } : item)),
          )
        })
          .then((response) => {
            const mediaItem = buildImageFromResponse(response as { data?: unknown })
            if (mediaItem) {
              setExistingImages((prev) => [...prev, mediaItem])
            }
            setPendingImages((prev) => prev.filter((item) => item.id !== newUpload.id))
          })
          .catch(() => {
            setPendingImages((prev) =>
              prev.map((item) =>
                item.id === newUpload.id ? { ...item, status: 'failed' } : item,
              ),
            )
          })
      }
    }
    input.click()
  }

  const uploadPendingMedia = async (productId: number) => {
    const imageUploads = pendingImages.map((upload) => {
      setPendingImages((prev) =>
        prev.map((item) =>
          item.id === upload.id ? { ...item, status: 'uploading' } : item,
        ),
      )
      return uploadMediaFile(
        'image',
        upload.file,
        (progress) => {
          setPendingImages((prev) =>
            prev.map((item) => (item.id === upload.id ? { ...item, progress } : item)),
          )
        },
        productId,
      )
        .then((response) => {
          const mediaItem = buildImageFromResponse(response as { data?: unknown })
          if (mediaItem) {
            setExistingImages((prev) => [...prev, mediaItem])
          }
          setPendingImages((prev) => prev.filter((item) => item.id !== upload.id))
        })
        .catch(() => {
          setPendingImages((prev) =>
            prev.map((item) =>
              item.id === upload.id ? { ...item, status: 'failed' } : item,
            ),
          )
        })
    })

    if (pendingVideo) {
      setPendingVideo({ ...pendingVideo, status: 'uploading' })
    }

    const videoUpload = pendingVideo
      ? uploadMediaFile(
          'video',
          pendingVideo.file,
          (progress) => {
            setPendingVideo((prev) => (prev ? { ...prev, progress } : prev))
          },
          productId,
        )
          .then((response) => {
            const videoItem = buildVideoFromResponse(response as { data?: unknown })
            if (videoItem) {
              setExistingVideo(videoItem)
            }
            setPendingVideo(null)
          })
          .catch(() => {
            setPendingVideo((prev) => (prev ? { ...prev, status: 'failed' } : prev))
          })
      : Promise.resolve()

    await Promise.all([...imageUploads, videoUpload])
  }

  const handleVideoChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    if (!VIDEO_TYPES.includes(file.type) || file.size > VIDEO_MAX_MB * 1024 * 1024) {
      setError(t('product.invalidVideo'))
      if (videoInputRef.current) {
        videoInputRef.current.value = ''
      }
      return
    }

    if (pendingVideo?.preview) {
      URL.revokeObjectURL(pendingVideo.preview)
    }

    if (existingVideo) {
      setExistingVideo(null)
    }

    const newVideo: PendingVideoUpload = {
      file,
      preview: URL.createObjectURL(file),
      progress: 0,
      status: 'pending',
    }

    setPendingVideo(newVideo)
  }

  const handleVideoRemove = () => {
    if (pendingVideo?.preview) {
      URL.revokeObjectURL(pendingVideo.preview)
    }
    setPendingVideo(null)

    if (existingVideo && activeProductId) {
      void fetch(`/api/proxy/ecommerce/products/${activeProductId}/media/${existingVideo.id}`, {
        method: 'DELETE',
      })
      setExistingVideo(null)
    }

    if (videoInputRef.current) {
      videoInputRef.current.value = ''
    }
  }

  // Removed handleSetMainImage - first image is always the cover

  const resetForm = () => {
    setForm({
      ...emptyForm,
      isFeatured: showFeatured ? emptyForm.isFeatured : false,
      categoryIds: showCategories ? emptyForm.categoryIds : [],
    })
    setRewardForm({ ...emptyRewardForm })
    setRewardId(null)
    setError(null)
    setPendingImages([])
    setPendingVideo(null)
    setExistingImages([])
    setExistingVideo(null)
    setCreatedProductId(null)
    setVariants([])
  }

  const handleCancel = () => {
    if (onCancel) {
      onCancel()
      return
    }

    if (redirectPath) {
      router.push(redirectPath)
    }
  }

  const handleRewardChange = (
    event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>,
  ) => {
    const { name, value } = event.target
    setRewardForm((prev) => ({
      ...prev,
      [name]: value,
    }))
  }

  const handleAddVariant = () => {
    setVariants((prev) => [...prev, emptyVariant(prev.length)])
  }

  const handleRemoveVariant = (index: number) => {
    setVariants((prev) => prev.filter((_, idx) => idx !== index))
  }

  const handleVariantChange = (
    index: number,
    field: keyof VariantFormValue,
    value: string | boolean,
  ) => {
    setVariants((prev) =>
      prev.map((variant, idx) =>
        idx === index
          ? {
              ...variant,
              [field]: value,
            }
          : variant,
      ),
    )
  }

  const handleVariantImageChange = (index: number, file: File | null) => {
    setVariants((prev) =>
      prev.map((variant, idx) => {
        if (idx !== index) return variant
        if (variant.imagePreview) {
          URL.revokeObjectURL(variant.imagePreview)
        }
        return {
          ...variant,
          imageFile: file,
          imagePreview: file ? URL.createObjectURL(file) : null,
          removeImage: false,
        }
      }),
    )
  }

  const handleVariantImageRemove = (index: number) => {
    setVariants((prev) =>
      prev.map((variant, idx) => {
        if (idx !== index) return variant
        if (variant.imagePreview) {
          URL.revokeObjectURL(variant.imagePreview)
        }
        return {
          ...variant,
          imageFile: null,
          imagePreview: null,
          removeImage: true,
          imageUrl: null,
        }
      }),
    )
  }

  const handleVariantReorder = (index: number, direction: 'up' | 'down') => {
    setVariants((prev) => {
      const next = [...prev]
      const targetIndex = direction === 'up' ? index - 1 : index + 1
      if (targetIndex < 0 || targetIndex >= next.length) {
        return prev
      }
      const [moved] = next.splice(index, 1)
      next.splice(targetIndex, 0, moved)
      return next.map((variant, idx) => ({
        ...variant,
        sortOrder: idx,
      }))
    })
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setSubmitting(true)
    setError(null)

    const rewardTitle = rewardForm.title.trim()
    const rewardPoints = Number.parseInt(rewardForm.pointsRequired, 10)

    if (rewardOnly) {
      if (!rewardTitle || !Number.isFinite(rewardPoints)) {
        setError(t('common.allFieldsRequired'))
        setSubmitting(false)
        return
      }
    }

    if (form.type === 'variant' && variants.length === 0) {
      setError('Please add at least one variant.')
      setSubmitting(false)
      return
    }

    if (form.type === 'variant') {
      const invalidVariant = variants.find((variant) => {
        if (!variant.name.trim() || !variant.sku.trim() || !variant.price) {
          return true
        }
        if (variant.trackStock) {
          return variant.stock === '' || variant.lowStockThreshold === ''
        }
        return false
      })

      if (invalidVariant) {
        setError('Please complete all required variant fields before saving.')
        setSubmitting(false)
        return
      }
    }

    const formData = new FormData()
    formData.append('name', form.name.trim())
    formData.append('slug', form.slug.trim())
    formData.append('sku', form.sku.trim())
    formData.append('type', form.type)
    formData.append('description', form.description.trim())
    formData.append('price', form.price || '0')
    formData.append('cost_price', form.costPrice || '0')
    formData.append('stock', form.stock || '0')
    formData.append('low_stock_threshold', form.lowStockThreshold || '0')
    formData.append('dummy_sold_count', form.dummySoldCount || '0')
    if (showFeatured) {
      formData.append('is_featured', form.isFeatured ? '1' : '0')
    } else {
      formData.append('is_featured', '0')
    }
    if (rewardOnly) {
      formData.append('is_reward_only', '1')
    }
    formData.append('meta_title', form.metaTitle.trim())
    formData.append('meta_description', form.metaDescription.trim())
    formData.append('meta_keywords', form.metaKeywords.trim())
    formData.append('meta_og_image', form.metaOgImage.trim())

    if (showCategories) {
      form.categoryIds.forEach((id) => {
        formData.append('category_ids[]', String(id))
      })
    }

    if (form.type === 'variant') {
      variants.forEach((variant, index) => {
        if (variant.id) {
          formData.append(`variants[${index}][id]`, String(variant.id))
        }
        formData.append(`variants[${index}][title]`, variant.name.trim())
        formData.append(`variants[${index}][sku]`, variant.sku.trim())
        formData.append(`variants[${index}][price]`, variant.price || '0')
        formData.append(`variants[${index}][cost_price]`, variant.costPrice || '0')
        formData.append(`variants[${index}][stock]`, variant.stock || '0')
        formData.append(`variants[${index}][low_stock_threshold]`, variant.lowStockThreshold || '0')
        formData.append(`variants[${index}][track_stock]`, variant.trackStock ? '1' : '0')
        formData.append(`variants[${index}][is_active]`, variant.isActive ? '1' : '0')
        formData.append(`variants[${index}][sort_order]`, String(index))
        if (variant.removeImage) {
          formData.append(`variants[${index}][remove_image]`, '1')
        }
        if (variant.imageFile) {
          formData.append(`variant_images[${index}]`, variant.imageFile)
        }
      })
    }

    if (form.metaOgImageFile) {
      formData.append('meta_og_image_file', form.metaOgImageFile)
    }

    if (rewardOnly) {
      formData.append('is_active', rewardForm.status === 'active' ? '1' : '0')
      if (mode === 'edit') {
        formData.append('_method', 'PUT')
      }
    } else if (mode === 'create') {
      formData.append('is_active', '1')
    } else {
      formData.append('is_active', form.status === 'active' ? '1' : '0')
      formData.append('_method', 'PUT')
    }

    const endpoint =
      mode === 'create'
        ? '/api/proxy/ecommerce/products'
        : `/api/proxy/ecommerce/products/${product?.id ?? ''}`

    const method = 'POST'

    try {
      const res = await fetch(endpoint, {
        method,
        body: formData,
      })

      const data = await res.json().catch(() => null)

      if (!res.ok) {
        let errorMessages: string[] = []
        if (data && typeof data === 'object') {
          // Check if there are validation errors
          if ('errors' in data && data.errors) {
            const errors = (data as { errors?: unknown }).errors
            if (errors && typeof errors === 'object') {
              // Loop through all error keys
              Object.keys(errors).forEach((key) => {
                const errorValue = (errors as Record<string, unknown>)[key]
                if (Array.isArray(errorValue)) {
                  // If it's an array, add all error messages
                  errorValue.forEach((msg) => {
                    if (typeof msg === 'string') {
                      errorMessages.push(`${msg}`)
                    }
                  })
                } else if (typeof errorValue === 'string') {
                  errorMessages.push(`${key}: ${errorValue}`)
                }
              })
            }
          }
          
          // If no errors found but there's a message, use it
          if (errorMessages.length === 0 && typeof (data as { message?: unknown }).message === 'string') {
            errorMessages.push((data as { message: string }).message)
          }
        }
        
        // If still no error messages, use default error message
        if (errorMessages.length === 0) {
          errorMessages.push(t('product.saveError'))
        }
        
        setError(errorMessages.join('\n'))
        return
      }

      const payload =
        data && typeof data === 'object' && 'data' in data
          ? ((data as { data?: ProductApiItem | null }).data ?? null)
          : null

      const productRow: ProductRowData = payload
        ? mapProductApiItemToRow(payload)
        : {
            id: mode === 'edit' ? product?.id || 0 : 0,
            name: form.name,
            slug: form.slug,
            sku: form.sku,
            type: form.type,
            description: form.description,
            price: Number.parseFloat(form.price || '0'),
            costPrice: Number.parseFloat(form.costPrice || '0'),
            stock: Number.parseInt(form.stock || '0', 10),
            lowStockThreshold: Number.parseInt(form.lowStockThreshold || '0', 10),
            isActive: rewardOnly
              ? rewardForm.status === 'active'
              : mode === 'create'
                ? true
                : form.status === 'active',
            isFeatured: form.isFeatured,
            isRewardOnly: mode === 'edit' ? product?.isRewardOnly || false : false,
            metaTitle: form.metaTitle,
            metaDescription: form.metaDescription,
            metaKeywords: form.metaKeywords,
            metaOgImage: form.metaOgImage,
            categoryIds: form.categoryIds,
            categories: categories
              .filter((cat) => form.categoryIds.includes(cat.id))
              .map((cat) => cat.name)
              .join(', '),
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            images: [],
            video: null,
          }

      if (mode === 'create') {
        setCreatedProductId(productRow.id)
      }

      if (pendingImages.length > 0 || pendingVideo) {
        await uploadPendingMedia(productRow.id)
      }

      if (rewardOnly) {
        const rewardPayload = {
          title: rewardTitle,
          description: rewardForm.description.trim() || null,
          type: 'product',
          points_required: rewardPoints,
          product_id: productRow.id,
          is_active: rewardForm.status === 'active',
        }

        const rewardEndpoint = rewardId
          ? `/api/proxy/ecommerce/loyalty/rewards/${rewardId}`
          : '/api/proxy/ecommerce/loyalty/rewards'

        const rewardMethod = rewardId ? 'PUT' : 'POST'

        const rewardRes = await fetch(rewardEndpoint, {
          method: rewardMethod,
          headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
          },
          body: JSON.stringify(rewardPayload),
        })

        if (!rewardRes.ok) {
          const rewardData = await rewardRes.json().catch(() => null)
          let message = 'Failed to save reward'
          if (rewardData && typeof rewardData === 'object') {
            if (typeof (rewardData as { message?: unknown }).message === 'string') {
              message = (rewardData as { message: string }).message
            } else if ('errors' in rewardData && typeof rewardData.errors === 'object') {
              const errors = rewardData.errors as Record<string, unknown>
              const firstKey = Object.keys(errors)[0]
              const firstValue = firstKey ? errors[firstKey] : null
              if (Array.isArray(firstValue) && typeof firstValue[0] === 'string') {
                message = firstValue[0]
              } else if (typeof firstValue === 'string') {
                message = firstValue
              }
            }
          }
          setError(message)
          return
        }
      }

      if (mode === 'create') {
        resetForm()
      }

      onSuccess?.(productRow)
      if (redirectPath) {
        router.push(redirectPath)
      }
    } catch (err) {
      if (!(err instanceof DOMException && err.name === 'AbortError')) {
        setError(t('product.networkError'))
      }
    } finally {
      setSubmitting(false)
    }
  }

  const selectedCategoriesLabel = useMemo(() => {
    if (form.categoryIds.length === 0) return t('product.none')
    return categories
      .filter((cat) => form.categoryIds.includes(cat.id))
      .map((cat) => cat.name)
      .join(', ')
  }, [categories, form.categoryIds])

  return (
    <form className="p-6 space-y-6" onSubmit={handleSubmit}>
      <ErrorBox error={error} />

      {/* Reward Details Section */}
      {rewardOnly && (
        <div className="space-y-4">
          <div className="pb-2 border-b border-gray-100">
            <h3 className="text-lg font-semibold text-gray-900">Reward Details</h3>
            <p className="text-sm text-gray-500 mt-1">
              Configure reward title, points, and visibility.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2 md:col-span-2">
              <label className="block text-sm font-medium text-gray-700" htmlFor="rewardTitle">
                Title <span className="text-red-500">*</span>
              </label>
              <input
                id="rewardTitle"
                name="title"
                type="text"
                value={rewardForm.title}
                onChange={handleRewardChange}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                placeholder="Reward title"
              />
            </div>
            <div className="space-y-2 md:col-span-2">
              <label
                className="block text-sm font-medium text-gray-700"
                htmlFor="rewardDescription"
              >
                Description
              </label>
              <textarea
                id="rewardDescription"
                name="description"
                value={rewardForm.description}
                onChange={handleRewardChange}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                rows={3}
                placeholder="Reward description"
              />
            </div>
            <div className="space-y-2">
              <label
                className="block text-sm font-medium text-gray-700"
                htmlFor="rewardPoints"
              >
                Points Required <span className="text-red-500">*</span>
              </label>
              <input
                id="rewardPoints"
                name="pointsRequired"
                type="number"
                min="1"
                value={rewardForm.pointsRequired}
                onChange={handleRewardChange}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                placeholder="0"
              />
            </div>
            <div className="space-y-2">
              <label
                className="block text-sm font-medium text-gray-700"
                htmlFor="rewardStatus"
              >
                Status
              </label>
              <select
                id="rewardStatus"
                name="status"
                value={rewardForm.status}
                onChange={handleRewardChange}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
              >
                <option value="active">{t('common.active')}</option>
                <option value="inactive">{t('common.inactive')}</option>
              </select>
            </div>
          </div>
        </div>
      )}

      {/* Basic Information Section */}
      <div className="space-y-4">
        <div className="pb-2 border-b border-gray-100">
          <h3 className="text-lg font-semibold text-gray-900">
            {rewardOnly ? 'Product Information' : t('product.basicInformation')}
          </h3>
          <p className="text-sm text-gray-500 mt-1">
            {rewardOnly
              ? 'Update reward product details, images, pricing, inventory, and SEO metadata.'
              : t('product.basicInformationDescription')}
          </p>
        </div>
        
        {/* Flex Layout: Images on left, Form fields on right */}
        <div className="flex flex-col lg:flex-row gap-6">
          {/* Left Side: Product Images */}
          <div className="lg:w-2/5 space-y-4">
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <label className="block text-sm font-medium text-gray-700">
                  {t('product.productImages')}
                  <span className="text-xs text-gray-500 font-normal ml-2">({t('product.maxImages').replace('{count}', String(MAX_IMAGES))})</span>
                </label>
              </div>
              <p className="text-xs text-red-500 mb-2">Suggested size: 800 x 800</p>

              {/* Hidden File Input */}
              <input
                ref={fileInputRef}
                id="galleryFiles"
                name="galleryFiles"
                type="file"
                accept={IMAGE_TYPES.join(',')}
                multiple
                onChange={handleGalleryChange}
                className="hidden"
              />

              {/* Fixed 6-Slot Grid */}
              <div className="grid grid-cols-3 gap-3 mb-2">
                {Array.from({ length: MAX_IMAGES }).map((_, slotIndex) => {
                  // Combine new previews and existing images for display
                  const allImages = [
                    ...existingImages.map((img, idx) => ({
                      type: 'existing' as const,
                      preview: img.url,
                      isMain: img.isMain,
                      index: idx,
                    })),
                    ...pendingImages.map((item, idx) => ({
                      type: 'new' as const,
                      preview: item.preview,
                      index: idx,
                    })),
                  ]

                  const imageInSlot = allImages[slotIndex]
                  const isFirstSlot = slotIndex === 0
                  const isEmpty = !imageInSlot
                  const isNewImage = imageInSlot?.type === 'new'
                  const imageIndex = imageInSlot?.index ?? -1
                  const pendingUpload = isNewImage ? pendingImages[imageIndex] : null
                  const displaySize = isNewImage
                    ? pendingUpload?.file?.size
                    : existingImages[imageIndex]?.sizeBytes

                  return (
                    <div
                      key={slotIndex}
                      className={`relative aspect-square rounded-xl border-2 border-dashed overflow-hidden transition-all duration-200 ${
                        isEmpty
                          ? 'border-gray-300 bg-gray-50 hover:border-blue-400 hover:bg-blue-50/50 hover:shadow-md cursor-pointer'
                          : 'border-gray-200 bg-white shadow-md hover:shadow-lg'
                      } ${isFirstSlot && !isEmpty ? 'ring-2 ring-blue-500 border-blue-500 shadow-lg' : ''}`}
                      onClick={() => {
                        if (isEmpty) {
                          const currentTotal = pendingImages.length + existingImages.length
                          if (currentTotal < MAX_IMAGES) {
                            fileInputRef.current?.click()
                          }
                        }
                      }}
                      onDragOver={(e) => {
                        if (draggingIndex !== null) {
                          e.preventDefault()
                          e.dataTransfer.dropEffect = 'move'
                        }
                      }}
                       onDrop={(e) => {
                         e.preventDefault()
                         e.stopPropagation()
                         if (draggingIndex !== null && draggingType !== null && draggingIndex !== imageIndex) {
                           if (!isEmpty && (isNewImage && draggingType === 'new' || !isNewImage && draggingType === 'existing')) {
                             // Dropping on filled slot of same type - reorder
                             handleGalleryReorder(draggingIndex, slotIndex, draggingType)
                           } else {
                             // Dropping on empty slot or different type - move to position
                             handleGalleryReorder(draggingIndex, slotIndex, draggingType)
                           }
                         }
                         setDraggingIndex(null)
                         setDraggingType(null)
                       }}
                    >
                      {isEmpty ? (
                        // Empty Slot - Upload Placeholder
                        <div className="w-full h-full flex flex-col items-center justify-center p-2 group">
                          <div className="w-10 h-10 rounded-full bg-gray-100 group-hover:bg-blue-100 flex items-center justify-center mb-2 transition-all duration-200 group-hover:scale-110">
                            <i className="fa-solid fa-cloud-arrow-up text-gray-400 group-hover:text-blue-500 text-lg transition-colors duration-200" />
                          </div>
                          <span className="text-[10px] text-gray-500 group-hover:text-blue-600 text-center font-medium transition-colors duration-200">{t('product.clickToUpload')}</span>
                        </div>
                      ) : (
                        // Filled Slot - Image Display
                        <div
                          className="w-full h-full cursor-pointer group relative"
                          onClick={() => {
                            setPreviewImage({
                              type: imageInSlot.type,
                              src: imageInSlot.preview,
                              index: imageIndex,
                            })
                          }}
                        >
                          <img
                            src={imageInSlot.preview}
                            alt={t('product.imageAlt').replace('{index}', String(slotIndex + 1))}
                            className="w-full h-full object-cover group-hover:opacity-90 transition-opacity duration-200"
                          />
                          <div className="absolute top-2 left-2 rounded-full bg-black/60 px-2 py-0.5 text-[10px] text-white">
                            {t('product.mediaTypeImage')}
                          </div>
                          {pendingUpload?.status === 'uploading' && (
                            <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/50 text-white text-xs font-medium">
                              <div className="mb-2">{t('product.uploading')}</div>
                              <div className="w-3/4 h-2 bg-white/30 rounded-full overflow-hidden">
                                <div
                                  className="h-full bg-blue-400 transition-all"
                                  style={{ width: `${pendingUpload.progress}%` }}
                                />
                              </div>
                            </div>
                          )}
                          {pendingUpload?.status === 'failed' && (
                            <div className="absolute inset-0 flex items-center justify-center bg-red-600/70 text-white text-xs font-medium">
                              {t('product.uploadFailed')}
                            </div>
                          )}
                          {displaySize ? (
                            <div className="absolute bottom-2 left-2 rounded-full bg-black/60 px-2 py-0.5 text-[10px] text-white">
                              {formatBytes(displaySize)}
                            </div>
                          ) : null}

                          {/* Drag Handle, Replace & Remove Button - Only show on hover */}
                          {isNewImage && (
                            <div className="absolute top-2 right-2 flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                              {/* Drag Handle - Only draggable from this icon */}
                              <div
                                draggable
                                onDragStart={(e) => {
                                  setDraggingIndex(imageIndex)
                                  setDraggingType('new')
                                  e.dataTransfer.effectAllowed = 'move'
                                  e.stopPropagation()
                                }}
                                onDragEnd={() => {
                                  setDraggingIndex(null)
                                  setDraggingType(null)
                                }}
                                className="w-8 h-8 bg-white/95 backdrop-blur-md text-gray-700 rounded-full flex items-center justify-center shadow-lg border border-gray-200/50 cursor-move hover:bg-white hover:shadow-xl transition-all duration-200 hover:scale-110"
                                onClick={(e) => {
                                  e.stopPropagation()
                                }}
                              >
                                <i className="fa-solid fa-grip-vertical text-xs" />
                              </div>
                              {/* Replace Button */}
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  handleGalleryReplace(imageIndex)
                                }}
                                className="w-8 h-8 bg-blue-500/95 backdrop-blur-md text-white rounded-full flex items-center justify-center shadow-lg border border-blue-400/30 hover:bg-blue-600 hover:shadow-xl hover:scale-110 transition-all duration-200"
                                aria-label={t('product.replaceImage')}
                              >
                                <i className="fa-solid fa-image text-xs" />
                              </button>
                              {/* <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  moveImage(imageIndex, 'up', 'new')
                                }}
                                className="w-8 h-8 bg-white/95 backdrop-blur-md text-gray-700 rounded-full flex items-center justify-center shadow-lg border border-gray-200/50 hover:bg-white hover:shadow-xl hover:scale-110 transition-all duration-200"
                                aria-label={t('product.moveUp')}
                              >
                                <i className="fa-solid fa-arrow-up text-xs" />
                              </button>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  moveImage(imageIndex, 'down', 'new')
                                }}
                                className="w-8 h-8 bg-white/95 backdrop-blur-md text-gray-700 rounded-full flex items-center justify-center shadow-lg border border-gray-200/50 hover:bg-white hover:shadow-xl hover:scale-110 transition-all duration-200"
                                aria-label={t('product.moveDown')}
                              >
                                <i className="fa-solid fa-arrow-down text-xs" />
                              </button> */}
                              {existingImages.length === 0 && (
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    setCoverImage(imageIndex, 'new')
                                  }}
                                  className="w-8 h-8 bg-yellow-400/95 backdrop-blur-md text-white rounded-full flex items-center justify-center shadow-lg border border-yellow-300/50 hover:bg-yellow-500 hover:shadow-xl hover:scale-110 transition-all duration-200"
                                  aria-label={t('product.setCover')}
                                >
                                  <i className="fa-solid fa-star text-xs" />
                                </button>
                              )}
                              {/* Remove Button */}
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  handleGalleryRemove(imageIndex)
                                }}
                                className="w-8 h-8 bg-red-500/95 backdrop-blur-md text-white rounded-full flex items-center justify-center shadow-lg border border-red-400/30 hover:bg-red-600 hover:shadow-xl hover:scale-110 transition-all duration-200"
                                aria-label={t('product.removeImage')}
                              >
                                <i className="fa-solid fa-trash-can text-xs" />
                              </button>
                            </div>
                          )}
                          {/* Drag Handle, Replace & Remove Button for Existing Images */}
                          {!isNewImage && imageInSlot && (
                            <div className="absolute top-2 right-2 flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                              {/* Drag Handle - Only draggable from this icon */}
                              <div
                                draggable
                                onDragStart={(e) => {
                                  setDraggingIndex(imageIndex)
                                  setDraggingType('existing')
                                  e.dataTransfer.effectAllowed = 'move'
                                  e.stopPropagation()
                                }}
                                onDragEnd={() => {
                                  setDraggingIndex(null)
                                  setDraggingType(null)
                                }}
                                className="w-8 h-8 bg-white/95 backdrop-blur-md text-gray-700 rounded-full flex items-center justify-center shadow-lg border border-gray-200/50 cursor-move hover:bg-white hover:shadow-xl transition-all duration-200 hover:scale-110"
                                onClick={(e) => {
                                  e.stopPropagation()
                                }}
                              >
                                <i className="fa-solid fa-grip-vertical text-xs" />
                              </div>
                              {/* Replace Button */}
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  handleGalleryReplace(-1, true, imageIndex)
                                }}
                                className="w-8 h-8 bg-blue-500/95 backdrop-blur-md text-white rounded-full flex items-center justify-center shadow-lg border border-blue-400/30 hover:bg-blue-600 hover:shadow-xl hover:scale-110 transition-all duration-200"
                                aria-label={t('product.replaceImage')}
                              >
                                <i className="fa-solid fa-image text-xs" />
                              </button>
                              {/* <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  moveImage(imageIndex, 'up', 'existing')
                                }}
                                className="w-8 h-8 bg-white/95 backdrop-blur-md text-gray-700 rounded-full flex items-center justify-center shadow-lg border border-gray-200/50 hover:bg-white hover:shadow-xl hover:scale-110 transition-all duration-200"
                                aria-label={t('product.moveUp')}
                              >
                                <i className="fa-solid fa-arrow-up text-xs" />
                              </button>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  moveImage(imageIndex, 'down', 'existing')
                                }}
                                className="w-8 h-8 bg-white/95 backdrop-blur-md text-gray-700 rounded-full flex items-center justify-center shadow-lg border border-gray-200/50 hover:bg-white hover:shadow-xl hover:scale-110 transition-all duration-200"
                                aria-label={t('product.moveDown')}
                              >
                                <i className="fa-solid fa-arrow-down text-xs" />
                              </button> */}
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  setCoverImage(imageIndex, 'existing')
                                }}
                                className="w-8 h-8 bg-yellow-400/95 backdrop-blur-md text-white rounded-full flex items-center justify-center shadow-lg border border-yellow-300/50 hover:bg-yellow-500 hover:shadow-xl hover:scale-110 transition-all duration-200"
                                aria-label={t('product.setCover')}
                              >
                                <i className="fa-solid fa-star text-xs" />
                              </button>
                              {/* Remove Button */}
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  handleGalleryRemove(imageIndex, true)
                                }}
                                className="w-8 h-8 bg-red-500/95 backdrop-blur-md text-white rounded-full flex items-center justify-center shadow-lg border border-red-400/30 hover:bg-red-600 hover:shadow-xl hover:scale-110 transition-all duration-200"
                                aria-label={t('product.removeImage')}
                              >
                                <i className="fa-solid fa-trash-can text-xs" />
                              </button>
                            </div>
                          )}
                          {/* Cover Label */}
                          {isFirstSlot && (
                            <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-blue-600/90 via-blue-500/70 to-transparent px-3 py-2">
                              <span className="text-[11px] text-white font-semibold inline-flex items-center gap-1.5 drop-shadow-md">
                                <i className="fa-solid fa-star text-yellow-300 drop-shadow-sm" />
                                {t('product.coverImage')}
                              </span>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>

              {/* Helper Text */}
              <div className="flex items-center justify-between text-xs text-gray-500">
                <span className="inline-flex items-center gap-1">
                  <i className="fa-solid fa-info-circle" />
                  {t('product.imageHelper')}
                </span>
                <span>
                  {pendingImages.length + existingImages.length} / {MAX_IMAGES}
                </span>
              </div>
            </div>

            {/* Video Upload */}
            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700">
                {t('product.productVideo')}
              </label>
              <input
                ref={videoInputRef}
                id="productVideo"
                name="productVideo"
                type="file"
                accept={VIDEO_TYPES.join(',')}
                onChange={handleVideoChange}
                className="hidden"
              />
              {existingVideo || pendingVideo ? (
                <div className="relative rounded-xl border border-gray-200 bg-white p-3 shadow-sm">
                  <div className="absolute top-3 left-3 rounded-full bg-black/70 px-2 py-0.5 text-[10px] text-white">
                    {t('product.mediaTypeVideo')}
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="h-30 w-38 overflow-hidden rounded-md bg-gray-100">
                      {existingVideo ? (
                        <video
                          src={existingVideo.url}
                          className="h-full w-full object-cover"
                          controls
                          preload="metadata"
                        />
                      ) : pendingVideo ? (
                        <video
                          src={pendingVideo.preview}
                          className="h-full w-full object-cover"
                          controls
                          preload="metadata"
                          muted
                        />
                      ) : null}
                    </div>
                    <div className="flex-1 space-y-1">
                      <div className="text-sm font-medium text-gray-800">
                        {pendingVideo?.file.name ||
                          getFileNameFromUrl(existingVideo?.url) ||
                          t('product.video')}
                      </div>
                      <div className="text-xs text-gray-500">
                        {existingVideo?.sizeBytes
                          ? formatBytes(existingVideo.sizeBytes)
                          : pendingVideo
                            ? formatBytes(pendingVideo.file.size)
                            : ''}
                      </div>
                      <div className="text-xs text-gray-500">
                        {existingVideo?.status
                          ? t(`product.videoStatus.${existingVideo.status}`)
                          : pendingVideo
                            ? t('product.videoPending')
                            : ''}
                      </div>
                      {existingVideo?.status === 'processing' && (
                        <div className="flex items-center text-xs text-blue-600">
                          <i className="fa-solid fa-spinner mr-1 animate-spin" />
                          {t('product.videoProcessing')}
                        </div>
                      )}
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-blue-500 text-white hover:bg-blue-600"
                          onClick={() => videoInputRef.current?.click()}
                          aria-label={t('product.replaceVideo')}
                        >
                          <i className="fa-solid fa-video" />
                        </button>
                        <button
                          type="button"
                          className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-red-500 text-white hover:bg-red-600"
                          onClick={handleVideoRemove}
                          aria-label={t('product.removeVideo')}
                        >
                          <i className="fa-solid fa-trash" />
                        </button>
                      </div>
                    </div>
                  </div>
                  {pendingVideo?.status === 'uploading' && (
                    <div className="mt-3 h-2 w-full rounded-full bg-gray-100">
                      <div
                        className="h-full rounded-full bg-blue-500 transition-all"
                        style={{ width: `${pendingVideo.progress}%` }}
                      />
                    </div>
                  )}
                  {pendingVideo?.status === 'failed' && (
                    <p className="mt-2 text-xs text-red-500">{t('product.uploadFailed')}</p>
                  )}
                </div>
              ) : (
                <button
                  type="button"
                  className="flex h-24 w-full items-center justify-center rounded-xl border-2 border-dashed border-gray-300 bg-gray-50 text-sm text-gray-600 hover:border-blue-400 hover:text-blue-600"
                  onClick={() => videoInputRef.current?.click()}
                >
                  <i className="fa-solid fa-video mr-2" />
                  {t('product.uploadVideo')}
                </button>
              )}
              <p className="text-xs text-gray-500">
                {t('product.videoHelper').replace('{size}', String(VIDEO_MAX_MB))}
              </p>
            </div>
          </div>

          {/* Image Preview Modal */}
          {previewImage && (
            <div
              className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
              onClick={() => setPreviewImage(null)}
            >
              <div
                className="relative max-w-5xl max-h-[95vh] w-full"
                onClick={(e) => e.stopPropagation()}
              >
                {/* Close Button */}
                <button
                  type="button"
                  onClick={() => setPreviewImage(null)}
                  className="absolute -top-12 right-0 w-10 h-10 bg-white/90 backdrop-blur-md text-gray-700 rounded-full flex items-center justify-center shadow-lg border border-gray-200/50 hover:bg-white hover:shadow-xl transition-all duration-200 hover:scale-110"
                  aria-label={t('product.closePreview')}
                >
                  <i className="fa-solid fa-xmark text-sm" />
                </button>

                {/* Preview Image */}
                <img
                  src={previewImage.src}
                  alt={t('product.previewAlt')}
                  className="max-w-full max-h-[95vh] w-auto h-auto object-contain rounded-lg shadow-2xl"
                />
              </div>
            </div>
          )}

          {/* Right Side: Form Fields */}
          <div className="lg:w-3/5 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-700" htmlFor="name">
                  {t('common.name')} <span className="text-red-500">*</span>
                </label>
                <input
                  id="name"
                  name="name"
                  value={form.name}
                  onChange={handleChange}
                  required
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                  placeholder={t('product.namePlaceholder')}
                />
              </div>
              <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-700" htmlFor="slug">
                  {t('product.slug')} <span className="text-red-500">*</span>
                </label>
                <input
                  id="slug"
                  name="slug"
                  value={form.slug}
                  onChange={handleChange}
                  required
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                  placeholder={t('product.slugPlaceholder')}
                />
              </div>
              <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-700" htmlFor="sku">
                  {t('product.sku')}
                  {form.type !== 'variant' && <span className="text-red-500"> *</span>}
                </label>
                <input
                  id="sku"
                  name="sku"
                  value={form.sku}
                  onChange={handleChange}
                  required={form.type !== 'variant'}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                  placeholder={t('product.skuPlaceholder')}
                />
              </div>
              <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-700" htmlFor="type">
                  {t('product.type')}
                </label>
                <select
                  id="type"
                  name="type"
                  value={form.type}
                  onChange={handleChange}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                >
                  <option value="single">{t('product.typeSingle')}</option>
                  <option value="variant">Variant</option>
                  <option value="package">{t('product.typeBundle')}</option>
                </select>
              </div>

              <div className="space-y-2 md:col-span-2">
                <label className="block text-sm font-medium text-gray-700" htmlFor="description">
                  {t('product.description')}
                </label>
                <textarea
                  id="description"
                  name="description"
                  value={form.description}
                  onChange={handleChange}
                  rows={4}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors resize-none"
                  placeholder={t('product.descriptionPlaceholder')}
                />
              </div>
              {showCategories && (
                <div className="space-y-2  md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700">
                    {t('product.categories')} <span className="text-red-500">*</span>
                    {form.categoryIds.length > 0 && (
                      <span className="ml-2 text-xs font-normal text-gray-500">
                        ({t('product.categoriesSelected').replace('{count}', String(form.categoryIds.length))})
                      </span>
                    )}
                  </label>
                  <div ref={categoryDropdownRef} className="relative">
                    {/* Main Trigger Button with Clear Button Outside */}
                    <div className="relative">
                      <button
                        type="button"
                        onClick={() => {
                          setIsCategoryDropdownOpen(!isCategoryDropdownOpen)
                          if (!isCategoryDropdownOpen) {
                            // Focus search input when opening
                            setTimeout(() => {
                              categorySearchRef.current?.focus()
                            }, 100)
                          } else {
                            setCategorySearchQuery('')
                          }
                        }}
                        className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm text-left bg-white hover:bg-gray-50 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 flex items-center justify-between shadow-sm hover:shadow-md pr-10"
                      >
                        <div className="flex items-center gap-2 flex-1 min-w-0">
                          {form.categoryIds.length === 0 ? (
                            <span className="text-gray-500 flex items-center gap-2">
                              <i className="fa-solid fa-layer-group text-xs" />
                              {t('product.selectCategories')}
                            </span>
                          ) : form.categoryIds.length <= 2 ? (
                            <span className="text-gray-700 flex items-center gap-2 truncate">
                              <i className="fa-solid fa-check-circle text-blue-600 text-xs" />
                              {categories
                                .filter((cat) => form.categoryIds.includes(cat.id))
                                .map((cat) => cat.name)
                                .join(', ')}
                            </span>
                          ) : (
                            <span className="text-gray-700 flex items-center gap-2">
                              <i className="fa-solid fa-check-circle text-blue-600 text-xs" />
                              <span className="font-medium">
                                {t('product.categoriesSelectedCount').replace('{count}', String(form.categoryIds.length))}
                              </span>
                            </span>
                          )}
                        </div>
                        <i
                          className={`fa-solid fa-chevron-${
                            isCategoryDropdownOpen ? 'up' : 'down'
                          } text-gray-400 text-xs transition-transform duration-200 flex-shrink-0`}
                        />
                      </button>
                      {/* Clear Button - Outside the main button */}
                      {/* {form.categoryIds.length > 0 && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation()
                            handleClearAllCategories()
                          }}
                          className="absolute right-8 top-1/2 -translate-y-1/2 text-gray-400 hover:text-red-600 transition-colors p-1 rounded hover:bg-red-50 z-10"
                          aria-label="Clear all"
                          title="Clear all"
                        >
                          <i className="fa-solid fa-xmark text-xs" />
                        </button>
                      )} */}
                    </div>

                    {/* Dropdown Panel */}
                    {isCategoryDropdownOpen && (
                      <div className="absolute z-20 w-full mt-2 bg-white border border-gray-200 rounded-xl shadow-xl overflow-hidden transition-all duration-200 ease-out">
                        {/* Search Bar */}
                        <div className="p-3 border-b border-gray-100 bg-gray-50">
                          <div className="relative">
                            <i className="fa-solid fa-magnifying-glass absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-xs" />
                            <input
                              ref={categorySearchRef}
                              type="text"
                              value={categorySearchQuery}
                              onChange={(e) => setCategorySearchQuery(e.target.value)}
                              placeholder={t('product.searchCategories')}
                              className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white transition-all"
                            />
                            {categorySearchQuery && (
                              <button
                                type="button"
                                onClick={() => setCategorySearchQuery('')}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                              >
                                <i className="fa-solid fa-xmark text-xs" />
                              </button>
                            )}
                          </div>
                        </div>

                        {/* Quick Actions */}
                        {!loadingCategories && filteredCategories.length > 0 && (
                          <div className="px-3 py-2 border-b border-gray-100 bg-gray-50/50 flex items-center justify-between">
                            <button
                              type="button"
                              onClick={handleSelectAllCategories}
                              className="text-xs text-blue-600 hover:text-blue-700 font-medium flex items-center gap-1.5 transition-colors"
                            >
                              <i className="fa-solid fa-check-double" />
                              {filteredCategories.every((cat) =>
                                form.categoryIds.includes(cat.id)
                              )
                                ? t('product.deselectAll')
                                : t('product.selectAll')}
                            </button>
                            {form.categoryIds.length > 0 && (
                              <button
                                type="button"
                                onClick={handleClearAllCategories}
                                className="text-xs text-red-600 hover:text-red-700 font-medium flex items-center gap-1.5 transition-colors"
                              >
                                <i className="fa-solid fa-trash-can" />
                                {t('product.clearAll')}
                              </button>
                            )}
                          </div>
                        )}

                        {/* Categories List */}
                        <div className="max-h-64 overflow-y-auto">
                          {loadingCategories ? (
                            <div className="p-6 text-center">
                              <i className="fa-solid fa-spinner fa-spin text-blue-600 mb-2" />
                              <p className="text-sm text-gray-500">{t('product.loadingCategories')}</p>
                            </div>
                          ) : filteredCategories.length > 0 ? (
                            <div className="p-2">
                              {filteredCategories.map((category) => {
                                const isSelected = form.categoryIds.includes(
                                  category.id
                                )
                                return (
                                  <label
                                    key={category.id}
                                    className={`flex items-center gap-3 p-2.5 rounded-lg cursor-pointer transition-all duration-150 ${
                                      isSelected
                                        ? 'bg-blue-50 hover:bg-blue-100'
                                        : 'hover:bg-gray-50'
                                    }`}
                                  >
                                    <div className="relative flex-shrink-0">
                                      <input
                                        type="checkbox"
                                        checked={isSelected}
                                        onChange={() =>
                                          handleCategoryToggle(category.id)
                                        }
                                        className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-2 focus:ring-blue-500 cursor-pointer"
                                      />
                                      {isSelected && (
                                        <i className="fa-solid fa-check absolute inset-0 flex items-center justify-center text-white text-[10px] pointer-events-none" />
                                      )}
                                    </div>
                                    <span
                                      className={`text-sm flex-1 ${
                                        isSelected
                                          ? 'text-blue-900 font-medium'
                                          : 'text-gray-700'
                                      }`}
                                    >
                                      {category.name}
                                    </span>
                                    {isSelected && (
                                      <i className="fa-solid fa-check-circle text-blue-600 text-xs flex-shrink-0" />
                                    )}
                                  </label>
                                )
                              })}
                            </div>
                          ) : (
                            <div className="p-6 text-center">
                              <i className="fa-solid fa-folder-open text-gray-300 text-2xl mb-2" />
                              <p className="text-sm text-gray-500">
                                {categorySearchQuery
                                  ? t('product.noCategoriesFound')
                                  : t('product.noCategoriesAvailable')}
                              </p>
                              {categorySearchQuery && (
                                <button
                                  type="button"
                                  onClick={() => setCategorySearchQuery('')}
                                  className="mt-2 text-xs text-blue-600 hover:text-blue-700"
                                >
                                  {t('product.clearSearch')}
                                </button>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Selected Categories Tags */}
                    {form.categoryIds.length > 0 && (
                      <div className="mt-3 flex flex-wrap gap-2">
                        {categories
                          .filter((cat) => form.categoryIds.includes(cat.id))
                          .map((category) => (
                            <span
                              key={category.id}
                              className="inline-flex items-center gap-2 px-3 py-1.5 bg-gradient-to-r from-blue-50 to-blue-100 text-blue-800 rounded-lg text-sm font-medium border border-blue-200/50 shadow-sm hover:shadow-md transition-all duration-200 group"
                            >
                              <i className="fa-solid fa-tag text-blue-600 text-xs" />
                              <span>{category.name}</span>
                              <button
                                type="button"
                                onClick={() => handleCategoryToggle(category.id)}
                                className="text-blue-600 hover:text-red-600 hover:bg-red-50 rounded-full p-0.5 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-red-500"
                                aria-label={t('product.removeCategory').replace('{name}', category.name)}
                              >
                                <i className="fa-solid fa-xmark text-xs" />
                              </button>
                            </span>
                          ))}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Pricing & Inventory Section */}
      <div className="space-y-4">
        <div className="pb-2 border-b border-gray-100">
          <h3 className="text-lg font-semibold text-gray-900">{t('product.pricingInventory')}</h3>
          <p className="text-sm text-gray-500 mt-1">{t('product.pricingInventoryDescription')}</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {form.type !== 'variant' && (
            <>
              <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-700" htmlFor="price">
                  {t('product.price')} <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-sm">RM</span>
                  <input
                    id="price"
                    name="price"
                    type="number"
                    step="0.01"
                    value={form.price}
                    onChange={handleChange}
                    className="w-full rounded-lg border border-gray-300 pl-10 pr-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                    placeholder="0.00"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-700" htmlFor="costPrice">
                  {t('product.costPrice')}
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-sm">RM</span>
                  <input
                    id="costPrice"
                    name="costPrice"
                    type="number"
                    step="0.01"
                    value={form.costPrice}
                    onChange={handleChange}
                    className="w-full rounded-lg border border-gray-300 pl-10 pr-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                    placeholder="0.00"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-700" htmlFor="stock">
                  {t('product.stockQuantity')} <span className="text-red-500">*</span>
                </label>
                <input
                  id="stock"
                  name="stock"
                  type="number"
                  value={form.stock}
                  onChange={handleChange}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                  placeholder="0"
                />
              </div>
              <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-700" htmlFor="lowStockThreshold">
                  {t('product.lowStockThreshold')}
                </label>
                <input
                  id="lowStockThreshold"
                  name="lowStockThreshold"
                  type="number"
                  value={form.lowStockThreshold}
                  onChange={handleChange}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                  placeholder="0"
                />
              </div>
              <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-700" htmlFor="dummySoldCount">
                  Extra Sold (Display Only)
                </label>
                <input
                  id="dummySoldCount"
                  name="dummySoldCount"
                  type="number"
                  min="0"
                  value={form.dummySoldCount}
                  onChange={handleChange}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                  placeholder="0"
                />
              </div>
            </>
          )}
          {mode === 'edit' && !rewardOnly && (
            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700" htmlFor="status">
                {t('common.status')}
              </label>
              <select
                id="status"
                name="status"
                value={form.status}
                onChange={handleChange}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
              >
                <option value="active">{t('common.active')}</option>
                <option value="inactive">{t('common.inactive')}</option>
              </select>
            </div>
          )}
          {showFeatured && (
            <div className="flex items-center justify-between rounded-lg border bg-gray-50 px-4 py-3">
              <div>
                <p className="text-sm font-medium text-gray-900">
                  {t('product.featuredProduct')}
                </p>
                <p className="text-xs text-gray-500">
                  {t('product.featuredProductDescription')}
                </p>
              </div>
              <Switch
                checked={form.isFeatured}
                onCheckedChange={(checked) =>
                  setForm((f) => ({ ...f, isFeatured: checked }))
                }
              />
            </div>
          )}
        </div>
      </div>

      {form.type === 'variant' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between pb-2 border-b border-gray-100">
            <div>
              <h3 className="text-lg font-semibold text-gray-900">Variants</h3>
              <p className="text-sm text-gray-500 mt-1">Manage variant options, pricing, and stock.</p>
            </div>
            <button
              type="button"
              onClick={handleAddVariant}
              className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
            >
              <i className="fa-solid fa-plus" />
              Add Variant
            </button>
          </div>
          {variants.length === 0 && (
            <div className="rounded-lg border border-dashed border-gray-300 p-6 text-center text-sm text-gray-500">
              No variants yet. Add your first variant.
            </div>
          )}
          {variants.map((variant, index) => (
            <div key={variant.id ?? index} className="rounded-lg border border-gray-200 p-4 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-gray-900">Variant #{index + 1}</p>
                  <p className="text-xs text-gray-500">Sort order: {index + 1}</p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleVariantReorder(index, 'up')}
                    className="rounded border border-gray-300 px-2 py-1 text-xs text-gray-600 hover:bg-gray-50 disabled:opacity-50"
                    disabled={index === 0}
                  >
                    <i className="fa-solid fa-arrow-up" />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleVariantReorder(index, 'down')}
                    className="rounded border border-gray-300 px-2 py-1 text-xs text-gray-600 hover:bg-gray-50 disabled:opacity-50"
                    disabled={index === variants.length - 1}
                  >
                    <i className="fa-solid fa-arrow-down" />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleRemoveVariant(index)}
                    className="rounded border border-red-200 px-2 py-1 text-xs text-red-600 hover:bg-red-50"
                  >
                    <i className="fa-solid fa-trash" />
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-gray-700">Name</label>
                  <input
                    value={variant.name}
                    onChange={(event) => handleVariantChange(index, 'name', event.target.value)}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                    placeholder="200ml"
                  />
                </div>
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-gray-700">SKU</label>
                  <input
                    value={variant.sku}
                    onChange={(event) => handleVariantChange(index, 'sku', event.target.value)}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                    placeholder="SKU-200ML"
                  />
                </div>
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-gray-700">Price</label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-sm">RM</span>
                    <input
                      type="number"
                      step="0.01"
                      value={variant.price}
                      onChange={(event) => handleVariantChange(index, 'price', event.target.value)}
                      className="w-full rounded-lg border border-gray-300 pl-10 pr-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                      placeholder="0.00"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-gray-700">Cost Price</label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-sm">RM</span>
                    <input
                      type="number"
                      step="0.01"
                      value={variant.costPrice}
                      onChange={(event) => handleVariantChange(index, 'costPrice', event.target.value)}
                      className="w-full rounded-lg border border-gray-300 pl-10 pr-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                      placeholder="0.00"
                    />
                  </div>
                </div>
                {variant.trackStock && (
                  <>
                    <div className="space-y-2">
                      <label className="block text-sm font-medium text-gray-700">Stock</label>
                      <input
                        type="number"
                        value={variant.stock}
                        onChange={(event) => handleVariantChange(index, 'stock', event.target.value)}
                        className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                        placeholder="0"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="block text-sm font-medium text-gray-700">Low Stock Threshold</label>
                      <input
                        type="number"
                        value={variant.lowStockThreshold}
                        onChange={(event) => handleVariantChange(index, 'lowStockThreshold', event.target.value)}
                        className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                        placeholder="0"
                      />
                    </div>
                  </>
                )}
                <div className="flex items-center justify-between rounded-lg border bg-gray-50 px-4 py-3">
                  <div>
                    <p className="text-sm font-medium text-gray-900">Track Stock</p>
                    <p className="text-xs text-gray-500">Disable if inventory is not limited.</p>
                  </div>
                  <Switch
                    checked={variant.trackStock}
                    onCheckedChange={(checked) => handleVariantChange(index, 'trackStock', checked)}
                  />
                </div>
                <div className="flex items-center justify-between rounded-lg border bg-gray-50 px-4 py-3">
                  <div>
                    <p className="text-sm font-medium text-gray-900">Active</p>
                    <p className="text-xs text-gray-500">Hide variant from shop if disabled.</p>
                  </div>
                  <Switch
                    checked={variant.isActive}
                    onCheckedChange={(checked) => handleVariantChange(index, 'isActive', checked)}
                  />
                </div>
                <div className="space-y-2 md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700">Variant Image</label>
                  <div className="flex flex-wrap items-center gap-4">
                    {variant.imagePreview || variant.imageUrl ? (
                      <img
                        src={variant.imagePreview ?? variant.imageUrl ?? ''}
                        alt={variant.name || 'Variant image'}
                        className="h-20 w-20 rounded border border-gray-200 object-cover"
                      />
                    ) : (
                      <div className="flex h-20 w-20 items-center justify-center rounded border border-dashed border-gray-300 text-xs text-gray-400">
                        No image
                      </div>
                    )}
                    <div className="flex flex-wrap gap-2">
                      <label className="cursor-pointer rounded border border-gray-300 px-3 py-2 text-xs text-gray-600 hover:bg-gray-50">
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={(event) =>
                            handleVariantImageChange(index, event.target.files?.[0] ?? null)
                          }
                        />
                        Upload Image
                      </label>
                      {(variant.imagePreview || variant.imageUrl) && (
                        <button
                          type="button"
                          onClick={() => handleVariantImageRemove(index)}
                          className="rounded border border-red-200 px-3 py-2 text-xs text-red-600 hover:bg-red-50"
                        >
                          Remove
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* SEO & Metadata Section */}
      <div className="space-y-4">
        <div 
          className="pb-2 border-b border-gray-100 cursor-pointer hover:bg-gray-50 -mx-2 px-2 py-2 rounded-lg transition-colors"
          onClick={() => setIsSeoMetadataOpen(!isSeoMetadataOpen)}
        >
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold text-gray-900">{t('product.seoMetadata')}</h3>
              <p className="text-sm text-gray-500 mt-1">{t('product.seoMetadataDescription')}</p>
            </div>
            <div className="flex-shrink-0 ml-4">
              <i className={`fa-solid fa-chevron-${isSeoMetadataOpen ? 'up' : 'down'} text-gray-400 transition-transform duration-200`} />
            </div>
          </div>
        </div>
        {/* Layout: Meta OG Image on left, Meta fields on right */}
        {isSeoMetadataOpen && (
        <div className="flex flex-col gap-6 lg:flex-row mb-4">
          {/* Left: Meta OG Image URL */}
          <div className="w-full lg:w-1/2 space-y-1">
            <h3 className="text-sm font-medium text-gray-700">
              {t('product.metaOgImageUrl')}
            </h3>
            <p className="text-xs text-red-500 mb-2">Suggested size: 1200 x 630</p>
            {/* Hidden File Input */}
            <input
              ref={metaOgImageFileInputRef}
              id="metaOgImageFile"
              name="metaOgImageFile"
              type="file"
              accept="image/*"
              onChange={handleMetaFileChange}
              className="hidden"
            />
            {/* Upload Area */}
            <div
              className={`relative border-2 border-dashed rounded-lg p-4 cursor-pointer transition-colors ${
                metaOgImagePreview || form.metaOgImage
                  ? 'border-gray-300'
                  : 'border-gray-300 hover:border-blue-400'
              }`}
              onClick={() => {
                metaOgImageFileInputRef.current?.click()
              }}
            >
              {metaOgImagePreview || form.metaOgImage ? (
                // Image Preview with Replace and Remove Buttons
                <div className="relative group">
                  <img
                    src={metaOgImagePreview || form.metaOgImage}
                    alt={t('product.metaOgImageUrl')}
                    className="w-full h-64 object-contain rounded"
                  />
                  {/* Replace and Remove Buttons - Only show on hover */}
                  <div className="absolute top-2 right-2 flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation()
                        metaOgImageFileInputRef.current?.click()
                      }}
                      className="w-8 h-8 bg-blue-500/95 backdrop-blur-md text-white rounded-full flex items-center justify-center shadow-lg border border-blue-400/30 hover:bg-blue-600 hover:shadow-xl hover:scale-110 transition-all duration-200"
                      aria-label={t('product.replaceImage')}
                    >
                      <i className="fa-solid fa-image text-xs" />
                    </button>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation()
                        handleMetaImageRemove()
                      }}
                      className="w-8 h-8 bg-red-500/95 backdrop-blur-md text-white rounded-full flex items-center justify-center shadow-lg border border-red-400/30 hover:bg-red-600 hover:shadow-xl hover:scale-110 transition-all duration-200"
                      aria-label={t('product.removeImage')}
                    >
                      <i className="fa-solid fa-trash-can text-xs" />
                    </button>
                  </div>
                </div>
              ) : (
                // Empty Slot - Upload Placeholder
                <div className="flex flex-col items-center justify-center py-16">
                  <i className="fa-solid fa-cloud-arrow-up text-4xl text-gray-400 mb-2" />
                  <p className="text-sm text-gray-600">Click to upload</p>
                </div>
              )}
            </div>
            <p className="text-xs text-slate-500 mt-2">
              Used for social previews when sharing this product.
            </p>
          </div>
          {/* Right: Meta Title, Keywords, Description - Vertical layout */}
          <div className="w-full lg:w-1/2 space-y-4">
            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700" htmlFor="metaTitle">
                {t('product.metaTitle')}
              </label>
              <input
                id="metaTitle"
                name="metaTitle"
                value={form.metaTitle}
                onChange={handleChange}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                placeholder={t('product.metaTitlePlaceholder')}
              />
            </div>
            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700" htmlFor="metaKeywords">
                {t('product.metaKeywords')}
              </label>
              <input
                id="metaKeywords"
                name="metaKeywords"
                value={form.metaKeywords}
                onChange={handleChange}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                placeholder={t('product.metaKeywordsPlaceholder')}
              />
            </div>
            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700" htmlFor="metaDescription">
                {t('product.metaDescription')}
              </label>
              <textarea
                id="metaDescription"
                name="metaDescription"
                value={form.metaDescription}
                onChange={handleChange}
                rows={3}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors resize-none"
                placeholder={t('product.metaDescriptionPlaceholder')}
              />
            </div>
          </div>
        </div>
        )}
      </div>

      {/* Form Actions Bar */}
      <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-200">
        <button
          type="button"
          onClick={handleCancel}
          className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
        >
          {t('common.cancel')}
        </button>
        <button
          type="submit"
          disabled={submitting}
          className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {submitting ? (
            <span className="inline-flex items-center gap-2">
              <i className="fa-solid fa-spinner fa-spin" />
              {t('product.saving')}
            </span>
          ) : (
            <span className="inline-flex items-center gap-2">
              <i className="fa-solid fa-check" />
              {t('common.save')}
            </span>
          )}
        </button>
      </div>

    </form>
  )
}
