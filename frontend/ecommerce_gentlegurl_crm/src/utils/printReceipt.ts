/**
 * POS receipt printing utilities.
 *
 * USB mode   — Opens receipt URL in a hidden iframe and calls window.print().
 * Bluetooth  — Connects to a BLE thermal printer and sends ESC/POS commands.
 * WiFi       — Sends ESC/POS bytes to printer IP via server-side TCP proxy.
 *
 * Reusable across any page that needs receipt printing.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

// ─── Web Bluetooth type shims (experimental API, not in all TS libs) ──────────

interface BtCharacteristic {
  properties: { write: boolean; writeWithoutResponse: boolean }
  writeValueWithResponse(value: BufferSource): Promise<void>
  writeValueWithoutResponse(value: BufferSource): Promise<void>
}

interface BtService {
  getCharacteristics(): Promise<BtCharacteristic[]>
}

interface BtServer {
  connected: boolean
  connect(): Promise<BtServer>
  disconnect(): void
  getPrimaryService(service: string): Promise<BtService>
}

interface BtDevice {
  id: string
  name?: string
  gatt?: BtServer
  addEventListener(event: string, listener: () => void): void
}

// ─── Types ────────────────────────────────────────────────────────────────────

export type ReceiptLineItem = {
  name: string
  qty: number
  amount: number
}

export type ReceiptData = {
  order_number: string
  date?: Date
  payment_method: string
  total: number
  paid_amount: number
  change_amount: number
  items?: ReceiptLineItem[]
}

// ─── USB / iframe printing ────────────────────────────────────────────────────

export function printReceipt(receiptUrl: string): void {
  if (!receiptUrl) return

  const iframe = document.createElement('iframe')
  iframe.style.position = 'fixed'
  iframe.style.top = '-10000px'
  iframe.style.left = '-10000px'
  iframe.style.width = '0'
  iframe.style.height = '0'
  iframe.style.border = 'none'
  iframe.src = receiptUrl

  const cleanup = () => {
    try {
      document.body.removeChild(iframe)
    } catch {
      /* already removed */
    }
  }

  iframe.addEventListener('load', () => {
    try {
      iframe.contentWindow?.focus()
      iframe.contentWindow?.print()
    } catch {
      window.open(receiptUrl, '_blank')
    }
    setTimeout(cleanup, 1000)
  })

  iframe.addEventListener('error', () => {
    window.open(receiptUrl, '_blank')
    cleanup()
  })

  document.body.appendChild(iframe)
}

// ─── Bluetooth thermal printer (ESC/POS over BLE) ────────────────────────────

const PRINTER_SERVICE_UUIDS = [
  'e7810a71-73ae-499d-8c15-faa9aef0c3f2',
  '000018f0-0000-1000-8000-00805f9b34fb',
  '49535343-fe7d-4ae5-8fa9-9fafd205e455',
  '0000ff00-0000-1000-8000-00805f9b34fb',
  '0000fee7-0000-1000-8000-00805f9b34fb',
]

let _btDevice: BtDevice | null = null
let _btCharacteristic: BtCharacteristic | null = null

export function isBluetoothPrinterConnected(): boolean {
  return Boolean(_btDevice?.gatt?.connected && _btCharacteristic)
}

export function getBluetoothPrinterName(): string | null {
  if (!_btDevice?.gatt?.connected) return null
  return _btDevice.name ?? _btDevice.id ?? 'Unknown Printer'
}

export async function connectBluetoothPrinter(): Promise<string> {
  if (isBluetoothPrinterConnected() && _btDevice) {
    return _btDevice.name ?? _btDevice.id ?? 'Printer'
  }

  const bt = (navigator as any).bluetooth
  if (!bt) throw new Error('Web Bluetooth is not supported on this browser.')

  const device: BtDevice = await bt.requestDevice({
    acceptAllDevices: true,
    optionalServices: PRINTER_SERVICE_UUIDS,
  })

  if (!device.gatt) throw new Error('Bluetooth GATT not available on this device.')

  const server = await device.gatt.connect()

  let writeChar: BtCharacteristic | null = null

  for (const uuid of PRINTER_SERVICE_UUIDS) {
    try {
      const service = await server.getPrimaryService(uuid)
      const chars = await service.getCharacteristics()
      for (const c of chars) {
        if (c.properties.writeWithoutResponse || c.properties.write) {
          writeChar = c
          break
        }
      }
      if (writeChar) break
    } catch {
      /* service not found on this device — try next */
    }
  }

  if (!writeChar) {
    device.gatt.disconnect()
    throw new Error('No writable characteristic found. Printer may not be compatible.')
  }

  _btDevice = device
  _btCharacteristic = writeChar

  device.addEventListener('gattserverdisconnected', () => {
    _btDevice = null
    _btCharacteristic = null
  })

  return device.name ?? device.id ?? 'Printer'
}

export function disconnectBluetoothPrinter(): void {
  try {
    _btDevice?.gatt?.disconnect()
  } catch {
    /* ignore */
  }
  _btDevice = null
  _btCharacteristic = null
}

// ─── ESC/POS formatting ──────────────────────────────────────────────────────

const ESC = 0x1b
const GS = 0x1d
const COLS = 32 // 58 mm paper

