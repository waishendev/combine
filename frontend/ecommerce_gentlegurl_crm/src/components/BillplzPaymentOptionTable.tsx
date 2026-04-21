'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

type WorkspaceType = 'ecommerce' | 'booking'
type GatewayGroup = 'online_banking' | 'credit_card'

type BillplzOption = {
  id: number
  type: WorkspaceType
  gateway_group: GatewayGroup
  code: string
  name: string
  logo_url?: string | null
  description?: string | null
  is_active: boolean
  is_default: boolean
  sort_order: number
}

type ApiResponse = {
  data?: BillplzOption[] | { data?: BillplzOption[] }
  message?: string
  success?: boolean
}

const EMPTY_FORM = {
  type: 'ecommerce' as WorkspaceType,
  gateway_group: 'online_banking' as GatewayGroup,
  code: '',
  name: '',
  logo_url: '',
  description: '',
  is_active: true,
  is_default: false,
  sort_order: 0,
}

export default function BillplzPaymentOptionTable({ permissions }: { permissions: string[] }) {
  const canCreate = permissions.includes('ecommerce.billplz-payment-gateways.create')
  const canUpdate = permissions.includes('ecommerce.billplz-payment-gateways.update')
  const canDelete = permissions.includes('ecommerce.billplz-payment-gateways.delete')

  const [typeFilter, setTypeFilter] = useState<WorkspaceType>('ecommerce')
  const [groupFilter, setGroupFilter] = useState<GatewayGroup>('online_banking')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [rows, setRows] = useState<BillplzOption[]>([])
  const [editingId, setEditingId] = useState<number | null>(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [logoFile, setLogoFile] = useState<File | null>(null)
  const [logoRemoved, setLogoRemoved] = useState(false)
  const logoInputRef = useRef<HTMLInputElement | null>(null)

  const isEditing = editingId !== null

  const fileObjectUrl = useMemo(() => (logoFile ? URL.createObjectURL(logoFile) : null), [logoFile])

  useEffect(() => {
    return () => {
      if (fileObjectUrl) URL.revokeObjectURL(fileObjectUrl)
    }
  }, [fileObjectUrl])

  const previewLogoSrc = useMemo(() => {
    if (fileObjectUrl) return fileObjectUrl
    if (logoRemoved) return null
    return form.logo_url?.trim() ? form.logo_url : null
  }, [fileObjectUrl, form.logo_url, logoRemoved])

  const fetchRows = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const qs = new URLSearchParams({
        type: typeFilter,
        gateway_group: groupFilter,
        per_page: '100',
      })
      const res = await fetch(`/api/proxy/ecommerce/billplz-payment-gateway-options?${qs.toString()}`, { cache: 'no-store' })
      const payload: ApiResponse = await res.json().catch(() => ({}))
      if (!res.ok || payload?.success === false) {
        throw new Error(payload?.message || 'Failed to load Billplz payment options.')
      }

      const list = Array.isArray(payload?.data)
        ? payload.data
        : Array.isArray(payload?.data?.data)
          ? payload.data.data
          : []

      setRows(list)
    } catch (err) {
      setRows([])
      setError(err instanceof Error ? err.message : 'Failed to load Billplz payment options.')
    } finally {
      setLoading(false)
    }
  }, [groupFilter, typeFilter])

  useEffect(() => {
    void fetchRows()
  }, [fetchRows])

  const resetForm = useCallback(() => {
    setEditingId(null)
    setForm({ ...EMPTY_FORM, type: typeFilter, gateway_group: groupFilter })
    setLogoFile(null)
    setLogoRemoved(false)
    if (logoInputRef.current) {
      logoInputRef.current.value = ''
    }
  }, [groupFilter, typeFilter])

  useEffect(() => {
    resetForm()
  }, [resetForm])

  const appendCommonFields = (fd: FormData, opts: { includeLogoUrl: boolean }) => {
    fd.append('gateway_group', form.gateway_group)
    fd.append('code', form.code.trim())
    fd.append('name', form.name.trim())
    if (form.description.trim()) {
      fd.append('description', form.description.trim())
    }
    fd.append('sort_order', String(form.sort_order))
    fd.append('is_active', form.is_active ? '1' : '0')
    fd.append('is_default', form.is_default ? '1' : '0')
    if (opts.includeLogoUrl && form.logo_url.trim()) {
      fd.append('logo_url', form.logo_url.trim())
    }
  }

  const submitForm = async () => {
    setError(null)
    try {
      const typeQs = `type=${encodeURIComponent(form.type)}`

      if (logoFile) {
        const fd = new FormData()
        appendCommonFields(fd, { includeLogoUrl: false })
        fd.append('logo', logoFile)
        const url = isEditing
          ? `/api/proxy/ecommerce/billplz-payment-gateway-options/${editingId}?${typeQs}`
          : `/api/proxy/ecommerce/billplz-payment-gateway-options?${typeQs}`
        const res = await fetch(url, {
          method: 'POST',
          headers: { Accept: 'application/json' },
          body: fd,
        })
        const result = await res.json().catch(() => ({}))
        if (!res.ok || result?.success === false) {
          throw new Error(result?.message || 'Failed to save Billplz payment option.')
        }
      } else {
        const payload: Record<string, unknown> = {
          ...form,
          code: form.code.trim(),
          name: form.name.trim(),
          logo_url: logoRemoved ? null : form.logo_url.trim() || null,
          description: form.description.trim() || null,
        }
        const url = isEditing
          ? `/api/proxy/ecommerce/billplz-payment-gateway-options/${editingId}?${typeQs}`
          : `/api/proxy/ecommerce/billplz-payment-gateway-options?${typeQs}`

        const res = await fetch(url, {
          method: isEditing ? 'PUT' : 'POST',
          headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
          body: JSON.stringify(payload),
        })
        const result = await res.json().catch(() => ({}))
        if (!res.ok || result?.success === false) {
          throw new Error(result?.message || 'Failed to save Billplz payment option.')
        }
      }

      resetForm()
      await fetchRows()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save Billplz payment option.')
    }
  }

  const deleteRow = async (row: BillplzOption) => {
    if (!window.confirm(`Delete ${row.name}?`)) return

    setError(null)
    try {
      const res = await fetch(`/api/proxy/ecommerce/billplz-payment-gateway-options/${row.id}?type=${row.type}`, {
        method: 'DELETE',
      })
      const result = await res.json().catch(() => ({}))
      if (!res.ok || result?.success === false) {
        throw new Error(result?.message || 'Failed to delete Billplz payment option.')
      }
      await fetchRows()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete Billplz payment option.')
    }
  }

  const sortedRows = useMemo(() => {
    return [...rows].sort((a, b) => a.sort_order - b.sort_order || a.id - b.id)
  }, [rows])

  const colSpanBase = 8
  const colSpan = canUpdate || canDelete ? colSpanBase + 1 : colSpanBase

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3">
        <select
          className="rounded border border-gray-300 bg-white px-3 py-2 text-sm"
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value as WorkspaceType)}
        >
          <option value="ecommerce">Ecommerce</option>
          <option value="booking">Booking</option>
        </select>

        <select
          className="rounded border border-gray-300 bg-white px-3 py-2 text-sm"
          value={groupFilter}
          onChange={(e) => setGroupFilter(e.target.value as GatewayGroup)}
        >
          <option value="online_banking">Online Banking</option>
          <option value="credit_card">Credit Card</option>
        </select>
      </div>

      {(canCreate || (canUpdate && isEditing)) && (
        <div className="rounded-lg border border-gray-200 bg-white p-4">
          <h3 className="mb-3 text-lg font-semibold">{isEditing ? 'Edit Billplz Option' : 'Create Billplz Option'}</h3>
          <div className="grid gap-3 md:grid-cols-2">
            <input
              className="rounded border border-gray-300 px-3 py-2 text-sm"
              placeholder="Code"
              value={form.code}
              onChange={(e) => setForm((prev) => ({ ...prev, code: e.target.value }))}
            />
            <input
              className="rounded border border-gray-300 px-3 py-2 text-sm"
              placeholder="Name"
              value={form.name}
              onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
            />
            <input
              className="rounded border border-gray-300 px-3 py-2 text-sm"
              placeholder="Sort Order"
              type="number"
              value={form.sort_order}
              onChange={(e) => setForm((prev) => ({ ...prev, sort_order: Number(e.target.value || 0) }))}
            />
            <select
              className="rounded border border-gray-300 bg-white px-3 py-2 text-sm"
              value={form.type}
              onChange={(e) => setForm((prev) => ({ ...prev, type: e.target.value as WorkspaceType }))}
            >
              <option value="ecommerce">Ecommerce</option>
              <option value="booking">Booking</option>
            </select>
            <select
              className="rounded border border-gray-300 bg-white px-3 py-2 text-sm"
              value={form.gateway_group}
              onChange={(e) => setForm((prev) => ({ ...prev, gateway_group: e.target.value as GatewayGroup }))}
            >
              <option value="online_banking">Online Banking</option>
              <option value="credit_card">Credit Card</option>
            </select>
          </div>

          <div className="mt-4 rounded border border-dashed border-gray-300 bg-gray-50/80 p-4">
            <p className="mb-2 text-sm font-medium text-gray-700">Image</p>
            <p className="mb-3 text-xs text-gray-500">
              Upload SVG/PNG/WebP, or leave empty to use default <span className="font-mono">/images/banks/&lt;code&gt;.svg</span> when the file exists on the API server.
            </p>
            <div className="flex flex-wrap items-center gap-4">
              <div className="flex h-16 w-16 items-center justify-center overflow-hidden rounded border border-gray-200 bg-white">
                {previewLogoSrc ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={previewLogoSrc} alt="" className="max-h-14 max-w-14 object-contain" />
                ) : (
                  <span className="px-1 text-center text-[10px] text-gray-400">No image</span>
                )}
              </div>
              <div className="flex flex-wrap gap-2">
                <input
                  ref={logoInputRef}
                  type="file"
                  accept=".svg,.png,.jpg,.jpeg,.webp,image/svg+xml,image/png,image/jpeg,image/webp"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0]
                    setLogoFile(f ?? null)
                    setLogoRemoved(false)
                  }}
                />
                <button
                  type="button"
                  className="rounded border border-gray-300 bg-white px-3 py-1.5 text-sm"
                  onClick={() => logoInputRef.current?.click()}
                >
                  Choose file
                </button>
                {(logoFile || previewLogoSrc) && (
                  <button
                    type="button"
                    className="rounded border border-red-200 px-3 py-1.5 text-sm text-red-600"
                    onClick={() => {
                      setLogoFile(null)
                      setLogoRemoved(true)
                      setForm((prev) => ({ ...prev, logo_url: '' }))
                      if (logoInputRef.current) logoInputRef.current.value = ''
                    }}
                  >
                    Remove
                  </button>
                )}
              </div>
            </div>
            <input
              className="mt-3 w-full rounded border border-gray-300 px-3 py-2 text-sm"
              placeholder="Logo URL (optional, if not uploading a file)"
              value={form.logo_url}
              onChange={(e) => {
                setForm((prev) => ({ ...prev, logo_url: e.target.value }))
                setLogoRemoved(false)
              }}
            />
          </div>

          <textarea
            className="mt-3 w-full rounded border border-gray-300 px-3 py-2 text-sm"
            placeholder="Description (optional)"
            value={form.description}
            onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))}
          />

          <div className="mt-3 flex flex-wrap items-center gap-4 text-sm">
            <label className="inline-flex items-center gap-2">
              <input type="checkbox" checked={form.is_active} onChange={(e) => setForm((prev) => ({ ...prev, is_active: e.target.checked }))} />
              Active
            </label>
            <label className="inline-flex items-center gap-2">
              <input type="checkbox" checked={form.is_default} onChange={(e) => setForm((prev) => ({ ...prev, is_default: e.target.checked }))} />
              Default
            </label>
          </div>

          <div className="mt-4 flex gap-2">
            <button className="rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white" onClick={() => void submitForm()}>
              {isEditing ? 'Update' : 'Create'}
            </button>
            {isEditing && (
              <button className="rounded border border-gray-300 px-4 py-2 text-sm" onClick={resetForm}>
                Cancel
              </button>
            )}
          </div>
        </div>
      )}

      {error && <div className="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}

      <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-500">
            <tr>
              <th className="px-4 py-3">Image</th>
              <th className="px-4 py-3">Type</th>
              <th className="px-4 py-3">Group</th>
              <th className="px-4 py-3">Code</th>
              <th className="px-4 py-3">Name</th>
              <th className="px-4 py-3">Sort</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Default</th>
              {(canUpdate || canDelete) && <th className="px-4 py-3">Actions</th>}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td className="px-4 py-6 text-center text-gray-500" colSpan={colSpan}>
                  Loading...
                </td>
              </tr>
            ) : sortedRows.length === 0 ? (
              <tr>
                <td className="px-4 py-6 text-center text-gray-500" colSpan={colSpan}>
                  No options found.
                </td>
              </tr>
            ) : (
              sortedRows.map((row) => (
                <tr key={row.id} className="border-t border-gray-100">
                  <td className="px-4 py-3">
                    {row.logo_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={row.logo_url} alt="" className="h-9 w-9 object-contain" />
                    ) : (
                      <span className="text-xs text-gray-400">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3">{row.type}</td>
                  <td className="px-4 py-3">{row.gateway_group}</td>
                  <td className="px-4 py-3 font-mono text-xs">{row.code}</td>
                  <td className="px-4 py-3">{row.name}</td>
                  <td className="px-4 py-3">{row.sort_order}</td>
                  <td className="px-4 py-3">{row.is_active ? 'Active' : 'Inactive'}</td>
                  <td className="px-4 py-3">{row.is_default ? 'Yes' : 'No'}</td>
                  {(canUpdate || canDelete) && (
                    <td className="px-4 py-3">
                      <div className="flex gap-2">
                        {canUpdate && (
                          <button
                            className="rounded border border-gray-300 px-2 py-1 text-xs"
                            onClick={() => {
                              setEditingId(row.id)
                              setLogoFile(null)
                              setLogoRemoved(false)
                              if (logoInputRef.current) logoInputRef.current.value = ''
                              setForm({
                                type: row.type,
                                gateway_group: row.gateway_group,
                                code: row.code,
                                name: row.name,
                                logo_url: row.logo_url || '',
                                description: row.description || '',
                                is_active: row.is_active,
                                is_default: row.is_default,
                                sort_order: row.sort_order,
                              })
                            }}
                          >
                            Edit
                          </button>
                        )}
                        {canDelete && (
                          <button className="rounded border border-red-300 px-2 py-1 text-xs text-red-600" onClick={() => void deleteRow(row)}>
                            Delete
                          </button>
                        )}
                      </div>
                    </td>
                  )}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
