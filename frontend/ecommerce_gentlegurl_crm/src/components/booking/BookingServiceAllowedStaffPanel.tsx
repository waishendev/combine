'use client'

import { useMemo } from 'react'

import { BookingServiceRowData } from './BookingServiceRow'
import { useI18n } from '@/lib/i18n'

interface BookingServiceAllowedStaffPanelProps {
  service: BookingServiceRowData
  onClose: () => void
}

export default function BookingServiceAllowedStaffPanel({
  service,
  onClose,
}: BookingServiceAllowedStaffPanelProps) {
  const { t } = useI18n()

  const staffNames = useMemo(() => {
    const arr = service.allowedStaffNames
    if (!Array.isArray(arr)) return []
    return arr.filter((name): name is string => typeof name === 'string' && name.trim().length > 0)
  }, [service.allowedStaffNames])

  const count =
    service.allowedStaffCount != null && service.allowedStaffCount > 0
      ? service.allowedStaffCount
      : staffNames.length

  return (
    <div
      className="fixed inset-0 z-50 flex bg-black/40 px-0 md:bg-transparent md:px-0"
      role="dialog"
      aria-modal="true"
      onClick={onClose}
    >
      <div className="hidden flex-1 bg-black/40 md:block" />
      <aside
        className="ml-auto flex h-full w-full max-w-md flex-col bg-white shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-gray-200 px-5 py-4">
          <h3 className="text-sm font-semibold text-gray-900">
            {t('booking.allowedStaffDetailTitle')}
          </h3>
          <button
            type="button"
            className="text-gray-500 hover:text-gray-700"
            onClick={onClose}
            aria-label={t('common.close')}
          >
            <i className="fa-solid fa-xmark" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-4">
          <div className="space-y-5">
            <section className="rounded border border-gray-200">
              <div className="border-b border-gray-200 bg-gray-50 px-4 py-3">
                <p className="text-sm font-semibold text-gray-900">{service.name}</p>
                {service.serviceType ? (
                  <p className="mt-1 text-xs text-gray-600">{service.serviceType}</p>
                ) : null}
              </div>
            </section>

            <section className="rounded border border-gray-200">
              <div className="border-b border-gray-200 bg-gray-50 px-4 py-3">
                <p className="text-sm font-semibold text-gray-900">
                  {t('booking.allowedStaffListHeading')} ({count})
                </p>
              </div>
              <div className="px-4 py-3">
                {staffNames.length > 0 ? (
                  <ul className="space-y-2 text-sm text-gray-700">
                    {staffNames.map((name, index) => (
                      <li key={`${name}-${index}`} className="rounded border border-gray-200 px-3 py-2">
                        <p className="font-medium text-gray-900">{name}</p>
                      </li>
                    ))}
                  </ul>
                ) : count > 0 ? (
                  <p className="text-sm text-gray-600">{t('booking.staffNamesUnavailable')}</p>
                ) : (
                  <p className="text-sm text-gray-500">{t('table.no_data')}</p>
                )}
              </div>
            </section>
          </div>
        </div>
      </aside>
    </div>
  )
}
