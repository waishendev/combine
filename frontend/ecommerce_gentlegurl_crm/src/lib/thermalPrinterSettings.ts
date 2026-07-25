import { apiFetch } from '@/lib/api'

export type ThermalPrinterSettings = {
  is_enabled: boolean
  printer_name: string | null
  connection_type: 'network' | 'usb' | 'bluetooth'
  ip_address: string | null
  port: number | null
  paper_width: 58 | 80
  auto_print_receipt: boolean
  copies: number
}

type ApiResponse<T> = { data: T; message: string | null; success: boolean }

export const defaultThermalPrinterSettings: ThermalPrinterSettings = {
  is_enabled: false,
  printer_name: null,
  connection_type: 'network',
  ip_address: null,
  port: 9100,
  paper_width: 80,
  auto_print_receipt: true,
  copies: 1,
}

export function getThermalPrinterAvailability(settings: ThermalPrinterSettings): { available: boolean; label: 'Ready' | 'Printer Disabled' | 'Unsupported' | 'Not Configured' } {
  if (!settings.is_enabled) return { available: false, label: 'Printer Disabled' }
  if (settings.connection_type !== 'network') return { available: false, label: 'Unsupported' }
  if (!settings.ip_address?.trim() || !settings.port) return { available: false, label: 'Not Configured' }
  return { available: true, label: 'Ready' }
}

export async function getThermalPrinterSettings() {
  const response = await apiFetch<ApiResponse<Partial<ThermalPrinterSettings>>>('/api/proxy/ecommerce/thermal-printer-settings')
  return { ...defaultThermalPrinterSettings, ...response.data }
}

export async function saveThermalPrinterSettings(settings: ThermalPrinterSettings) {
  return apiFetch<ApiResponse<ThermalPrinterSettings>>('/api/proxy/ecommerce/thermal-printer-settings', {
    method: 'PUT',
    body: JSON.stringify(settings),
  })
}

export async function saveThermalPrinterAutoPrint(autoPrintReceipt: boolean) {
  return apiFetch<ApiResponse<ThermalPrinterSettings>>('/api/proxy/ecommerce/thermal-printer-settings/auto-print', {
    method: 'PATCH',
    body: JSON.stringify({ auto_print_receipt: autoPrintReceipt }),
  })
}

export async function testThermalPrinter(settings: ThermalPrinterSettings) {
  return apiFetch<ApiResponse<{ status: 'sent'; address: string }>>('/api/proxy/ecommerce/thermal-printer-settings/test', {
    method: 'POST',
    body: JSON.stringify(settings),
  })
}
