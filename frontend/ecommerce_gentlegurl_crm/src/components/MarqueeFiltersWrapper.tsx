'use client'

import MarqueeFilters, {
  MarqueeFilterValues,
  marqueeFiltersFormId,
  emptyMarqueeFilters,
} from './MarqueeFilters'
import CrmFilterModalShell from './CrmFilterModalShell'
import { useI18n } from '@/lib/i18n'

interface Props {
  inputs: MarqueeFilterValues
  onChange: (values: MarqueeFilterValues) => void
  onSubmit: (values: MarqueeFilterValues) => void
  onReset: () => void
  onClose: () => void
  disabled?: boolean
}

export default function MarqueeFiltersWrapper({
  inputs,
  onChange,
  onSubmit,
  onReset,
  onClose,
  disabled = false,
}: Props) {
  const { t } = useI18n()

  const handleReset = () => {
    onChange({ ...emptyMarqueeFilters })
    onReset()
  }

  const handleSubmit = (values: MarqueeFilterValues) => {
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
            form={marqueeFiltersFormId}
            className="px-4 py-2 text-sm text-gray-700 border border-gray-300 rounded-md hover:bg-gray-200"
          >
            {t('common.reset')}
          </button>
          <button
            type="submit"
            form={marqueeFiltersFormId}
            className="px-4 py-2 text-sm text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50"
            disabled={disabled}
          >
            {t('common.applyFilter')}
          </button>
        </>
      }
    >
      <MarqueeFilters
        values={inputs}
        onChange={onChange}
        onSubmit={handleSubmit}
        onReset={handleReset}
      />
    </CrmFilterModalShell>
  )
}
