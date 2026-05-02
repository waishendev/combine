'use client'

import { useMemo, useState } from 'react'

import { useI18n } from '@/lib/i18n'

export type BookingCategoryServiceOption = { id: number; name: string }

interface BookingCategoryServicesSectionProps {
  services: BookingCategoryServiceOption[]
  serviceIds: number[]
  onToggle: (id: number) => void
  disabled?: boolean
}

export default function BookingCategoryServicesSection({
  services,
  serviceIds,
  onToggle,
  disabled,
}: BookingCategoryServicesSectionProps) {
  const { t } = useI18n()
  const [query, setQuery] = useState('')

  const selectedLabel = useMemo(
    () => services.filter((s) => serviceIds.includes(s.id)).map((s) => s.name).join(', '),
    [services, serviceIds],
  )

  const filteredServices = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return services
    return services.filter((s) => s.name.toLowerCase().includes(q))
  }, [services, query])

  return (
    <div className="rounded-lg border border-gray-200 p-3">
      <p className="text-sm font-medium text-gray-900">Services</p>
      <p className="mb-2 text-xs text-gray-500">{selectedLabel || 'No services selected'}</p>
      <label className="mb-2 block">
        <span className="sr-only">{t('booking.servicesSearchPlaceholder')}</span>
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t('booking.servicesSearchPlaceholder')}
          disabled={disabled}
          autoComplete="off"
          className="w-full rounded border border-gray-300 px-3 py-2 text-sm placeholder:text-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:opacity-60"
        />
      </label>
      <div className="grid max-h-40 grid-cols-2 gap-2 overflow-auto md:grid-cols-3">
        {services.length > 0 && filteredServices.length === 0 ? (
          <p className="col-span-full py-2 text-sm text-gray-500">{t('booking.servicesNoMatches')}</p>
        ) : filteredServices.length === 0 ? null : (
          filteredServices.map((svc) => (
            <label key={svc.id} className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={serviceIds.includes(svc.id)}
                onChange={() => onToggle(svc.id)}
                disabled={disabled}
              />
              <span className="break-words">{svc.name}</span>
            </label>
          ))
        )}
      </div>
    </div>
  )
}
