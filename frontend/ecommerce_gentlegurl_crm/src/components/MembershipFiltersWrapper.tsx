'use client'

import MembershipFilters, {
  MembershipFilterValues,
  membershipFiltersFormId,
  emptyMembershipFilters,
} from './MembershipFilters'
import CrmFilterModalShell from './CrmFilterModalShell'
import { useI18n } from '@/lib/i18n'

interface Props {
  inputs: MembershipFilterValues
  onChange: (values: MembershipFilterValues) => void
  onSubmit: (values: MembershipFilterValues) => void
  onReset: () => void
  onClose: () => void
  disabled?: boolean
}

export default function MembershipFiltersWrapper({
  inputs,
  onChange,
  onSubmit,
  onReset,
  onClose,
  disabled = false,
}: Props) {
  const { t } = useI18n()

  const handleReset = () => {
    onChange({ ...emptyMembershipFilters })
    onReset()
  }

  const handleSubmit = (values: MembershipFilterValues) => {
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
            form={membershipFiltersFormId}
            className="px-4 py-2 text-sm text-gray-700 border border-gray-300 rounded-md hover:bg-gray-200"
          >
            {t('common.reset')}
          </button>
          <button
            type="submit"
            form={membershipFiltersFormId}
            className="px-4 py-2 text-sm text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50"
            disabled={disabled}
          >
            {t('common.applyFilter')}
          </button>
        </>
      }
    >
      <MembershipFilters
        values={inputs}
        onChange={onChange}
        onSubmit={handleSubmit}
        onReset={handleReset}
      />
    </CrmFilterModalShell>
  )
}
