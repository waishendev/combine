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
      {hasPrevGroup && (
        <button
          type="button"
          key="prev-ellipsis"
          onClick={() => onPageChange(start - 1)}
          className={navBtn}
          disabled={disabled}
          aria-label="Show previous pages"
        >
          …
        </button>
      )}
      {pages.map((page) => (
        <button
          type="button"
          key={page}
          onClick={() => onPageChange(page)}
          className={page === currentPage ? pageActive : pageIdle}
          disabled={disabled}
          aria-current={page === currentPage ? 'page' : undefined}
        >
          {page}
        </button>
      ))}
      {hasNextGroup && (
        <button
          type="button"
          key="next-ellipsis"
          onClick={() => onPageChange(end + 1)}
          className={navBtn}
          disabled={disabled}
          aria-label="Show more pages"
        >
          …
        </button>
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

