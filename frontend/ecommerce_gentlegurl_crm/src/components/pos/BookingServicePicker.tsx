'use client'

import { PosCatalogInCartBadge, posCatalogInCartBorderClass } from '@/components/pos/PosCatalogInCartIndicator'

type BookingServicePickerCategory = {
  id: number
  name: string
  cn_name?: string | null
}

type BookingServicePickerService = {
  id: number
  name: string
  cn_name?: string | null
  duration_min?: number | null
  price?: number | null
  service_price?: number | null
  price_mode?: string | null
  price_range_min?: number | null
  price_range_max?: number | null
  category_ids?: number[]
  categories?: BookingServicePickerCategory[]
}

export function bookingServiceMatchesPickerCategory(service: BookingServicePickerService, categoryId: number | null): boolean {
  if (!categoryId) return true
  return (service.category_ids ?? service.categories?.map((category) => category.id) ?? []).includes(categoryId)
}

function formatBookingServicePickerPrice(service: BookingServicePickerService): string {
  const isRange = service.price_mode === 'range' && service.price_range_min != null && service.price_range_max != null
  if (isRange) {
    return `RM${Number(service.price_range_min).toFixed(2)} - RM${Number(service.price_range_max).toFixed(2)}`
  }

  const amount = Number.isFinite(Number(service.price)) && Number(service.price) > 0
    ? Number(service.price)
    : Number(service.service_price ?? 0)
  return `RM${amount.toFixed(2)}`
}

function serviceMatchesQuery(service: BookingServicePickerService, query: string): boolean {
  const keyword = query.trim().toLowerCase()
  if (!keyword) return true

  return service.name.toLowerCase().includes(keyword) || (service.cn_name ?? '').toLowerCase().includes(keyword)
}

export default function BookingServicePicker({
  categories,
  services,
  selectedCategoryId,
  onCategoryChange,
  searchQuery,
  onSearchQueryChange,
  selectedServiceId,
  onSelectService,
  serviceCartQtyById,
  loading = false,
  emptyMessage = 'No services found.',
  searchPlaceholder = 'Search service name...',
  excludeServiceIds = [],
  className = '',
}: {
  categories: BookingServicePickerCategory[]
  services: BookingServicePickerService[]
  selectedCategoryId: number | null
  onCategoryChange: (categoryId: number | null) => void
  searchQuery: string
  onSearchQueryChange: (query: string) => void
  selectedServiceId?: number | null
  onSelectService: (service: BookingServicePickerService) => void
  serviceCartQtyById?: Map<number, number>
  loading?: boolean
  emptyMessage?: string
  searchPlaceholder?: string
  excludeServiceIds?: number[]
  className?: string
}) {
  const excluded = new Set(excludeServiceIds)
  const filteredServices = services
    .filter((service) => !excluded.has(service.id))
    .filter((service) => bookingServiceMatchesPickerCategory(service, selectedCategoryId))
    .filter((service) => serviceMatchesQuery(service, searchQuery))

  const chipClass = (active: boolean) => `rounded-full border px-3 py-1.5 text-xs font-semibold transition sm:px-4 sm:py-2 sm:text-sm ${
    active
      ? 'border-blue-600 bg-blue-600 text-white shadow-sm'
      : 'border-gray-200 bg-white text-gray-700 hover:border-blue-300 hover:bg-blue-50'
  }`

  return (
    <div className={`space-y-3 ${className}`}>
      <div>
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-600">Category</p>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => onCategoryChange(null)} className={chipClass(selectedCategoryId == null)}>
            All
          </button>
          {categories.map((category) => (
            <button key={category.id} type="button" onClick={() => onCategoryChange(category.id)} className={chipClass(selectedCategoryId === category.id)}>
              {category.cn_name ? `${category.name} / ${category.cn_name}` : category.name}
            </button>
          ))}
        </div>
      </div>

      <label className="block">
        <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-gray-600">Search</span>
        <input
          type="search"
          value={searchQuery}
          onChange={(event) => onSearchQueryChange(event.target.value)}
          placeholder={searchPlaceholder}
          className="h-11 w-full rounded-xl border border-gray-300 bg-white px-4 text-sm text-gray-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
        />
      </label>

      <div>
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-600">Services</p>
        {loading ? (
          <div className="rounded-xl border border-gray-200 bg-gray-50 p-4 text-sm text-gray-500">Loading services...</div>
        ) : filteredServices.length === 0 ? (
          <div className="rounded-xl border border-gray-200 bg-gray-50 p-4 text-sm text-gray-500">{emptyMessage}</div>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {filteredServices.map((service) => {
              const selected = selectedServiceId === service.id
              const cartQty = serviceCartQtyById?.get(service.id) ?? 0
              const isInCart = cartQty > 0
              return (
                <button
                  key={service.id}
                  type="button"
                  onClick={() => onSelectService(service)}
                  className={`relative flex min-h-[150px] w-full flex-col rounded-2xl border-2 p-4 text-left transition ${
                    selected
                      ? 'border-blue-600 bg-blue-50 shadow-md ring-2 ring-blue-500/20'
                      : isInCart
                        ? posCatalogInCartBorderClass(true)
                        : 'border-gray-200 bg-white shadow-sm hover:border-blue-300 hover:bg-blue-50/40 hover:shadow-md'
                  }`}
                >
                  <PosCatalogInCartBadge qty={cartQty} />
                  <span className="break-words text-base font-bold leading-snug text-gray-900">{service.name || '—'}</span>
                  {service.cn_name ? <span className="mt-1 break-words text-sm leading-snug text-gray-500">{service.cn_name}</span> : null}
                  <span className="mt-auto pt-4 text-sm font-medium text-gray-600">{Number(service.duration_min ?? 0)} mins</span>
                  <span className="mt-1 break-words text-sm font-bold text-blue-700">{formatBookingServicePickerPrice(service)}</span>
                </button>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
