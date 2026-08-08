'use client'

import BranchAccessChecklist from './BranchAccessChecklist'
import { useBranch } from '@/contexts/BranchContext'

export default function BranchAssignmentChecklist({ label, value, onChange, disabled }: {
  label: string
  value: number[]
  onChange: (ids: number[]) => void
  disabled?: boolean
}) {
  const { accessibleBranches, loading } = useBranch()
  return (
    <div>
      <p className="mb-1 text-sm font-medium text-gray-700">{label} <span className="text-red-500">*</span></p>
      <BranchAccessChecklist
        id={`${label.toLowerCase().replaceAll(' ', '-')}-branches`}
        options={accessibleBranches}
        selectedIds={value.map(String)}
        disabled={disabled || loading}
        onChange={(ids) => onChange(ids.map(Number).filter((id) => id > 0))}
      />
    </div>
  )
}
