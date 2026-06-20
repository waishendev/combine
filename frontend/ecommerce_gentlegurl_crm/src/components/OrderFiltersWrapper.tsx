'use client'

import OrderFilters, {
  OrderFilterValues,
  orderFiltersFormId,
  emptyOrderFilters,
} from './OrderFilters'
import CrmFilterModalShell from './CrmFilterModalShell'
import { useI18n } from '@/lib/i18n'

interface Props {
  inputs: OrderFilterValues
  onChange: (values: OrderFilterValues) => void
  onSubmit: (values: OrderFilterValues) => void
  onReset: () => void
  onClose: () => void
  disabled?: boolean
  allowedStatusOptions?: string[]
}

export default function OrderFiltersWrapper({
  inputs,
  onChange,
  onSubmit,
  onReset,
  onClose,
  disabled = false,
  allowedStatusOptions,
}: Props) {
  const { t } = useI18n()

  const handleReset = () => {
    onChange({ ...emptyOrderFilters })
    onReset()
  }

  const handleSubmit = (values: OrderFilterValues) => {
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
            form={orderFiltersFormId}
            className="px-4 py-2 text-sm text-gray-700 border border-gray-300 rounded-md hover:bg-gray-200"
          >
            {t('common.reset')}
          </button>
          <button
            type="submit"
            form={orderFiltersFormId}
            className="px-4 py-2 text-sm text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50"
            disabled={disabled}
          >
            {t('common.applyFilter')}
          </button>
        </>
      }
    >
      <OrderFilters
        values={inputs}
        onChange={onChange}
        onSubmit={handleSubmit}
        onReset={handleReset}
        allowedStatusOptions={allowedStatusOptions}
      />
    </CrmFilterModalShell>
  )
}

