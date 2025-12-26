import { useI18n } from "@/lib/i18n";


interface TableEmptyStateProps {
  colSpan: number
  message?: string
  actionLabel?: string
  onAction?: () => void
  withBorder?: boolean
}

export default function TableEmptyState({
  colSpan,
  message,
  actionLabel,
  onAction,
  withBorder = false,
}: TableEmptyStateProps) {
  const { t } = useI18n()
  return (
    <tr>
      <td
        colSpan={colSpan}
        className={`px-4 py-8 text-center text-gray-500 ${withBorder ? 'border border-gray-200' : ''}`}
      >
        <div className="flex flex-col items-center gap-3">
          <span>{message ?? t('table.no_data')}</span>
          {actionLabel && onAction ? (
            <button
              type="button"
              onClick={onAction}
              className="inline-flex items-center rounded border border-gray-300 px-3 py-1 text-xs text-gray-700 hover:bg-gray-100"
            >
              {actionLabel}
            </button>
          ) : null}
        </div>
      </td>
    </tr>
  )
}
