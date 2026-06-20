'use client'

import RoleFilters, {
  RoleFilterValues,
  emptyRoleFilters,
  roleFiltersFormId,
} from './RoleFilters'
import CrmFilterModalShell from './CrmFilterModalShell'
import { useI18n } from '@/lib/i18n'

interface Props {
  inputs: RoleFilterValues
  onChange: (values: RoleFilterValues) => void
  onSubmit: (values: RoleFilterValues) => void
  onReset: () => void
  onClose: () => void
  disabled?: boolean
}

export default function RoleFiltersWrapper({
  inputs,
  onChange,
  onSubmit,
  onReset,
  onClose,
  disabled = false,
}: Props) {
  const { t } = useI18n()

  const handleReset = () => {
    onChange({ ...emptyRoleFilters })
    onReset()
  }

  const handleSubmit = (values: RoleFilterValues) => {
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
            form={roleFiltersFormId}
            className="rounded-md border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-200"
          >
            {t('common.reset')}
          </button>
          <button
            type="submit"
            form={roleFiltersFormId}
            className="rounded-md bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700 disabled:opacity-50"
            disabled={disabled}
          >
            {t('common.applyFilter')}
          </button>
        </>
      }
    >
      <RoleFilters
        values={inputs}
        onChange={onChange}
        onSubmit={handleSubmit}
        onReset={handleReset}
      />
    </CrmFilterModalShell>
  )
}
