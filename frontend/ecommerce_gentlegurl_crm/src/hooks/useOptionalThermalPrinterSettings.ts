'use client'

import { useEffect, useState } from 'react'

import { useBranch } from '@/contexts/BranchContext'
import { defaultThermalPrinterSettings, getThermalPrinterSettings, type ThermalPrinterSettings } from '@/lib/thermalPrinterSettings'
import { isCurrentPrinterSnapshot, resolveLoadedPrinterState, type OptionalPrinterState } from '@/lib/optionalPrinterState'
export type { OptionalPrinterState } from '@/lib/optionalPrinterState'

export function useOptionalThermalPrinterSettings() {
  const { selectedBranchId } = useBranch()
  const [settings, setSettings] = useState<ThermalPrinterSettings>(defaultThermalPrinterSettings)
  const [state, setState] = useState<OptionalPrinterState>('idle')
  const [error, setError] = useState<string | null>(null)
  const [loadedBranchId, setLoadedBranchId] = useState<number | null>(null)

  useEffect(() => {
    const controller = new AbortController()
    let active = true
    let timeoutId: number | null = null
    let idleId: number | null = null
    let startTimeoutId: number | null = null

    if (!selectedBranchId) {
      return () => controller.abort()
    }

    const load = () => {
      if (!active) return
      setState('loading')
      setError(null)
      timeoutId = window.setTimeout(() => controller.abort(), 8000)
      void getThermalPrinterSettings(selectedBranchId, controller.signal)
        .then((nextSettings) => {
          if (!active) return
          setSettings(nextSettings)
          setLoadedBranchId(selectedBranchId)
          setState(resolveLoadedPrinterState(nextSettings))
        })
        .catch((reason: unknown) => {
          if (!active) return
          setSettings(defaultThermalPrinterSettings)
          setLoadedBranchId(selectedBranchId)
          setState('error')
          setError(reason instanceof Error && reason.name !== 'AbortError' ? reason.message : 'Printer settings request timed out.')
        })
        .finally(() => {
          if (timeoutId !== null) window.clearTimeout(timeoutId)
        })
    }

    // Printer configuration is optional. Dispatch it after required page effects
    // have had an opportunity to start their operational requests.
    const scheduleIdle = window.requestIdleCallback?.bind(window)
    if (scheduleIdle) idleId = scheduleIdle(load, { timeout: 250 })
    else startTimeoutId = globalThis.setTimeout(load, 0) as unknown as number

    return () => {
      active = false
      controller.abort()
      if (idleId !== null) window.cancelIdleCallback(idleId)
      if (startTimeoutId !== null) window.clearTimeout(startTimeoutId)
      if (timeoutId !== null) window.clearTimeout(timeoutId)
    }
  }, [selectedBranchId])

  const isCurrentBranch = isCurrentPrinterSnapshot(selectedBranchId, loadedBranchId)
  const effectiveState: OptionalPrinterState = selectedBranchId === null ? 'idle' : isCurrentBranch ? state : 'loading'

  return {
    settings: isCurrentBranch ? settings : defaultThermalPrinterSettings,
    setSettings,
    loading: effectiveState === 'loading',
    state: effectiveState,
    error: isCurrentBranch ? error : null,
  }
}
