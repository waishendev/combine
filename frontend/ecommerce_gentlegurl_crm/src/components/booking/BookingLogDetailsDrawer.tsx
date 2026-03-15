'use client'

import { useI18n } from '@/lib/i18n'

type LogRow = {
  id: number
  booking_id: number | null
  actor_type: string
  actor_name: string | null
  action: string
  meta: Record<string, unknown> | null
  created_at: string
}

interface BookingLogDetailsDrawerProps {
  log: LogRow
  onClose: () => void
}

export default function BookingLogDetailsDrawer({
  log,
  onClose,
}: BookingLogDetailsDrawerProps) {
  const { t } = useI18n()

  const formatDate = (dateString: string) => {
    try {
      const date = new Date(dateString)
      return date.toLocaleString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      })
    } catch {
      return dateString
    }
  }

  const getActionBadgeColor = (action: string) => {
    if (action.includes('CREATE') || action.includes('GRANT')) {
      return 'bg-green-100 text-green-800'
    }
    if (action.includes('UPDATE') || action.includes('MODIFY')) {
      return 'bg-blue-100 text-blue-800'
    }
    if (action.includes('DELETE') || action.includes('REMOVE')) {
      return 'bg-red-100 text-red-800'
    }
    if (action.includes('CANCEL')) {
      return 'bg-orange-100 text-orange-800'
    }
    return 'bg-gray-100 text-gray-800'
  }

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
            Log Details
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
                <p className="text-sm font-semibold text-gray-900">Time</p>
              </div>
              <div className="px-4 py-3">
                <p className="text-sm text-gray-700">{formatDate(log.created_at)}</p>
              </div>
            </section>

            <section className="rounded border border-gray-200">
              <div className="border-b border-gray-200 bg-gray-50 px-4 py-3">
                <p className="text-sm font-semibold text-gray-900">Booking ID</p>
              </div>
              <div className="px-4 py-3">
                {log.booking_id ? (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-50 px-3 py-1 text-xs font-medium text-blue-700">
                    <i className="fa-solid fa-hashtag" />
                    {log.booking_id}
                  </span>
                ) : (
                  <span className="text-sm text-gray-400">—</span>
                )}
              </div>
            </section>

            <section className="rounded border border-gray-200">
              <div className="border-b border-gray-200 bg-gray-50 px-4 py-3">
                <p className="text-sm font-semibold text-gray-900">Actor</p>
              </div>
              <div className="px-4 py-3">
                <span className="inline-flex items-center gap-2 rounded-md bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700">
                  <i className="fa-solid fa-user-tag" />
                  {log.actor_type}
                </span>
              </div>
            </section>

            <section className="rounded border border-gray-200">
              <div className="border-b border-gray-200 bg-gray-50 px-4 py-3">
                <p className="text-sm font-semibold text-gray-900">Actor Name</p>
              </div>
              <div className="px-4 py-3">
                {log.actor_name ? (
                  <span className="inline-flex items-center gap-1.5 rounded-md bg-purple-50 px-2.5 py-1 text-xs font-medium text-purple-700">
                    <i className="fa-solid fa-user-circle" />
                    {log.actor_name}
                  </span>
                ) : (
                  <span className="text-sm text-gray-400">—</span>
                )}
              </div>
            </section>

            <section className="rounded border border-gray-200">
              <div className="border-b border-gray-200 bg-gray-50 px-4 py-3">
                <p className="text-sm font-semibold text-gray-900">Action</p>
              </div>
              <div className="px-4 py-3">
                <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ${getActionBadgeColor(log.action)}`}>
                  <i className="fa-solid fa-circle text-[6px]" />
                  {log.action}
                </span>
              </div>
            </section>

            <section className="rounded border border-gray-200">
              <div className="border-b border-gray-200 bg-gray-50 px-4 py-3">
                <p className="text-sm font-semibold text-gray-900">
                  Metadata {log.meta && Object.keys(log.meta).length > 0 && `(${Object.keys(log.meta).length})`}
                </p>
              </div>
              <div className="px-4 py-3">
                {log.meta && Object.keys(log.meta).length > 0 ? (
                  <div className="rounded-lg bg-slate-50 p-3">
                    <pre className="whitespace-pre-wrap break-words text-xs text-slate-700 font-mono overflow-x-auto">
                      {JSON.stringify(log.meta, null, 2)}
                    </pre>
                  </div>
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
