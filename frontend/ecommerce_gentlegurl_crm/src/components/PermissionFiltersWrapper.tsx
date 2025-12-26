'use client'

import PermissionFilters, {
  PermissionFilterValues,
  permissionFiltersFormId,
  emptyPermissionFilters,
  PermissionGroupOption,
} from './PermissionFilters'
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
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div
        className="absolute inset-0 bg-black/50"
        onClick={onClose}
      />
      <div className="relative w-full max-w-xl mx-auto bg-white rounded-lg shadow-lg">
        <div className="flex items-center justify-between border-b border-gray-300 px-5 py-4">
          <h2 className="text-lg font-semibold">
            {t('common.filter')}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 text-2xl leading-none"
            aria-label={t('common.close')}
          >
            <i className="fa-solid fa-xmark" />
          </button>
        </div>

        <div className="p-5">
          <PermissionFilters
            values={inputs}
            onChange={onChange}
            onSubmit={handleSubmit}
            onReset={handleReset}
            groups={groups}
            groupsLoading={groupsLoading}
          />
        </div>

        <div className="flex items-center justify-between border-t border-gray-300 px-5 py-3">
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
        </div>
      </div>
    </div>
  )
}

