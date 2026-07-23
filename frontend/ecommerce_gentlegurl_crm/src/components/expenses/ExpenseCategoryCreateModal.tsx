'use client'

import { useState } from 'react'

import CrmFormModalShell from '@/components/CrmFormModalShell'

const fieldClass =
  'mt-1 h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100'

type ExpenseCategoryCreateModalProps = {
  onClose: () => void
  onCreated?: () => void
}

export default function ExpenseCategoryCreateModal({ onClose, onCreated }: ExpenseCategoryCreateModalProps) {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const close = () => {
    if (saving) return
    onClose()
  }

  const save = async (event: React.FormEvent) => {
    event.preventDefault()
    setError('')
    setSaving(true)
    try {
      const res = await fetch('/api/proxy/expense-categories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, description }),
      })
      if (!res.ok) {
        const json = await res.json().catch(() => null)
        setError(json?.message || 'Unable to save category.')
        return
      }
      onCreated?.()
      onClose()
    } finally {
      setSaving(false)
    }
  }

  return (
    <CrmFormModalShell
      title="Add Expense Category"
      onClose={close}
      closeDisabled={saving}
      size="sm"
      footer={
        <>
          <button
            type="button"
            className="rounded-md border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 disabled:opacity-50"
            onClick={close}
            disabled={saving}
          >
            Cancel
          </button>
          <button
            type="submit"
            form="expense-category-create-form"
            className="rounded-md bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700 disabled:opacity-50"
            disabled={saving}
          >
            {saving ? 'Saving…' : 'Save Category'}
          </button>
        </>
      }
    >
      <form id="expense-category-create-form" onSubmit={save} className="space-y-4 px-4 py-4 sm:px-5">
        {error ? (
          <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700" role="alert">
            {error}
          </div>
        ) : null}

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Name
            <input
              required
              placeholder="e.g. Utilities"
              className={fieldClass}
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={saving}
            />
          </label>
          <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Description
            <input
              placeholder="Optional"
              className={fieldClass}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              disabled={saving}
            />
          </label>
        </div>
      </form>
    </CrmFormModalShell>
  )
}
