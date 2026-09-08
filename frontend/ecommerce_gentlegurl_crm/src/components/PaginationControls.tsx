import { useMemo } from 'react'
import { useI18n } from '@/lib/i18n'

interface PaginationControlsProps {
  currentPage: number
  totalPages: number
  pageSize: number
  onPageChange: (page: number) => void
  disabled?: boolean
}

type PageItem = number | 'ellipsis'

/**
 * Sliding window of consecutive pages (default 5). Trailing/leading … means
 * there are more pages — does not pin the last/first page number after ….
 */
function buildPageItems(currentPage: number, totalPages: number, windowSize = 5): PageItem[] {
  if (totalPages <= 0) return []

  const current = Math.min(Math.max(currentPage, 1), totalPages)

  if (totalPages <= windowSize) {
    return Array.from({ length: totalPages }, (_, i) => i + 1)
  }

  let start = Math.max(1, current - Math.floor((windowSize - 1) / 2))
  let end = start + windowSize - 1
  if (end > totalPages) {
    end = totalPages
    start = end - windowSize + 1
  }

  const items: PageItem[] = []
  if (start > 1) {
    items.push('ellipsis')
  }
  for (let page = start; page <= end; page += 1) {
    items.push(page)
  }
  if (end < totalPages) {
    items.push('ellipsis')
  }

  return items
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
  const items = useMemo(
    () => buildPageItems(currentPage, totalPages),
    [currentPage, totalPages],
  )

  const touchBtn =
    'touch-manipulation select-none inline-flex min-h-[44px] shrink-0 items-center justify-center rounded-md border text-sm font-medium shadow-sm transition-colors disabled:pointer-events-none disabled:opacity-50'

  const navBtn = `${touchBtn} min-w-[44px] border-gray-300 bg-white px-3 text-gray-800 hover:bg-gray-50 active:bg-gray-100`

  const pageIdle = `${touchBtn} min-w-[44px] border-gray-300 bg-white text-gray-800 hover:bg-gray-50 active:bg-gray-100`

  const pageActive = `${touchBtn} min-w-[44px] border-blue-600 bg-blue-500 text-white hover:bg-blue-600 active:bg-blue-700`

  return (
    <nav
      className="relative z-10 mt-6 flex touch-manipulation flex-wrap items-center justify-center gap-2 sm:justify-end"
      aria-label="Pagination"
    >
      <button
        type="button"
        className={`${navBtn} min-w-[5.5rem] px-4`}
        onClick={() => onPageChange(currentPage - 1)}
        disabled={disabled || currentPage === 1}
      >
        {t('previous')}
      </button>
      {items.map((item, index) =>
        item === 'ellipsis' ? (
          <span
            key={`ellipsis-${index}`}
            className={`${touchBtn} min-w-[44px] cursor-default border-transparent bg-transparent text-gray-500 shadow-none`}
            aria-hidden="true"
          >
            …
          </span>
        ) : (
          <button
            type="button"
            key={item}
            onClick={() => onPageChange(item)}
            className={item === currentPage ? pageActive : pageIdle}
            disabled={disabled}
            aria-current={item === currentPage ? 'page' : undefined}
          >
            {item}
          </button>
        ),
      )}
      <button
        type="button"
        className={`${navBtn} min-w-[5.5rem] px-4`}
        onClick={() => onPageChange(currentPage + 1)}
        disabled={disabled || currentPage === totalPages || totalPages === 0}
      >
        {t('next')}
      </button>
    </nav>
  )
}
