'use client'

import CrmFormModalShell from '@/components/CrmFormModalShell'

export type PrimaryStaffChangePrompt = {
  originalName: string
  nextName: string
}

type Props = {
  prompt: PrimaryStaffChangePrompt
  loading?: boolean
  onCancel: () => void
  onConfirm: () => void
}

export default function PosPrimaryStaffChangeConfirmModal({
  prompt,
  loading = false,
  onCancel,
  onConfirm,
}: Props) {
  return (
    <CrmFormModalShell
      title="Update primary assigned staff?"
      onClose={onCancel}
      closeDisabled={loading}
      size="sm"
      rootClassName="pos-body-stack-modal-top flex items-end justify-center sm:items-center sm:overflow-y-auto sm:p-4"
      footer={(
        <>
          <button
            type="button"
            disabled={loading}
            onClick={onCancel}
            className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50 sm:w-auto"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={loading}
            onClick={onConfirm}
            className="w-full rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50 sm:w-auto"
          >
            {loading ? 'Saving…' : 'Update staff'}
          </button>
        </>
      )}
    >
      <div className="space-y-3 px-4 py-4 text-sm text-gray-700 sm:px-5">
        <p>
          The appointment&apos;s primary assigned staff will change from{' '}
          <span className="font-semibold text-gray-900">{prompt.originalName}</span> to{' '}
          <span className="font-semibold text-gray-900">{prompt.nextName}</span>.
        </p>
        <ul className="list-disc space-y-1 pl-5 text-[13px] text-gray-600">
          <li>Calendar assignment and scheduling will follow the new primary staff.</li>
          <li>Settlement commission will be attributed using the staff splits you configured.</li>
        </ul>
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[13px] text-amber-900">
          Deposit orders keep their original sales-person split unless you update them separately under{' '}
          <span className="font-semibold">Deposit Credit</span>.
        </p>
      </div>
    </CrmFormModalShell>
  )
}
