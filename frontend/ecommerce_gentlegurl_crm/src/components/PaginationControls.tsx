import { useMemo } from 'react'
import { useI18n } from '@/lib/i18n'

interface PaginationControlsProps {
  currentPage: number
  totalPages: number
  pageSize: number
  onPageChange: (page: number) => void
  disabled?: boolean
}

export default function PaginationControls({
  currentPage,
  totalPages,
  pageSize,
  onPageChange,
  disabled = false,
}: PaginationControlsProps) {
  const { t } = useI18n()
  void pageSize
  const { pages, hasPrevGroup, hasNextGroup, start, end } = useMemo(() => {
    const MAX_VISIBLE = 10
    const currentGroup = Math.floor((currentPage - 1) / MAX_VISIBLE)
    const s = currentGroup * MAX_VISIBLE + 1
    const e = Math.min(s + MAX_VISIBLE - 1, totalPages)
    return {
      pages: Array.from({ length: e - s + 1 }, (_, i) => s + i),
      hasPrevGroup: s > 1,
      hasNextGroup: e < totalPages,
      start: s,
      end: e,
    }
  }, [currentPage, totalPages])

  return (
    <div className="flex items-center justify-end mt-4">
      <div className="flex items-center space-x-2">
        <button
          className="px-3 py-1 border rounded disabled:opacity-50"
          onClick={() => onPageChange(currentPage - 1)}
          disabled={disabled || currentPage === 1}
        >
          {t('previous')}
        </button>
        {hasPrevGroup && (
          <button
            key="prev-ellipsis"
            onClick={() => onPageChange(start - 1)}
            className="px-3 py-1 border rounded"
            disabled={disabled}
          >
            ...
          </button>
        )}
        {pages.map((page) => (
          <button
            key={page}
            onClick={() => onPageChange(page)}
            className={`px-3 py-1 border rounded ${page === currentPage ? 'bg-blue-500 text-white' : ''}`}
            disabled={disabled}
          >
            {page}
          </button>
        ))}
        {hasNextGroup && (
          <button
            key="next-ellipsis"
            onClick={() => onPageChange(end + 1)}
            className="px-3 py-1 border rounded"
            disabled={disabled}
          >
            ...
          </button>
        )}
        <button
          className="px-3 py-1 border rounded disabled:opacity-50"
          onClick={() => onPageChange(currentPage + 1)}
          disabled={
            disabled || currentPage === totalPages || totalPages === 0
          }
        >
          {t('next')}
        </button>
      </div>
    </div>
  )
}

