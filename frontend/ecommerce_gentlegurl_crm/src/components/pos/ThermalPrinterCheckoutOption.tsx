'use client'

import { useState } from 'react'
import type { ThermalPrinterSettings } from '@/lib/thermalPrinterSettings'
import { getThermalPrinterAvailability, saveThermalPrinterAutoPrint } from '@/lib/thermalPrinterSettings'

type Props = {
  checked: boolean
  onCheckedChange: (checked: boolean) => void
  settings: ThermalPrinterSettings
  loading?: boolean
  onSettingsChange?: (settings: ThermalPrinterSettings) => void
  onPreferenceSaved?: (message: string) => void
  onPreferenceError?: (message: string) => void
}

export default function ThermalPrinterCheckoutOption({ checked, onCheckedChange, settings, loading = false, onSettingsChange, onPreferenceSaved, onPreferenceError }: Props) {
  const [savingPreference, setSavingPreference] = useState(false)
  const availability = getThermalPrinterAvailability(settings)
  const disabled = loading || savingPreference || !availability.available

  const updatePreference = async (nextChecked: boolean) => {
    if (savingPreference) return
    const previousChecked = checked
    onCheckedChange(nextChecked)
    setSavingPreference(true)
    try {
      const response = await saveThermalPrinterAutoPrint(nextChecked)
      onSettingsChange?.(response.data)
      onPreferenceSaved?.(response.message ?? 'Auto Print Receipt preference updated.')
    } catch (error) {
      onCheckedChange(previousChecked)
      onPreferenceError?.(error instanceof Error ? error.message : 'Unable to update Auto Print Receipt preference.')
    } finally {
      setSavingPreference(false)
    }
  }

  return (
    <div className="rounded-xl border-2 border-gray-200 bg-gradient-to-br from-white to-gray-50 px-5 py-4 shadow-sm">
      <label className={`flex items-center gap-3 select-none ${disabled ? 'cursor-not-allowed' : 'cursor-pointer'}`}>
        <input
          type="checkbox"
          checked={checked}
          disabled={disabled}
          onChange={(event) => void updatePreference(event.target.checked)}
          className="h-5 w-5 rounded border-gray-300 text-blue-600 focus:ring-blue-500 disabled:opacity-50"
        />
        <span className="text-sm font-semibold text-gray-700">Auto Print Receipt</span>
        <span className="ml-auto text-xs font-medium text-gray-500">{savingPreference ? 'Saving…' : checked ? 'Checked' : 'Unchecked'}</span>
      </label>
      <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 border-t border-gray-200 pt-3 text-xs">
        <span className="text-gray-500">Printer</span><span className="text-right font-medium text-gray-800">{loading ? 'Loading…' : settings.printer_name || 'Not configured'}</span>
        <span className="text-gray-500">Connection</span><span className="text-right font-medium capitalize text-gray-800">{settings.connection_type}</span>
        {settings.connection_type === 'network' ? <><span className="text-gray-500">Address</span><span className="text-right font-medium text-gray-800">{settings.ip_address && settings.port ? `${settings.ip_address}:${settings.port}` : 'Not configured'}</span></> : null}
        <span className="text-gray-500">Printer Status</span>
        <span className={`text-right font-semibold ${availability.available ? 'text-emerald-700' : 'text-amber-700'}`}>{loading ? 'Loading' : availability.label}</span>
      </div>
      <a href="/settings/thermal-printer" className="mt-3 inline-block text-xs font-semibold text-blue-600 hover:underline">Manage Printer Settings</a>
    </div>
  )
}
