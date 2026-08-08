import assert from 'node:assert/strict'
import test from 'node:test'

import { defaultThermalPrinterSettings } from './thermalPrinterSettings'
import { isCurrentPrinterSnapshot, resolveLoadedPrinterState } from './optionalPrinterState'

test('disabled and missing printer configuration remain non-operational peripheral states', () => {
  assert.equal(resolveLoadedPrinterState({ ...defaultThermalPrinterSettings, inherited_global_legacy: false }), 'disabled')
  assert.equal(resolveLoadedPrinterState({ ...defaultThermalPrinterSettings, inherited_global_legacy: true }), 'not_configured')
})

test('configured printer remains available to existing printing behavior', () => {
  assert.equal(resolveLoadedPrinterState({
    ...defaultThermalPrinterSettings,
    is_enabled: true,
    printer_name: 'Front Desk',
    ip_address: '192.0.2.10',
    inherited_global_legacy: false,
  }), 'ready')
})

test('printer snapshot is hidden immediately across Branch switches and All Branches', () => {
  assert.equal(isCurrentPrinterSnapshot(1, 1), true)
  assert.equal(isCurrentPrinterSnapshot(2, 1), false)
  assert.equal(isCurrentPrinterSnapshot(null, 1), false)
})
