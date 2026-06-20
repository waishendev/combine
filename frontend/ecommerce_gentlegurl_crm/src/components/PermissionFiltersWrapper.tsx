'use client'

import PermissionFilters, {
  PermissionFilterValues,
  permissionFiltersFormId,
  emptyPermissionFilters,
  PermissionGroupOption,
} from './PermissionFilters'
import CrmFilterModalShell from './CrmFilterModalShell'
import { useI18n } from '@/lib/i18n'

interface Props {
  inputs: PermissionFilterValues
  onChange: (values: PermissionFilterValues) => void
  onSubmit: (values: PermissionFilterValues) => void
  onReset: () => void
  onClose: () => void
  disabled?: boolean
  groups: PermissionGroupOption[]
  groupsLoading: boolean
}

export default function PermissionFiltersWrapper({
  inputs,
  onChange,
  onSubmit,
  onReset,
  onClose,
  disabled = false,
  groups,
  groupsLoading,
}: Props) {
  const { t } = useI18n()

  const handleReset = () => {
    onChange({ ...emptyPermissionFilters })
    onReset()
  }

  const handleSubmit = (values: PermissionFilterValues) => {
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
            form={permissionFiltersFormId}
            className="px-4 py-2 text-sm text-gray-700 border border-gray-300 rounded-md hover:bg-gray-200"
          >
            {t('common.reset')}
          </button>
          <button
            type="submit"
            form={permissionFiltersFormId}
            className="px-4 py-2 text-sm text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50"
            disabled={disabled}
          >
            {t('common.applyFilter')}
          </button>
        </>
      }
    >
      <PermissionFilters
        values={inputs}
        onChange={onChange}
        onSubmit={handleSubmit}
        onReset={handleReset}
        groups={groups}
        groupsLoading={groupsLoading}
      />
    </CrmFilterModalShell>
  )
}

