'use client'

import BlockFilters, {
  BlockFilterValues,
  blockFiltersFormId,
  emptyBlockFilters,
} from './BlockFilters'
import { useI18n } from '@/lib/i18n'

interface Props {
  inputs: BlockFilterValues
  onChange: (values: BlockFilterValues) => void
  onSubmit: (values: BlockFilterValues) => void
  onReset: () => void
  onClose: () => void
  disabled?: boolean
  staffs: Array<{ id: number; name: string }>
}

export default function BlockFiltersWrapper({
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
    onChange({ ...emptyBlockFilters })
    onReset()
  }

  const handleSubmit = (values: BlockFilterValues) => {
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
          <BlockFilters
            values={inputs}
            onChange={onChange}
            onSubmit={handleSubmit}
            onReset={handleReset}
            staffs={staffs}
          />
        </div>

        <div className="flex items-center justify-between border-t border-gray-300 px-5 py-3">
          <button
            type="reset"
            form={blockFiltersFormId}
            className="px-4 py-2 text-sm text-gray-700 border border-gray-300 rounded-md hover:bg-gray-200"
          >
            {t('common.reset')}
          </button>
          <button
            type="submit"
            form={blockFiltersFormId}
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
