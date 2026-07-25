'use client'

import { useEffect, useState, type FormEvent } from 'react'

import { getApiErrorMessage } from '@/lib/api-errors'
import {
  defaultThermalPrinterSettings,
  getThermalPrinterSettings,
  saveThermalPrinterSettings,
  testThermalPrinter,
  type ThermalPrinterSettings,
} from '@/lib/thermalPrinterSettings'

type TestStatus = 'not-tested' | 'testing' | 'sent' | 'failed'

const errorMessage = (error: unknown, fallback: string) =>
  error instanceof Error && error.message ? error.message : getApiErrorMessage(error, fallback)

export default function ThermalPrinterSettingsForm({ canEdit }: { canEdit: boolean }) {
  const [form, setForm] = useState<ThermalPrinterSettings>(defaultThermalPrinterSettings)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [pageError, setPageError] = useState<string | null>(null)
  const [notice, setNotice] = useState<{ tone: 'success' | 'error'; text: string } | null>(null)
  const [testStatus, setTestStatus] = useState<TestStatus>('not-tested')
  const [testMessage, setTestMessage] = useState<string | null>(null)

  useEffect(() => {
    getThermalPrinterSettings()
      .then(setForm)
      .catch((error) => setPageError(errorMessage(error, 'Unable to load thermal printer settings.')))
      .finally(() => setLoading(false))
  }, [])

  const update = <K extends keyof ThermalPrinterSettings>(key: K, value: ThermalPrinterSettings[K]) => {
    setForm((current) => ({ ...current, [key]: value }))
    setTestStatus('not-tested')
    setTestMessage(null)
  }

  const handleSave = async (event: FormEvent) => {
    event.preventDefault()
    setSaving(true)
    setNotice(null)
    try {
      const response = await saveThermalPrinterSettings(form)
      setForm(response.data)
      setNotice({ tone: 'success', text: response.message ?? 'Thermal printer settings saved.' })
    } catch (error) {
      setNotice({ tone: 'error', text: errorMessage(error, 'Unable to save thermal printer settings.') })
    } finally {
      setSaving(false)
    }
  }

  const handleTest = async () => {
    setTestStatus('testing')
    setTestMessage(null)
    setNotice(null)
    try {
      const response = await testThermalPrinter(form)
      setTestStatus('sent')
      setTestMessage(response.message ?? 'Printer connected and test print sent.')
    } catch (error) {
      setTestStatus('failed')
      setTestMessage(errorMessage(error, 'Printer test failed.'))
    }
  }

  if (loading) return <div className="rounded-xl border border-slate-200 bg-white p-8 text-sm text-slate-500">Loading printer settings…</div>
  if (pageError) return <div className="rounded-xl border border-red-200 bg-red-50 p-5 text-sm text-red-700">{pageError}</div>

  const statusStyles = testStatus === 'sent'
    ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
    : testStatus === 'failed'
      ? 'border-red-200 bg-red-50 text-red-700'
      : testStatus === 'testing'
        ? 'border-blue-200 bg-blue-50 text-blue-800'
        : 'border-slate-200 bg-slate-50 text-slate-600'
  const statusLabel = testStatus === 'sent' ? 'Connected / Test Print Sent' : testStatus === 'failed' ? 'Failed' : testStatus === 'testing' ? 'Testing' : 'Not Tested'
  const networkReady = form.connection_type === 'network' && Boolean(form.ip_address?.trim()) && Boolean(form.port)

  return (
    <form onSubmit={handleSave} className="space-y-6">
      {notice ? <div className={`rounded-lg border px-4 py-3 text-sm ${notice.tone === 'success' ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-red-200 bg-red-50 text-red-700'}`}>{notice.text}</div> : null}

      <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <h3 className="text-lg font-semibold text-slate-900">Printer Status</h3>
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <div><p className="text-xs uppercase tracking-wide text-slate-500">Configuration</p><p className="mt-1 font-medium">{form.is_enabled ? 'Enabled' : 'Disabled'}</p></div>
          <div><p className="text-xs uppercase tracking-wide text-slate-500">Printer</p><p className="mt-1 font-medium">{form.printer_name || 'Not named'}</p></div>
          <div className={`rounded-lg border px-3 py-2 ${statusStyles}`}><p className="text-xs uppercase tracking-wide opacity-75">Latest test</p><p className="mt-1 font-semibold">{statusLabel}</p></div>
        </div>
        {testMessage ? <p className={`mt-3 text-sm ${testStatus === 'failed' ? 'text-red-700' : 'text-emerald-700'}`}>{testMessage}</p> : null}
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex items-center justify-between gap-4 border-b border-slate-100 pb-5">
          <div><h3 className="text-lg font-semibold text-slate-900">Printer Configuration</h3><p className="mt-1 text-sm text-slate-500">Network printing sends ESC/POS receipts directly to the configured printer.</p></div>
          <label className="flex items-center gap-2 text-sm font-medium text-slate-700"><input type="checkbox" checked={form.is_enabled} disabled={!canEdit} onChange={(event) => update('is_enabled', event.target.checked)} className="h-5 w-5 rounded" />Enable</label>
        </div>

        <div className="mt-5 grid gap-5 md:grid-cols-2">
          <label className="text-sm font-medium text-slate-700">Connection Type
            <select value={form.connection_type} disabled={!canEdit} onChange={(event) => update('connection_type', event.target.value as ThermalPrinterSettings['connection_type'])} className="mt-2 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5">
              <option value="network">Network (Recommended)</option>
              <option value="usb" disabled>USB (Coming Soon)</option>
              <option value="bluetooth" disabled>Bluetooth (Coming Soon)</option>
            </select>
            <span className="mt-1 block text-xs font-normal text-slate-500">USB and Bluetooth are not available for saved unattended printing.</span>
          </label>
          <label className="text-sm font-medium text-slate-700">Printer Name
            <input value={form.printer_name ?? ''} disabled={!canEdit} maxLength={255} onChange={(event) => update('printer_name', event.target.value || null)} placeholder="Front counter printer" className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2.5" />
          </label>
          {form.connection_type === 'network' ? <>
            <label className="text-sm font-medium text-slate-700">IP Address or Hostname
              <input required value={form.ip_address ?? ''} disabled={!canEdit} onChange={(event) => update('ip_address', event.target.value || null)} placeholder="e.g. 192.168.0.248" className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2.5" />
            </label>
            <label className="text-sm font-medium text-slate-700">Port
              <input required type="number" min={1} max={65535} value={form.port ?? ''} disabled={!canEdit} onChange={(event) => update('port', event.target.value ? Number(event.target.value) : null)} className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2.5" />
            </label>
          </> : null}
          <label className="text-sm font-medium text-slate-700">Paper Width
            <select value={form.paper_width} disabled={!canEdit} onChange={(event) => update('paper_width', Number(event.target.value) as 58 | 80)} className="mt-2 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5"><option value={58}>58mm</option><option value={80}>80mm</option></select>
          </label>
          <label className="text-sm font-medium text-slate-700">Number of Copies
            <input type="number" min={1} max={5} value={form.copies} disabled={!canEdit} onChange={(event) => update('copies', Number(event.target.value))} className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2.5" />
          </label>
          <label className="flex items-center gap-3 text-sm font-medium text-slate-700"><input type="checkbox" checked={form.auto_print_receipt} disabled={!canEdit} onChange={(event) => update('auto_print_receipt', event.target.checked)} className="h-5 w-5 rounded" />Auto Print Receipt</label>
        </div>

        <div className="mt-7 flex flex-wrap justify-end gap-3 border-t border-slate-100 pt-5">
          <button type="button" onClick={() => void handleTest()} disabled={!canEdit || testStatus === 'testing' || !networkReady} className="rounded-lg border border-blue-600 px-5 py-2.5 text-sm font-semibold text-blue-700 disabled:cursor-not-allowed disabled:opacity-50">{testStatus === 'testing' ? 'Testing…' : 'Test Print'}</button>
          <button type="submit" disabled={!canEdit || saving} className="rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50">{saving ? 'Saving…' : 'Save Settings'}</button>
        </div>
      </section>
    </form>
  )
}
