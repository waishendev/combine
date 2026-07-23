'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'

import CrmFormModalShell from '@/components/CrmFormModalShell'
import ExpenseCategoryCreateModal from '@/components/expenses/ExpenseCategoryCreateModal'
import PaginationControls from '@/components/PaginationControls'

type Category = {
  id: number
  name: string
  is_active: boolean
}

type Expense = {
  id: number
  expense_no: string
  expense_date: string
  title: string
  amount: string
  remark?: string
  category?: Category
  creator?: { name: string }
  receipt_url?: string
}

type ExpenseForm = {
  expense_date: string
  title: string
  expense_category_id: string
  amount: string
  remark: string
}

type PaginationMeta = {
  current_page: number
  last_page: number
  per_page: number
  total: number
}

const PAGE_SIZE = 15

const fieldClass =
  'mt-1 h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100'

const textareaClass =
  'mt-1 min-h-[5rem] w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100'

const secondaryBtnClass =
  'inline-flex h-10 items-center justify-center rounded-lg border border-slate-200 bg-white px-3.5 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50'

const primaryBtnClass =
  'inline-flex h-10 items-center justify-center rounded-lg bg-blue-600 px-3.5 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700'

function todayYmd() {
  return new Date().toISOString().slice(0, 10)
}

function currentMonth() {
  return new Date().toISOString().slice(0, 7)
}

function emptyForm(): ExpenseForm {
  return {
    expense_date: todayYmd(),
    title: '',
    expense_category_id: '',
    amount: '',
    remark: '',
  }
}