const CMD_INIT = new Uint8Array([ESC, 0x40])
const CMD_CENTER = new Uint8Array([ESC, 0x61, 0x01])
const CMD_LEFT = new Uint8Array([ESC, 0x61, 0x00])
const CMD_BOLD_ON = new Uint8Array([ESC, 0x45, 0x01])
const CMD_BOLD_OFF = new Uint8Array([ESC, 0x45, 0x00])
const CMD_DOUBLE = new Uint8Array([ESC, 0x21, 0x30])
const CMD_NORMAL = new Uint8Array([ESC, 0x21, 0x00])
const CMD_FEED_CUT = new Uint8Array([ESC, 0x64, 0x04, GS, 0x56, 0x00])

const encoder = new TextEncoder()

function textBytes(text: string): Uint8Array {
  return encoder.encode(text + '\n')
}

function divider(char = '-'): Uint8Array {
  return textBytes(char.repeat(COLS))
}

function fmtMoney(n: number): string {
  return n.toFixed(2)
}

function itemLine(name: string, qty: number, amount: number): Uint8Array {
  const right = ` x${qty}  ${fmtMoney(amount)}`
  const maxName = COLS - right.length
  const truncName = name.length > maxName ? name.slice(0, maxName) : name
  const gap = Math.max(0, COLS - truncName.length - right.length)
  return textBytes(truncName + ' '.repeat(gap) + right)
}

function summaryLine(label: string, value: string): Uint8Array {
  const gap = Math.max(1, COLS - label.length - value.length)
  return textBytes(label + ' '.repeat(gap) + value)
}

function buildReceiptBytes(data: ReceiptData): Uint8Array {
  const parts: Uint8Array[] = []
  const push = (...arrs: Uint8Array[]) => arrs.forEach((a) => parts.push(a))

  const now = data.date ?? new Date()
  const dateStr = `${now.toLocaleDateString()} ${now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`

  push(CMD_INIT)

  push(CMD_CENTER, CMD_BOLD_ON, CMD_DOUBLE)
  push(textBytes('RECEIPT'))
  push(CMD_NORMAL, CMD_BOLD_OFF)
  push(divider('='))

  push(CMD_LEFT)
  push(textBytes(`Order: ${data.order_number}`))
  push(textBytes(`Date:  ${dateStr}`))
  push(textBytes(`Pay:   ${data.payment_method.toUpperCase()}`))
  push(divider())

  if (data.items && data.items.length > 0) {
    for (const item of data.items) {
      push(itemLine(item.name, item.qty, item.amount))
    }
    push(divider())
  }

  push(CMD_BOLD_ON)
  push(summaryLine('TOTAL', `RM ${fmtMoney(data.total)}`))
  push(CMD_BOLD_OFF)
  push(summaryLine('Paid', `RM ${fmtMoney(data.paid_amount)}`))
  if (data.change_amount > 0) {
    push(summaryLine('Change', `RM ${fmtMoney(data.change_amount)}`))
  }
  push(divider('='))

  push(CMD_CENTER)
  push(textBytes('Thank you!'))
  push(CMD_LEFT)

  push(CMD_FEED_CUT)

  const totalLen = parts.reduce((sum, p) => sum + p.length, 0)
  const merged = new Uint8Array(totalLen)
  let offset = 0
  for (const p of parts) {
    merged.set(p, offset)
    offset += p.length
  }
  return merged
}

async function writeChunked(
  char: BtCharacteristic,
  data: Uint8Array,
  chunkSize = 100,
): Promise<void> {
  for (let i = 0; i < data.length; i += chunkSize) {
    const chunk = data.slice(i, Math.min(i + chunkSize, data.length))
    if (char.properties.writeWithoutResponse) {
      await char.writeValueWithoutResponse(chunk)
    } else {
      await char.writeValueWithResponse(chunk)
    }
  }
}

export async function printReceiptBluetooth(data: ReceiptData): Promise<void> {
  if (!isBluetoothPrinterConnected() || !_btCharacteristic) {
    throw new Error('Bluetooth printer is not connected.')
  }
  const bytes = buildReceiptBytes(data)
  await writeChunked(_btCharacteristic, bytes)
}

// ─── WiFi thermal printer (ESC/POS over TCP via server proxy) ─────────────────

export async function printReceiptWifi(
  ip: string,
  port: number,
  data: ReceiptData,
): Promise<void> {
  if (!ip) throw new Error('Printer IP address is required.')

  const bytes = buildReceiptBytes(data)
  const base64 = uint8ToBase64(bytes)

  const res = await fetch('/api/print/wifi', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ip, port, data: base64 }),
  })

  if (!res.ok) {
    const json = await res.json().catch(() => null)
    throw new Error(json?.message ?? `WiFi print failed (HTTP ${res.status})`)
  }
}

export async function testWifiPrinterConnection(ip: string, port: number): Promise<void> {
  const testData: ReceiptData = {
    order_number: 'TEST-PRINT',
    payment_method: 'N/A',
    total: 0,
    paid_amount: 0,
    change_amount: 0,
    items: [{ name: 'Test Item', qty: 1, amount: 0 }],
  }
  await printReceiptWifi(ip, port, testData)
}

function uint8ToBase64(bytes: Uint8Array): string {
  let binary = ''
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i])
  }
  return btoa(binary)
}
