'use client'

import AdminFilters, {
  AdminFilterValues,
  adminFiltersFormId,
  emptyAdminFilters,
  AdminRoleOption,
} from './AdminFilters'
import CrmFilterModalShell from './CrmFilterModalShell'
import { useI18n } from '@/lib/i18n'

interface Props {
  inputs: AdminFilterValues
  onChange: (values: AdminFilterValues) => void
  onSubmit: (values: AdminFilterValues) => void
  onReset: () => void
  onClose: () => void
  disabled?: boolean
  roles: AdminRoleOption[]
  rolesLoading: boolean
}

export default function AdminFiltersWrapper({
  inputs,
  onChange,
  onSubmit,
  onReset,
  onClose,
  disabled = false,
  roles,
  rolesLoading,
}: Props) {
  const { t } = useI18n()

  const handleReset = () => {
    onChange({ ...emptyAdminFilters })
    onReset()
  }

  const handleSubmit = (values: AdminFilterValues) => {
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
            form={adminFiltersFormId}
            className="px-4 py-2 text-sm text-gray-700 border border-gray-300 rounded-md hover:bg-gray-200"
          >
            {t('common.reset')}
          </button>
          <button
            type="submit"
            form={adminFiltersFormId}
            className="px-4 py-2 text-sm text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50"
            disabled={disabled}
          >
            {t('common.applyFilter')}
          </button>
        </>
      }
    >
      <AdminFilters
        values={inputs}
        onChange={onChange}
        onSubmit={handleSubmit}
        onReset={handleReset}
        roles={roles}
        rolesLoading={rolesLoading}
      />
    </CrmFilterModalShell>
  )
}