function formatRm(value: string | number) {
  return `RM ${Number(value || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function formatDateLabel(ymd?: string) {
  if (!ymd) return '—'
  const d = new Date(`${ymd.slice(0, 10)}T12:00:00`)
  if (Number.isNaN(d.getTime())) return ymd.slice(0, 10)
  return new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }).format(d)
}

function monthTitle(ym: string) {
  const [y, m] = ym.split('-').map(Number)
  if (!y || !m) return ym
  return new Intl.DateTimeFormat('en-GB', { month: 'long', year: 'numeric' }).format(new Date(y, m - 1, 1))
}

function formFromExpense(expense: Expense): ExpenseForm {
  return {
    expense_date: expense.expense_date.slice(0, 10),
    title: expense.title,
    expense_category_id: String(expense.category?.id || ''),
    amount: expense.amount,
    remark: expense.remark || '',
  }
}

export default function ExpensesPage({ permissions }: { permissions: string[] }) {
  const [filters, setFilters] = useState({
    month: currentMonth(),
    expense_category_id: '',
  })
  const [page, setPage] = useState(1)
  const [items, setItems] = useState<Expense[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [total, setTotal] = useState('0.00')
  const [meta, setMeta] = useState<PaginationMeta>({
    current_page: 1,
    last_page: 1,
    per_page: PAGE_SIZE,
    total: 0,
  })
  const [loading, setLoading] = useState(true)

  const [formMode, setFormMode] = useState<'create' | 'edit' | null>(null)
  const [editing, setEditing] = useState<Expense | null>(null)
  const [form, setForm] = useState<ExpenseForm>(emptyForm)
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState('')

  const [archiveTarget, setArchiveTarget] = useState<Expense | null>(null)
  const [archiving, setArchiving] = useState(false)
  const [archiveError, setArchiveError] = useState('')
  const [categoryCreateOpen, setCategoryCreateOpen] = useState(false)

  const can = (permission: string) => permissions.includes(permission)
  const showActions = can('expenses.update') || can('expenses.delete')
  const canCreateCategory = can('expense_categories.create')

  const query = useCallback(() => {
    const qs = new URLSearchParams()
    qs.set('page', String(page))
    qs.set('per_page', String(PAGE_SIZE))
    if (filters.month) qs.set('month', filters.month)
    if (filters.expense_category_id) qs.set('expense_category_id', filters.expense_category_id)
    return qs.toString()
  }, [filters.expense_category_id, filters.month, page])

  const exportQuery = useCallback(() => {
    const qs = new URLSearchParams()
    if (filters.month) qs.set('month', filters.month)
    if (filters.expense_category_id) qs.set('expense_category_id', filters.expense_category_id)
    return qs.toString()
  }, [filters.expense_category_id, filters.month])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [expensesRes, categoriesRes] = await Promise.all([
        fetch(`/api/proxy/expenses?${query()}`, { cache: 'no-store' }),
        fetch('/api/proxy/expense-categories?active_only=1', { cache: 'no-store' }),
      ])
      const expensesJson = await expensesRes.json().catch(() => null)
      const categoriesJson = await categoriesRes.json().catch(() => null)
      const payload = expensesJson?.data || {}
      const paginated = payload.items || {}
      setItems(Array.isArray(paginated.data) ? paginated.data : [])
      setTotal(payload.total_expense || '0.00')
      setMeta({
        current_page: Number(paginated.current_page ?? page) || 1,
        last_page: Number(paginated.last_page ?? 1) || 1,
        per_page: Number(paginated.per_page ?? PAGE_SIZE) || PAGE_SIZE,
        total: Number(paginated.total ?? 0) || 0,
      })
      setCategories(categoriesJson?.data?.data || categoriesJson?.data || [])
    } finally {
      setLoading(false)
    }
  }, [page, query])

  useEffect(() => {
    void load()
  }, [load])

  const openCreate = () => {
    setFormMode('create')
    setEditing(null)
    setForm(emptyForm())
    setFormError('')
  }

  const openEdit = (expense: Expense) => {
    setFormMode('edit')
    setEditing(expense)
    setForm(formFromExpense(expense))
    setFormError('')
  }

  const closeForm = () => {
    if (saving) return
    setFormMode(null)
    setEditing(null)
    setFormError('')
    setForm(emptyForm())
  }

  const save = async (event: React.FormEvent) => {
    event.preventDefault()
    setFormError('')
    setSaving(true)
    try {
      const data = new FormData()
      Object.entries(form).forEach(([key, value]) => data.append(key, value))

      const res = await fetch(`/api/proxy/expenses${editing?.id ? `/${editing.id}` : ''}`, {
        method: 'POST',
        body: data,
      })
      if (!res.ok) {
        const json = await res.json().catch(() => null)
        setFormError(json?.message || 'Unable to save expense.')
        return
      }

      setFormMode(null)
      setEditing(null)
      setForm(emptyForm())
      void load()
    } finally {
      setSaving(false)
    }
  }

  const confirmArchive = async () => {
    if (!archiveTarget) return
    setArchiving(true)
    setArchiveError('')
    try {
      const res = await fetch(`/api/proxy/expenses/${archiveTarget.id}`, { method: 'DELETE' })
      const json = await res.json().catch(() => null)
      if (!res.ok) {
        setArchiveError(json?.message || 'Unable to delete expense.')
        return
      }
      setArchiveTarget(null)
      if (items.length === 1 && page > 1) {
        setPage((prev) => prev - 1)
      } else {
        void load()
      }
    } finally {
      setArchiving(false)
    }
  }

  const exportCsv = () => window.open(`/api/proxy/expenses/export?${exportQuery()}`, '_blank')

  const recordCountLabel = useMemo(() => {
    if (loading) return 'Loading…'
    return `${meta.total} record${meta.total === 1 ? '' : 's'}`
  }, [loading, meta.total])

  const colSpan = showActions ? 6 : 5

  return (
    <div className="crm-page-shell space-y-5 overflow-y-auto px-4 py-6 sm:px-6 lg:px-10">
      <div className="space-y-4">
        <div>
          <nav className="mb-2 flex flex-wrap items-center gap-1 text-xs" aria-label="Breadcrumb">
            <span className="text-slate-500">Finance</span>
            <span className="text-slate-400">/</span>
            <span className="font-medium text-slate-700">Expenses</span>
          </nav>
          <h1 className="text-3xl font-semibold text-slate-900">Expenses</h1>
          <p className="mt-1 text-sm text-slate-500">
            Track monthly shop expenses, receipts, and category spend.
          </p>
        </div>

        <div className="print:hidden flex flex-wrap items-center gap-2">
          {can('expenses.create') ? (
            <button type="button" onClick={openCreate} className={primaryBtnClass}>
              Add Expense
            </button>
          ) : null}
          {canCreateCategory ? (
            <button
              type="button"
              onClick={() => setCategoryCreateOpen(true)}
              className="inline-flex h-10 items-center justify-center rounded-lg bg-teal-600 px-3.5 text-sm font-semibold text-white shadow-sm transition hover:bg-teal-700"
            >
              Add Expense Category
            </button>
          ) : null}
          {can('expenses.export') ? (
            <button
              type="button"
              onClick={exportCsv}
              className="inline-flex h-10 items-center justify-center rounded-lg bg-slate-700 px-3.5 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800"
            >
              Export CSV
            </button>
          ) : null}
          {/* <button type="button" onClick={() => window.print()} className={secondaryBtnClass}>
            Print
          </button> */}
        </div>
      </div>

      <div className="print:hidden rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="grid gap-3 md:grid-cols-2">
          <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Month
            <input
              type="month"
              value={filters.month}
              onChange={(e) => {
                setPage(1)
                setFilters((prev) => ({ ...prev, month: e.target.value }))
              }}
              className={fieldClass}
            />
          </label>
          <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Category
            <select
              value={filters.expense_category_id}
              onChange={(e) => {
                setPage(1)
                setFilters((prev) => ({ ...prev, expense_category_id: e.target.value }))
              }}
              className={fieldClass}
            >
              <option value="">All categories</option>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 px-5 py-4">
          <h2 className="text-lg font-semibold text-slate-900">Expense list</h2>
          <p className="mt-0.5 text-xs text-slate-500">
            {monthTitle(filters.month)} · {recordCountLabel}
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-5 py-3">Date</th>
                <th className="px-5 py-3">Expense</th>
                <th className="px-5 py-3">Category</th>
                <th className="px-5 py-3">Remark</th>
                <th className="px-5 py-3 text-right">Amount</th>
                {showActions ? <th className="print:hidden px-5 py-3 text-right">Actions</th> : null}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={colSpan} className="px-5 py-10 text-center text-slate-500">
                    Loading expenses…
                  </td>
                </tr>
              ) : items.length === 0 ? (
                <tr>
                  <td colSpan={colSpan} className="px-5 py-10 text-center text-slate-500">
                    No expenses found for the selected filters.
                  </td>
                </tr>
              ) : (
                items.map((expense) => (
                  <tr key={expense.id} className="hover:bg-slate-50/80">
                    <td className="px-5 py-3 text-slate-700">{formatDateLabel(expense.expense_date)}</td>
                    <td className="px-5 py-3 font-medium text-slate-900">{expense.title}</td>
                    <td className="px-5 py-3">
                      <span className="inline-flex rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700">
                        {expense.category?.name || '—'}
                      </span>
                    </td>
                    <td className="max-w-[16rem] truncate px-5 py-3 text-slate-600" title={expense.remark || undefined}>
                      {expense.remark || '—'}
                    </td>
                    <td className="px-5 py-3 text-right font-semibold text-rose-700">
                      {formatRm(expense.amount)}
                    </td>
                    {showActions ? (
                      <td className="print:hidden px-5 py-3">
                        <div className="flex flex-wrap items-center justify-end gap-2">
                          {expense.receipt_url ? (
                            <a
                              href={expense.receipt_url}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex h-8 w-8 items-center justify-center rounded bg-slate-600 text-white hover:bg-slate-700"
                              aria-label={`View receipt for ${expense.expense_no}`}
                              title="Receipt"
                            >
                              <i className="fa-solid fa-file-lines" />
                            </a>
                          ) : null}
                          {can('expenses.update') ? (
                            <button
                              type="button"
                              onClick={() => openEdit(expense)}
                              className="inline-flex h-8 w-8 items-center justify-center rounded bg-blue-600 text-white hover:bg-blue-700"
                              aria-label={`Edit ${expense.expense_no}`}
                              title="Edit"
                            >
                              <i className="fa-solid fa-pen-to-square" />
                            </button>
                          ) : null}
                          {can('expenses.delete') ? (
                            <button
                              type="button"
                              onClick={() => {
                                setArchiveError('')
                                setArchiveTarget(expense)
                              }}
                              className="inline-flex h-8 w-8 items-center justify-center rounded bg-red-600 text-white hover:bg-red-700"
                              aria-label={`Delete ${expense.expense_no}`}
                              title="Delete"
                            >
                              <i className="fa-solid fa-trash" />
                            </button>
                          ) : null}
                        </div>
                      </td>
                    ) : null}
                  </tr>
                ))
              )}
            </tbody>
            {!loading && items.length > 0 ? (
              <tfoot>
                <tr className="border-t-2 border-rose-200 bg-rose-50 text-sm font-bold text-rose-950">
                  <td className="px-5 py-3 text-xs uppercase tracking-wide" colSpan={4}>
                    Total
                  </td>
                  <td className="px-5 py-3 text-right">{formatRm(total)}</td>
                  {showActions ? <td className="print:hidden px-5 py-3" /> : null}
                </tr>
              </tfoot>
            ) : null}
          </table>
        </div>

        {!loading && meta.last_page > 1 ? (
          <div className="print:hidden border-t border-slate-200 px-5 py-4">
            <PaginationControls
              currentPage={meta.current_page}
              totalPages={meta.last_page}
              pageSize={meta.per_page}
              onPageChange={setPage}
              disabled={loading}
            />
          </div>
        ) : null}
      </section>

      {formMode ? (
        <CrmFormModalShell
          title={formMode === 'edit' ? 'Edit Expense' : 'Add Expense'}
          onClose={closeForm}
          closeDisabled={saving}
          size="lg"
          footer={
            <>
              <button
                type="button"
                className="rounded-md border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 disabled:opacity-50"
                onClick={closeForm}
                disabled={saving}
              >
                Cancel
              </button>
              <button
                type="submit"
                form="expense-form"
                className="rounded-md bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700 disabled:opacity-50"
                disabled={saving}
              >
                {saving ? 'Saving…' : formMode === 'edit' ? 'Save Changes' : 'Save Expense'}
              </button>
            </>
          }
        >
          <form id="expense-form" onSubmit={save} className="space-y-4 px-4 py-4 sm:px-5">
            {formError ? (
              <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700" role="alert">
                {formError}
              </div>
            ) : null}

            <div className="grid gap-4 md:grid-cols-2">
              <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Date
                <input
                  required
                  type="date"
                  value={form.expense_date}
                  onChange={(e) => setForm((prev) => ({ ...prev, expense_date: e.target.value }))}
                  className={fieldClass}
                  disabled={saving}
                />
              </label>
              <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Title
                <input
                  required
                  placeholder="e.g. Office supplies"
                  value={form.title}
                  onChange={(e) => setForm((prev) => ({ ...prev, title: e.target.value }))}
                  className={fieldClass}
                  disabled={saving}
                />
              </label>
              <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Category
                <select
                  required
                  value={form.expense_category_id}
                  onChange={(e) => setForm((prev) => ({ ...prev, expense_category_id: e.target.value }))}
                  className={fieldClass}
                  disabled={saving}
                >
                  <option value="">Select category</option>
                  {categories.map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Amount (RM)
                <input
                  required
                  min="0.01"
                  step="0.01"
                  type="number"
                  placeholder="0.00"
                  value={form.amount}
                  onChange={(e) => setForm((prev) => ({ ...prev, amount: e.target.value }))}
                  className={fieldClass}
                  disabled={saving}
                />
              </label>
              <label className="md:col-span-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                Remark
                <textarea
                  placeholder="Optional note"
                  value={form.remark}
                  onChange={(e) => setForm((prev) => ({ ...prev, remark: e.target.value }))}
                  className={textareaClass}
                  disabled={saving}
                />
              </label>
            </div>
          </form>
        </CrmFormModalShell>
      ) : null}

      {archiveTarget ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div
            className="absolute inset-0 bg-black/50"
            onClick={() => {
              if (!archiving) setArchiveTarget(null)
            }}
          />
          <div className="relative mx-auto w-full max-w-md rounded-lg bg-white shadow-lg">
            <div className="flex items-center justify-between border-b border-gray-300 px-5 py-4">
              <h2 className="text-lg font-semibold">Delete Expense</h2>
              <button
                type="button"
                onClick={() => {
                  if (!archiving) setArchiveTarget(null)
                }}
                className="text-2xl leading-none text-gray-500 hover:text-gray-700"
                aria-label="Close"
                disabled={archiving}
              >
                <i className="fa-solid fa-xmark" />
              </button>
            </div>

            <div className="space-y-4 px-5 py-4">
              <p className="text-sm text-gray-700">Are you sure you want to delete this expense?</p>
              <div className="rounded-md bg-yellow-100 px-4 py-3">
                <p className="text-sm font-semibold text-yellow-800">{archiveTarget.title}</p>
                <p className="text-xs text-yellow-800">
                  {formatDateLabel(archiveTarget.expense_date)} · {formatRm(archiveTarget.amount)}
                </p>
              </div>

              {archiveError ? (
                <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700" role="alert">
                  {archiveError}
                </div>
              ) : null}

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  className="rounded-md border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 disabled:opacity-50"
                  onClick={() => setArchiveTarget(null)}
                  disabled={archiving}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="rounded-md bg-red-600 px-4 py-2 text-sm text-white hover:bg-red-700 disabled:opacity-50"
                  onClick={() => void confirmArchive()}
                  disabled={archiving}
                >
                  {archiving ? 'Deleting…' : 'Delete'}
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {categoryCreateOpen ? (
        <ExpenseCategoryCreateModal
          onClose={() => setCategoryCreateOpen(false)}
          onCreated={() => void load()}
        />
      ) : null}
    </div>
  )
}
