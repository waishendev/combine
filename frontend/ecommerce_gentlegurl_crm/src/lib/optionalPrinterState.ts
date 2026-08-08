import { getThermalPrinterAvailability, type ThermalPrinterSettings } from '@/lib/thermalPrinterSettings'

export type OptionalPrinterState = 'idle' | 'loading' | 'ready' | 'disabled' | 'not_configured' | 'error'

export function resolveLoadedPrinterState(settings: ThermalPrinterSettings): OptionalPrinterState {
  const missingBranchConfiguration = settings.inherited_global_legacy
    && !settings.printer_name?.trim()
    && !settings.ip_address?.trim()
  if (missingBranchConfiguration) return 'not_configured'
  if (!settings.is_enabled) return 'disabled'
  return getThermalPrinterAvailability(settings).label === 'Not Configured' ? 'not_configured' : 'ready'
}

export function isCurrentPrinterSnapshot(selectedBranchId: number | null, loadedBranchId: number | null): boolean {
  return selectedBranchId !== null && selectedBranchId === loadedBranchId
}
