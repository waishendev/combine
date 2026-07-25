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

export async function testThermalPrinter(settings: ThermalPrinterSettings) {
  return apiFetch<ApiResponse<{ status: 'sent'; address: string }>>('/api/proxy/ecommerce/thermal-printer-settings/test', {
    method: 'POST',
    body: JSON.stringify(settings),
  })
}
