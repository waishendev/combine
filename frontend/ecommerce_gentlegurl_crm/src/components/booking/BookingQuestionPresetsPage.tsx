'use client'

import { FormEvent, useCallback, useEffect, useState } from 'react'
import BookingServiceQuestionsBuilder, { emptyQuestion, type QuestionForm } from './BookingServiceQuestionsBuilder'
import { Switch } from '@/components/ui/switch'

type PresetSummary = { id: number; name: string; is_active: boolean; questions_count: number; updated_at: string }
type ServiceOption = { id: number; name: string; cn_name?: string | null; duration_min: number; service_price: number }
type PresetDetail = PresetSummary & { questions: QuestionForm[] }

export default function BookingQuestionPresetsPage({ permissions }: { permissions: string[] }) {
  const [rows, setRows] = useState<PresetSummary[]>([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [editorOpen, setEditorOpen] = useState(false)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [name, setName] = useState('')
  const [active, setActive] = useState(true)
  const [questions, setQuestions] = useState<QuestionForm[]>([emptyQuestion()])
  const [serviceOptions, setServiceOptions] = useState<ServiceOption[]>([])
  const [saving, setSaving] = useState(false)
  const [editorLoading, setEditorLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const response = await fetch(`/api/proxy/admin/booking/question-presets?per_page=100&search=${encodeURIComponent(search)}`, { cache: 'no-store' })
      const json = await response.json().catch(() => null)
      setRows(response.ok && Array.isArray(json?.data?.data) ? json.data.data : [])
    } finally { setLoading(false) }
  }, [search])

  useEffect(() => { const timer = window.setTimeout(() => void load(), 250); return () => window.clearTimeout(timer) }, [load])

  const loadServiceOptions = async () => {
    const response = await fetch('/api/proxy/admin/booking/services/options?limit=2000&is_active=true', { cache: 'no-store' })
    const json = await response.json().catch(() => null)
    setServiceOptions(response.ok && Array.isArray(json?.data) ? json.data.map((row: ServiceOption) => ({ ...row, service_price: Number(row.service_price) })) : [])
  }

  const openCreate = async () => {
    setEditingId(null); setName(''); setActive(true); setQuestions([emptyQuestion()]); setError(null); setEditorOpen(true)
    await loadServiceOptions()
  }

  const openEdit = async (id: number) => {
    setEditorOpen(true); setEditorLoading(true); setError(null)
    try {
      const [response] = await Promise.all([
        fetch(`/api/proxy/admin/booking/question-presets/${id}`, { cache: 'no-store' }),
        loadServiceOptions(),
      ])
      const json = await response.json().catch(() => null)
      if (!response.ok) throw new Error(json?.message ?? 'Unable to load preset')
      const preset = json.data as PresetDetail
      setEditingId(preset.id); setName(preset.name); setActive(preset.is_active)
      setQuestions((preset.questions ?? []).map((question, questionIndex) => ({
        title: question.title ?? '', cn_title: question.cn_title ?? '', description: question.description ?? '',
        cn_description: question.cn_description ?? '', question_type: question.question_type === 'multi_choice' ? 'multi_choice' : 'single_choice',
        sort_order: String(questionIndex), is_required: Boolean(question.is_required), is_active: question.is_active !== false,
        options: (question.options ?? []).map((option, optionIndex) => ({
          label: option.label ?? '', cn_label: option.cn_label ?? '',
          linked_booking_service_id: option.linked_booking_service_id ? String(option.linked_booking_service_id) : '',
          sort_order: String(optionIndex), is_active: option.is_active !== false, allow_quantity: option.allow_quantity !== false,
        })),
      })))
    } catch (caught) { setError(caught instanceof Error ? caught.message : 'Unable to load preset') }
    finally { setEditorLoading(false) }
  }

  const closeEditor = () => { if (!saving) setEditorOpen(false) }
  const save = async (event: FormEvent) => {
    event.preventDefault(); setSaving(true); setError(null)
    try {
      const response = await fetch(`/api/proxy/admin/booking/question-presets${editingId ? `/${editingId}` : ''}`, {
        method: editingId ? 'PUT' : 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({
          name: name.trim(), is_active: active,
          questions: questions.map((question) => ({ ...question, options: question.options.map((option) => ({
            ...option, linked_booking_service_id: option.linked_booking_service_id ? Number(option.linked_booking_service_id) : null,
          })) })),
        }),
      })
      const json = await response.json().catch(() => null)
      if (!response.ok) throw new Error(json?.message ?? Object.values(json?.errors ?? {}).flat().join(' ') ?? 'Unable to save preset')
      setEditorOpen(false); await load()
    } catch (caught) { setError(caught instanceof Error ? caught.message : 'Unable to save preset') }
    finally { setSaving(false) }
  }

  const remove = async (row: PresetSummary) => {
    if (!window.confirm(`Delete “${row.name}”? Questions already copied to Booking Services will not be changed.`)) return
    const response = await fetch(`/api/proxy/admin/booking/question-presets/${row.id}`, { method: 'DELETE' })
    if (response.ok) await load()
  }

  return <>
    <section className="rounded-xl border border-gray-200 bg-white shadow-sm">
      <div className="flex flex-col gap-4 border-b border-gray-100 p-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative w-full max-w-md">
          <i className="fa-solid fa-magnifying-glass absolute left-3 top-1/2 -translate-y-1/2 text-sm text-gray-400" />
          <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search presets…" className="w-full rounded-lg border border-gray-300 py-2.5 pl-9 pr-3 text-sm" />
        </div>
        {permissions.includes('booking.question-presets.create') && <button type="button" onClick={() => void openCreate()} className="inline-flex shrink-0 items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-blue-700"><i className="fa-solid fa-plus" /> Create Preset</button>}
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[720px] text-sm">
          <thead className="bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-500"><tr><th className="px-5 py-3">Preset Name</th><th className="px-5 py-3">Questions</th><th className="px-5 py-3">Status</th><th className="px-5 py-3">Last updated</th><th className="px-5 py-3 text-right">Actions</th></tr></thead>
          <tbody className="divide-y divide-gray-100">
            {loading ? <tr><td colSpan={5} className="px-5 py-12 text-center text-gray-500"><i className="fa-solid fa-spinner fa-spin mr-2" />Loading presets…</td></tr>
              : rows.length === 0 ? <tr><td colSpan={5} className="px-5 py-14 text-center"><i className="fa-regular fa-clipboard block text-3xl text-gray-300" /><p className="mt-3 font-medium text-gray-700">No question presets found</p><p className="mt-1 text-gray-500">Create a reusable set of Booking Service questions.</p></td></tr>
              : rows.map((row) => <tr key={row.id} className="hover:bg-gray-50/70"><td className="px-5 py-4 font-medium text-gray-900">{row.name}</td><td className="px-5 py-4 text-gray-600">{row.questions_count}</td><td className="px-5 py-4"><span className={`rounded-full px-2.5 py-1 text-xs font-medium ${row.is_active ? 'bg-emerald-50 text-emerald-700' : 'bg-gray-100 text-gray-600'}`}>{row.is_active ? 'Active' : 'Inactive'}</span></td><td className="px-5 py-4 text-gray-500">{new Date(row.updated_at).toLocaleString()}</td><td className="px-5 py-4 text-right space-x-3">{permissions.includes('booking.question-presets.update') && <button onClick={() => void openEdit(row.id)} className="font-medium text-blue-600 hover:text-blue-800">Edit</button>}{permissions.includes('booking.question-presets.delete') && <button onClick={() => void remove(row)} className="font-medium text-red-600 hover:text-red-800">Delete</button>}</td></tr>)}
          </tbody>
        </table>
      </div>
    </section>

    {editorOpen && <div className="fixed inset-0 z-[90] flex items-center justify-center bg-slate-950/50 p-3 sm:p-6" role="dialog" aria-modal="true" aria-labelledby="preset-editor-title">
      <form onSubmit={save} className="flex max-h-[94vh] w-full max-w-6xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
        <header className="flex shrink-0 items-start justify-between border-b border-gray-200 px-5 py-4 sm:px-7">
          <div><h2 id="preset-editor-title" className="text-xl font-semibold text-gray-900">{editingId ? 'Edit Question Preset' : 'Create Question Preset'}</h2><p className="mt-1 text-sm text-gray-500">Build a reusable set of questions. Applying it creates an independent copy.</p></div>
          <button type="button" onClick={closeEditor} className="rounded-lg p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-700" aria-label="Close"><i className="fa-solid fa-xmark" /></button>
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5 sm:px-7">
          {editorLoading ? <div className="py-20 text-center text-gray-500"><i className="fa-solid fa-spinner fa-spin mr-2" />Loading preset…</div> : <div className="space-y-6">
            {error && <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
            <section className="rounded-xl border border-gray-200 bg-gray-50/60 p-4"><h3 className="mb-4 font-semibold text-gray-900">Preset details</h3><div className="grid gap-4 sm:grid-cols-[1fr_220px]"><label><span className="mb-1.5 block text-sm font-medium text-gray-700">Preset Name <span className="text-red-500">*</span></span><input required value={name} onChange={(event) => setName(event.target.value)} placeholder="e.g. Nail appointment questions" className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm" /></label><div><span className="mb-1.5 block text-sm font-medium text-gray-700">Status</span><div className="flex h-[42px] items-center justify-between rounded-lg border border-gray-300 bg-white px-3"><span className="text-sm">{active ? 'Active' : 'Inactive'}</span><Switch checked={active} onCheckedChange={setActive} /></div></div></div></section>
            <BookingServiceQuestionsBuilder value={questions} onChange={setQuestions} bookingServiceOptions={serviceOptions} allowPresetSelection={false} />
          </div>}
        </div>
        <footer className="flex shrink-0 items-center justify-end gap-3 border-t border-gray-200 bg-white px-5 py-4 sm:px-7"><button type="button" onClick={closeEditor} className="rounded-lg border border-gray-300 px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50">Cancel</button><button type="submit" disabled={saving || editorLoading} className="rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50">{saving ? <><i className="fa-solid fa-spinner fa-spin mr-2" />Saving…</> : 'Save Preset'}</button></footer>
      </form>
    </div>}
  </>
}
