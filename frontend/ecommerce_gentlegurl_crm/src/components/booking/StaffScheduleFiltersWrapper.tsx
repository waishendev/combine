'use client'

import StaffScheduleFilters, {
  StaffScheduleFilterValues,
  staffScheduleFiltersFormId,
  emptyStaffScheduleFilters,
} from './StaffScheduleFilters'
import CrmFilterModalShell from '@/components/CrmFilterModalShell'
import { useI18n } from '@/lib/i18n'

interface Props {
  inputs: StaffScheduleFilterValues
  onChange: (values: StaffScheduleFilterValues) => void
  onSubmit: (values: StaffScheduleFilterValues) => void
  onReset: () => void
  onClose: () => void
  disabled?: boolean
  staffs: Array<{ id: number; name: string }>
}

export default function StaffScheduleFiltersWrapper({
  inputs,
  onChange,
  onSubmit,
  onReset,
  onClose,
  disabled = false,
  staffs,
}: Props) {
  const { t } = useI18n()

  const handleReset = () => {
    onChange({ ...emptyStaffScheduleFilters })
    onReset()
  }

  const handleSubmit = (values: StaffScheduleFilterValues) => {
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
            form={staffScheduleFiltersFormId}
            className="px-4 py-2 text-sm text-gray-700 border border-gray-300 rounded-md hover:bg-gray-200"
          >
            {t('common.reset')}
          </button>
          <button
            type="submit"
            form={staffScheduleFiltersFormId}
            className="px-4 py-2 text-sm text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50"
            disabled={disabled}
          >
            {t('common.applyFilter')}
          </button>
        </>
      }
    >
      <StaffScheduleFilters
        values={inputs}
        onChange={onChange}
        onSubmit={handleSubmit}
        onReset={handleReset}
        staffs={staffs}
      />
    </CrmFilterModalShell>
  )
}
