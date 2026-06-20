'use client'

import BookingServiceFilters, {
  type BookingServiceCategoryOption,
  BookingServiceFilterValues,
  bookingServiceFiltersFormId,
  emptyBookingServiceFilters,
} from './BookingServiceFilters'
import CrmFilterModalShell from '@/components/CrmFilterModalShell'
import { useI18n } from '@/lib/i18n'

interface Props {
  inputs: BookingServiceFilterValues
  categories: BookingServiceCategoryOption[]
  onChange: (values: BookingServiceFilterValues) => void
  onSubmit: (values: BookingServiceFilterValues) => void
  onReset: () => void
  onClose: () => void
  disabled?: boolean
}

export default function BookingServiceFiltersWrapper({
  inputs,
  categories,
  onChange,
  onSubmit,
  onReset,
  onClose,
  disabled = false,
}: Props) {
  const { t } = useI18n()

  const handleReset = () => {
    onChange({ ...emptyBookingServiceFilters })
    onReset()
  }

  const handleSubmit = (values: BookingServiceFilterValues) => {
    onSubmit(values)
    onClose()
  }

  return (
    <CrmFilterModalShell
      title={t('common.filter')}
      onClose={onClose}
      closeLabel={t('common.close')}
      footer={
        <>
          <button
            type="reset"
            form={bookingServiceFiltersFormId}
            className="px-4 py-2 text-sm text-gray-700 border border-gray-300 rounded-md hover:bg-gray-200"
          >
            {t('common.reset')}
          </button>
          <button
            type="submit"
            form={bookingServiceFiltersFormId}
            className="px-4 py-2 text-sm text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50"
            disabled={disabled}
          >
            {t('common.applyFilter')}
          </button>
        </>
      }
    >
      <BookingServiceFilters
        values={inputs}
        categories={categories}
        onChange={onChange}
        onSubmit={handleSubmit}
        onReset={handleReset}
      />
    </CrmFilterModalShell>
  )
}
