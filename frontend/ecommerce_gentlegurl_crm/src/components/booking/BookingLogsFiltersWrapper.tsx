'use client'

import BookingLogsFilters, {
  BookingLogsFilterValues,
  bookingLogsFiltersFormId,
  emptyBookingLogsFilters,
} from './BookingLogsFilters'
import CrmFilterModalShell from '@/components/CrmFilterModalShell'
import { useI18n } from '@/lib/i18n'

interface Props {
  inputs: BookingLogsFilterValues
  onChange: (values: BookingLogsFilterValues) => void
  onSubmit: (values: BookingLogsFilterValues) => void
  onReset: () => void
  onClose: () => void
  disabled?: boolean
}

export default function BookingLogsFiltersWrapper({
  inputs,
  onChange,
  onSubmit,
  onReset,
  onClose,
  disabled = false,
}: Props) {
  const { t } = useI18n()

  const handleReset = () => {
    onChange({ ...emptyBookingLogsFilters })
    onReset()
  }

  const handleSubmit = (values: BookingLogsFilterValues) => {
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
            form={bookingLogsFiltersFormId}
            className="px-4 py-2 text-sm text-gray-700 border border-gray-300 rounded-md hover:bg-gray-200"
          >
            {t('common.reset')}
          </button>
          <button
            type="submit"
            form={bookingLogsFiltersFormId}
            className="px-4 py-2 text-sm text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50"
            disabled={disabled}
          >
            {t('common.applyFilter')}
          </button>
        </>
      }
    >
      <BookingLogsFilters
        values={inputs}
        onChange={onChange}
        onSubmit={handleSubmit}
        onReset={handleReset}
      />
    </CrmFilterModalShell>
  )
}
