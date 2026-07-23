'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'

import CrmFormModalShell from '@/components/CrmFormModalShell'
import ExpenseCategoryCreateModal from '@/components/expenses/ExpenseCategoryCreateModal'
import PaginationControls from '@/components/PaginationControls'

type Category = {
  id: number
  name: string
  description?: string
  sort_order: number
  is_active: boolean
}

type CategoryForm = {
  name: string
  description: string
  is_active: boolean
}

type PaginationMeta = {
  current_page: number
  last_page: number
  per_page: number
  total: number
}

const PAGE_SIZE_OPTIONS = [20, 50, 100] as const

const fieldClass =
  'mt-1 h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100'

const primaryBtnClass =
  'inline-flex h-10 items-center justify-center rounded-lg bg-blue-600 px-3.5 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700'

function emptyForm(): CategoryForm {
  return {
    name: '',
    description: '',
    is_active: true,
  }
}

export default function ExpenseCategoriesPage({ permissions }: { permissions: string[] }) {
  const [rows, setRows] = useState<Category[]>([])
  const [form, setForm] = useState<CategoryForm>(emptyForm())
  const [edit, setEdit] = useState<Category | null>(null)
  const [editOpen, setEditOpen] = useState(false)
  const [createOpen, setCreateOpen] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState('')
  const [movingId, setMovingId] = useState<number | null>(null)

  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(20)
  const [meta, setMeta] = useState<PaginationMeta>({
    current_page: 1,
    last_page: 1,
    per_page: 20,
    total: 0,
  })

  const [deleteTarget, setDeleteTarget] = useState<Category | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState('')

  const can = (permission: string) => permissions.includes(permission)
  const canUpdate = can('expense_categories.update')
  const canDelete = can('expense_categories.delete')
  const showActions = canUpdate || canDelete

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const qs = new URLSearchParams({
        page: String(page),
        per_page: String(pageSize),
      })
      const res = await fetch(`/api/proxy/expense-categories?${qs.toString()}`, { cache: 'no-store' })
      const json = await res.json().catch(() => null)
      const payload = json?.data || {}
      setRows(Array.isArray(payload.data) ? payload.data : Array.isArray(payload) ? payload : [])
      setMeta({
        current_page: Number(payload.current_page ?? page) || 1,
        last_page: Number(payload.last_page ?? 1) || 1,
        per_page: Number(payload.per_page ?? pageSize) || pageSize,
        total: Number(payload.total ?? 0) || 0,
      })
    } finally {
      setLoading(false)
    }
  }, [page, pageSize])

  useEffect(() => {
    void load()
  }, [load])

  const handlePageChange = (nextPage: number) => {
    if (nextPage < 1 || nextPage > (meta.last_page || 1)) return
    setPage(nextPage)
  }

  const handlePageSizeChange = (nextSize: number) => {
    setPageSize(nextSize)
    setPage(1)
  }

  const openEdit = (category: Category) => {
    setEdit(category)
    setForm({
      name: category.name,
      description: category.description || '',
      is_active: category.is_active,
    })
    setFormError('')
    setEditOpen(true)
  }

  const closeEdit = () => {
    if (saving) return
    setEditOpen(false)
    setEdit(null)
    setFormError('')
    setForm(emptyForm())
  }

  const saveEdit = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!edit) return
    setFormError('')
    setSaving(true)
    try {
      const res = await fetch(`/api/proxy/expense-categories/${edit.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.name,
          description: form.description,
          is_active: form.is_active,
        }),
      })
      if (!res.ok) {
        const json = await res.json().catch(() => null)
        setFormError(json?.message || 'Unable to save category.')
        return
      }
      closeEdit()
      void load()
    } finally {
      setSaving(false)
    }
  }

  const swapAdjacent = (prev: Category[], rowId: number, direction: 'up' | 'down'): Category[] | null => {
    const idx = prev.findIndex((r) => r.id === rowId)
    if (idx === -1) return null
    const next = [...prev]
    if (direction === 'up') {
      if (idx === 0) return null
      const j = idx - 1
      const a = next[idx]
      const b = next[j]
      next[j] = { ...a, sort_order: b.sort_order }
      next[idx] = { ...b, sort_order: a.sort_order }
      return next
    }
    if (idx >= next.length - 1) return null
    const j = idx + 1
    const a = next[idx]
    const b = next[j]
    next[idx] = { ...b, sort_order: a.sort_order }
    next[j] = { ...a, sort_order: b.sort_order }
    return next
  }

  const move = async (category: Category, direction: 'up' | 'down') => {
    if (movingId === category.id) return
    setMovingId(category.id)
    try {
      const res = await fetch(`/api/proxy/expense-categories/${category.id}/move-${direction}`, {
        method: 'POST',
        headers: { Accept: 'application/json' },
      })
      if (!res.ok) return
      const swapped = swapAdjacent(rows, category.id, direction)
      if (swapped) {
        setRows(swapped)
      } else {
        void load()
      }
    } finally {
      setMovingId(null)
    }
  }

  const confirmDelete = async () => {
    if (!deleteTarget) return
    setDeleting(true)
    setDeleteError('')
    try {
      const res = await fetch(`/api/proxy/expense-categories/${deleteTarget.id}`, { method: 'DELETE' })
      const json = await res.json().catch(() => null)
      if (!res.ok) {
        setDeleteError(json?.message || 'Unable to delete category.')
        return
      }
      setDeleteTarget(null)
      if (rows.length === 1 && page > 1) {
        setPage((prev) => prev - 1)
      } else {
        void load()
      }
    } finally {
      setDeleting(false)
    }
  }

  const isFirstOnPage = page === 1
  const isLastOnPage = page >= meta.last_page

  return (
    <div className="crm-page-shell space-y-5 overflow-y-auto px-4 py-6 sm:px-6 lg:px-10">
      <div className="space-y-4">
        <div>
          <nav className="mb-2 flex flex-wrap items-center gap-1 text-xs" aria-label="Breadcrumb">
            <Link href="/expenses" className="font-medium text-blue-700 hover:underline">
              Expenses
            </Link>
            <span className="text-slate-400">/</span>
            <span className="font-medium text-slate-700">Expense Category</span>
          </nav>
          <h1 className="text-3xl font-semibold text-slate-900">Expense Categories</h1>
          <p className="mt-1 text-sm text-slate-500">
            Organize expenses by category for clearer monthly reporting.
          </p>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap gap-2">
            {can('expense_categories.create') ? (
              <button type="button" onClick={() => setCreateOpen(true)} className={primaryBtnClass}>
                Add Expense Category
              </button>
            ) : null}
          </div>

          <div className="flex items-center gap-3">
            <label htmlFor="expense-category-page-size" className="text-sm text-gray-700">
              Show
            </label>
            <select
              id="expense-category-page-size"
              value={pageSize}
              onChange={(e) => handlePageSizeChange(Number(e.target.value))}
              className="rounded border border-gray-300 px-2 py-1 text-sm disabled:opacity-50"
              disabled={loading}
            >
              {PAGE_SIZE_OPTIONS.map((size) => (
                <option key={size} value={size}>
                  {size}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-5 py-3">Name</th>
                <th className="px-5 py-3">Description</th>
                <th className="px-5 py-3">Sort Order</th>
                <th className="px-5 py-3">Status</th>
                {showActions ? <th className="px-5 py-3 text-right">Actions</th> : null}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={showActions ? 5 : 4} className="px-5 py-10 text-center text-slate-500">
                    Loading categories…
                  </td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={showActions ? 5 : 4} className="px-5 py-10 text-center text-slate-500">
                    No categories yet. Add one to start classifying expenses.
                  </td>
                </tr>
              ) : (
                rows.map((category, index) => {
                  const disableUp = (isFirstOnPage && index === 0) || movingId === category.id
                  const disableDown =
                    (isLastOnPage && index === rows.length - 1) || movingId === category.id

                  return (
                    <tr key={category.id} className="hover:bg-slate-50/80">
                      <td className="px-5 py-3 font-semibold text-slate-900">{category.name}</td>
                      <td className="px-5 py-3 text-slate-600">{category.description || '—'}</td>
                      <td className="px-5 py-3">
                        {canUpdate ? (
                          <div className="flex items-center gap-3">
                            <button
                              type="button"
                              className="inline-flex h-7 w-7 items-center justify-center rounded bg-blue-500 text-white hover:bg-blue-600 disabled:cursor-not-allowed disabled:opacity-30"
                              onClick={() => void move(category, 'up')}
                              disabled={disableUp}
                              aria-label="Move up"
                              title="Move up"
                            >
                              <i className="fa-solid fa-chevron-up text-xs" />
                            </button>
                            <span className="min-w-[1.5rem] text-center text-sm font-medium text-slate-700">
                              {category.sort_order}
                            </span>
                            <button
                              type="button"
                              className="inline-flex h-7 w-7 items-center justify-center rounded bg-blue-500 text-white hover:bg-blue-600 disabled:cursor-not-allowed disabled:opacity-30"
                              onClick={() => void move(category, 'down')}
                              disabled={disableDown}
                              aria-label="Move down"
                              title="Move down"
                            >
                              <i className="fa-solid fa-chevron-down text-xs" />
                            </button>
                          </div>
                        ) : (
                          <span className="text-slate-700">{category.sort_order}</span>
                        )}
                      </td>
                      <td className="px-5 py-3">
                        <span
                          className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${
                            category.is_active
                              ? 'bg-emerald-100 text-emerald-700'
                              : 'bg-slate-100 text-slate-600'
                          }`}
                        >
                          {category.is_active ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      {showActions ? (
                        <td className="px-5 py-3">
                          <div className="flex flex-wrap items-center justify-end gap-2">
                            {canUpdate ? (
                              <button
                                type="button"
                                onClick={() => openEdit(category)}
                                className="inline-flex h-8 w-8 items-center justify-center rounded bg-blue-600 text-white hover:bg-blue-700"
                                aria-label={`Edit ${category.name}`}
                                title="Edit"
                              >
                                <i className="fa-solid fa-pen-to-square" />
                              </button>
                            ) : null}
                            {canDelete ? (
                              <button
                                type="button"
                                onClick={() => {
                                  setDeleteError('')
                                  setDeleteTarget(category)
                                }}
                                className="inline-flex h-8 w-8 items-center justify-center rounded bg-red-600 text-white hover:bg-red-700"
                                aria-label={`Delete ${category.name}`}
                                title="Delete"
                              >
                                <i className="fa-solid fa-trash" />
                              </button>
                            ) : null}
                          </div>
                        </td>
                      ) : null}
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </section>

      <PaginationControls
        currentPage={meta.current_page}
        totalPages={meta.last_page}
        pageSize={meta.per_page}
        onPageChange={handlePageChange}
        disabled={loading}
      />

      {createOpen ? (
        <ExpenseCategoryCreateModal
          onClose={() => setCreateOpen(false)}
          onCreated={() => {
            if (page === 1) {
              void load()
            } else {
              setPage(1)
            }
          }}
        />
      ) : null}

      {editOpen ? (
        <CrmFormModalShell
          title="Edit Expense Category"
          onClose={closeEdit}
          closeDisabled={saving}
          size="sm"
          footer={
            <>
              <button
                type="button"
                className="rounded-md border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 disabled:opacity-50"
                onClick={closeEdit}
                disabled={saving}
              >
                Cancel
              </button>
              <button
                type="submit"
                form="expense-category-edit-form"
                className="rounded-md bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700 disabled:opacity-50"
                disabled={saving}
              >
                {saving ? 'Saving…' : 'Save Changes'}
              </button>
            </>
          }
        >
          <form id="expense-category-edit-form" onSubmit={saveEdit} className="space-y-4 px-4 py-4 sm:px-5">
            {formError ? (
              <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700" role="alert">
                {formError}
              </div>
            ) : null}

            <div className="grid gap-4 sm:grid-cols-2">
              <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Name
                <input
                  required
                  placeholder="e.g. Utilities"
                  className={fieldClass}
                  value={form.name}
                  onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
                  disabled={saving}
                />
              </label>
              <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Status
                <select
                  value={form.is_active ? 'active' : 'inactive'}
                  onChange={(e) =>
                    setForm((prev) => ({ ...prev, is_active: e.target.value === 'active' }))
                  }
                  className={fieldClass}
                  disabled={saving}
                >
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                </select>
              </label>
              <label className="sm:col-span-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                Description
                <input
                  placeholder="Optional"
                  className={fieldClass}
                  value={form.description}
                  onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))}
                  disabled={saving}
                />
              </label>
            </div>
          </form>
        </CrmFormModalShell>
      ) : null}

      {deleteTarget ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div
            className="absolute inset-0 bg-black/50"
            onClick={() => {
              if (!deleting) setDeleteTarget(null)
            }}
          />
          <div className="relative mx-auto w-full max-w-md rounded-lg bg-white shadow-lg">
            <div className="flex items-center justify-between border-b border-gray-300 px-5 py-4">
              <h2 className="text-lg font-semibold">Delete Expense Category</h2>
              <button
                type="button"
                onClick={() => {
                  if (!deleting) setDeleteTarget(null)
                }}
                className="text-2xl leading-none text-gray-500 hover:text-gray-700"
                aria-label="Close"
                disabled={deleting}
              >
                <i className="fa-solid fa-xmark" />
              </button>
            </div>

            <div className="space-y-4 px-5 py-4">
              <p className="text-sm text-gray-700">Are you sure you want to delete this expense category?</p>
              <div className="rounded-md bg-yellow-100 px-4 py-3">
                <p className="text-sm font-semibold text-yellow-800">{deleteTarget.name}</p>
                <p className="text-xs text-yellow-800">{deleteTarget.description || 'No description'}</p>
              </div>

              {deleteError ? (
                <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700" role="alert">
                  {deleteError}
                </div>
              ) : null}

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  className="rounded-md border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 disabled:opacity-50"
                  onClick={() => setDeleteTarget(null)}
                  disabled={deleting}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="rounded-md bg-red-600 px-4 py-2 text-sm text-white hover:bg-red-700 disabled:opacity-50"
                  onClick={() => void confirmDelete()}
                  disabled={deleting}
                >
                  {deleting ? 'Deleting…' : 'Delete'}
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
