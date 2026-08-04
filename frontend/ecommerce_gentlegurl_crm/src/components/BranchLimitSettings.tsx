'use client'

import { FormEvent, useEffect, useState } from 'react'

type Usage = { count: number; limit: number; can_create: boolean }
type Response = { data?: Usage; message?: string | null }

export default function BranchLimitSettings() {
  const [usage, setUsage] = useState<Usage | null>(null)
  const [limit, setLimit] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/proxy/ecommerce/branch-limit', { cache: 'no-store' })
      .then(async (response) => {
        const payload = (await response.json()) as Response
        if (!response.ok || !payload.data) throw new Error(payload.message || 'Unable to load the branch limit.')
        setUsage(payload.data)
        setLimit(String(payload.data.limit))
      })
      .catch((reason: unknown) => setError(reason instanceof Error ? reason.message : 'Unable to load the branch limit.'))
  }, [])

  async function submit(event: FormEvent) {
    event.preventDefault()
    setSaving(true)
    setError(null)
    setMessage(null)
    try {
      const response = await fetch('/api/proxy/ecommerce/branch-limit', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ limit: Number(limit) }),
      })
      const payload = (await response.json()) as Response
      if (!response.ok || !payload.data) throw new Error(payload.message || 'Unable to update the branch limit.')
      setUsage(payload.data)
      setLimit(String(payload.data.limit))
      setMessage(payload.message || 'Branch limit updated successfully.')
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Unable to update the branch limit.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="max-w-xl rounded-lg bg-white p-6 shadow">
      <div className="mb-6 rounded-md bg-slate-50 p-4">
        <p className="text-sm text-slate-500">Current usage</p>
        <p className="mt-1 text-2xl font-semibold text-slate-900">
          {usage ? `${usage.count} / ${usage.limit} Branches` : 'Loading...'}
        </p>
        <p className="mt-2 text-sm text-slate-500">Inactive branches count toward this limit.</p>
      </div>
      <form onSubmit={submit}>
        <label htmlFor="branch-limit" className="mb-1 block text-sm font-medium text-slate-700">Branch Limit</label>
        <input id="branch-limit" type="number" min="1" max="10000" required value={limit} onChange={(event) => setLimit(event.target.value)} className="w-full rounded-md border border-slate-300 px-3 py-2" />
        {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
        {message && <p className="mt-3 text-sm text-green-600">{message}</p>}
        <button type="submit" disabled={saving || !usage} className="mt-5 rounded bg-blue-500 px-4 py-2 text-sm text-white hover:bg-blue-600 disabled:opacity-50">
          {saving ? 'Saving...' : 'Save Branch Limit'}
        </button>
      </form>
    </div>
  )
}
