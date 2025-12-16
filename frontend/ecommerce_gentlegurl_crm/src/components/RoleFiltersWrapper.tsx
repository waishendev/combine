'use client'

import RoleFilters, {
  RoleFilterValues,
  emptyRoleFilters,
  roleFiltersFormId,
} from './RoleFilters'
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
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative mx-auto w-full max-w-xl rounded-lg bg-white shadow-lg">
        <div className="flex items-center justify-between border-b border-gray-300 px-5 py-4">
          <h2 className="text-lg font-semibold">{t('common.filter')}</h2>
          <button
            onClick={onClose}
            className="text-2xl leading-none text-gray-500 hover:text-gray-700"
            aria-label={t('common.close')}
            type="button"
          >
            <i className="fa-solid fa-xmark" />
          </button>
        </div>

        <div className="p-5">
          <RoleFilters
            values={inputs}
            onChange={onChange}
            onSubmit={handleSubmit}
            onReset={handleReset}
          />
        </div>

        <div className="flex items-center justify-between border-t border-gray-300 px-5 py-3">
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
        </div>
      </div>
    </div>
  )
}
