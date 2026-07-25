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

export type ReceiptSection = 'product' | 'service' | 'package'

export type ReceiptAddonLine = {
  name: string
  cn_name?: string | null
  qty?: number | null
  amount?: number | null
  /** Package name when this add-on is claimed (original price still shown). */
  package_claim?: string | null
}

export type ReceiptLineItem = {
  name: string
  cn_name?: string | null
  qty: number
  amount: number
  /** Defaults to product when omitted (legacy flat receipts). */
  section?: ReceiptSection
  /** Services: deposit / final settlement label prefix (booking products leave unset). */
  stage?: 'deposit' | 'settlement' | null
  addons?: ReceiptAddonLine[]
  /** Booking product option lines under the parent. */
  children?: ReceiptAddonLine[]
  /** Package name when this main line is claimed (original price still shown). */
  package_claim?: string | null
}

export type ReceiptPayment = {
  method: string
  amount?: number
}

export type ReceiptShopInfo = {
  name?: string
  address?: string
  phone?: string | null
}

export type ReceiptData = {
  order_number: string
  date?: Date | string
  payment_method: string
  payments?: ReceiptPayment[]
  customer_name?: string | null
  customer_phone?: string | null
  total: number
  subtotal?: number
  discount?: number
  package_covered?: number
  paid_amount: number
  change_amount: number
  items?: ReceiptLineItem[]
  /** Public receipt / e-Invoice URL encoded as QR. */
  qr_url?: string | null
  shop?: ReceiptShopInfo
  paper_width?: 58 | 80
}

export const DEFAULT_RECEIPT_SHOP: Required<Pick<ReceiptShopInfo, 'name' | 'address'>> & {
  phone: string
} = {
  name: 'Gentlegurls Nail Salon',
  address: '14, Lebuh Cintra, George Town,\n10200 George Town, Pulau Pinang',
  phone: '0103870881',
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
const CMD_INIT = new Uint8Array([ESC, 0x40])
const CMD_CENTER = new Uint8Array([ESC, 0x61, 0x01])
const CMD_LEFT = new Uint8Array([ESC, 0x61, 0x00])
const CMD_BOLD_ON = new Uint8Array([ESC, 0x45, 0x01])
const CMD_BOLD_OFF = new Uint8Array([ESC, 0x45, 0x00])
const CMD_NORMAL = new Uint8Array([ESC, 0x21, 0x00])
/** Font B — slightly smaller on most ESC/POS printers (used for claim notes). */
const CMD_SMALL_ON = new Uint8Array([ESC, 0x21, 0x01])
const CMD_SMALL_OFF = new Uint8Array([ESC, 0x21, 0x00])
const CMD_FEED_CUT = new Uint8Array([ESC, 0x64, 0x04, GS, 0x56, 0x00])

const asciiEncoder = new TextEncoder()

/** CJK / Hangul / fullwidth glyphs are typically double-width on thermal printers. */
function displayWidth(text: string): number {
  let width = 0
  for (const ch of text) {
    const code = ch.codePointAt(0) ?? 0
    if (
      (code >= 0x1100 && code <= 0x115f) ||
      (code >= 0x2e80 && code <= 0xa4cf) ||
      (code >= 0xac00 && code <= 0xd7a3) ||
      (code >= 0xf900 && code <= 0xfaff) ||
      (code >= 0xfe10 && code <= 0xfe6f) ||
      (code >= 0xff00 && code <= 0xff60) ||
      (code >= 0xffe0 && code <= 0xffe6) ||
      (code >= 0x20000 && code <= 0x2fa1f)
    ) {
      width += 2
    } else {
      width += 1
    }
  }
  return width
}

function hasNonAscii(text: string): boolean {
  for (let i = 0; i < text.length; i += 1) {
    if ((text.charCodeAt(i) ?? 0) > 0x7f) return true
  }
  return false
}

function paperDots(paperWidth: 58 | 80): number {
  return paperWidth === 80 ? 576 : 384
}

/**
 * Render a text line as an ESC/POS raster bitmap.
 * Works for Chinese / Korean / mixed scripts on printers that lack UTF-8 text mode.
 * Default weight is normal so mixed CJK+Latin lines match plain ESC/POS item text.
 */
function renderTextAsRaster(
  text: string,
  paperWidth: 58 | 80,
  align: 'left' | 'center' = 'left',
  options?: { bold?: boolean; fontSize?: number; lineHeight?: number; fontFamily?: string },
): Uint8Array {
  if (typeof document === 'undefined') {
    return asciiEncoder.encode(`${text}\n`)
  }

  const maxWidth = paperDots(paperWidth)
  const fontSize = options?.fontSize ?? 22
  const lineHeight = options?.lineHeight ?? Math.round(fontSize * 1.25)
  const weight = options?.bold ? 'bold' : 'normal'
  const fontFamily =
    options?.fontFamily ??
    `"Noto Sans SC", "Noto Sans CJK SC", "Microsoft YaHei", "PingFang SC", ` +
      `"Malgun Gothic", "Apple SD Gothic Neo", "Segoe UI", sans-serif`
  const font = `${weight} ${fontSize}px ${fontFamily}`

  const measureCanvas = document.createElement('canvas')
  const measureCtx = measureCanvas.getContext('2d')
  if (!measureCtx) return asciiEncoder.encode(`${text}\n`)
  measureCtx.font = font

  const lines: string[] = []
  let current = ''
  for (const ch of text) {
    const next = current + ch
    if (measureCtx.measureText(next).width > maxWidth - 4 && current) {
      lines.push(current)
      current = ch
    } else {
      current = next
    }
  }
  if (current) lines.push(current)
  if (lines.length === 0) lines.push(' ')

  const canvas = document.createElement('canvas')
  canvas.width = maxWidth
  canvas.height = Math.max(lineHeight, lines.length * lineHeight + 4)
  const ctx = canvas.getContext('2d')
  if (!ctx) return asciiEncoder.encode(`${text}\n`)

  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, canvas.width, canvas.height)
  ctx.fillStyle = '#000000'
  ctx.font = font
  ctx.textBaseline = 'top'

  lines.forEach((line, index) => {
    const textWidth = ctx.measureText(line).width
    const x = align === 'center' ? Math.max(0, (maxWidth - textWidth) / 2) : 0
    ctx.fillText(line, x, index * lineHeight + 2)
  })

  return canvasToEscPosRaster(canvas)
}

/** Shop name: centred display type (avoids ESC double-size junk like leading "co"). */
function renderShopNameRaster(name: string, paperWidth: 58 | 80): Uint8Array {
  const clean = String(name ?? '').trim() || DEFAULT_RECEIPT_SHOP.name
  return renderTextAsRaster(clean, paperWidth, 'center', {
    bold: true,
    fontSize: paperWidth === 80 ? 34 : 28,
    lineHeight: paperWidth === 80 ? 42 : 34,
    fontFamily:
      `"Palatino Linotype", Palatino, "Book Antiqua", Georgia, "Times New Roman", ` +
      `"Noto Serif SC", "Songti SC", serif`,
  })
}

function canvasToEscPosRaster(canvas: HTMLCanvasElement): Uint8Array {
  const ctx = canvas.getContext('2d')
  if (!ctx) return new Uint8Array()

  const width = canvas.width
  const height = canvas.height
  const imageData = ctx.getImageData(0, 0, width, height)
  const bytesPerRow = Math.ceil(width / 8)
  const bitmap = new Uint8Array(bytesPerRow * height)

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const i = (y * width + x) * 4
      const alpha = imageData.data[i + 3] ?? 0
      if (alpha < 16) continue
      const luminance =
        0.299 * (imageData.data[i] ?? 0) +
        0.587 * (imageData.data[i + 1] ?? 0) +
        0.114 * (imageData.data[i + 2] ?? 0)
      if (luminance < 160) {
        bitmap[y * bytesPerRow + (x >> 3)] |= 0x80 >> (x & 7)
      }
    }
  }

  const header = new Uint8Array([
    GS,
    0x76,
    0x30,
    0x00,
    bytesPerRow & 0xff,
    (bytesPerRow >> 8) & 0xff,
    height & 0xff,
    (height >> 8) & 0xff,
  ])
  const out = new Uint8Array(header.length + bitmap.length)
  out.set(header, 0)
  out.set(bitmap, header.length)
  return out
}

function textBytes(text: string, paperWidth: 58 | 80 = 58, align: 'left' | 'center' = 'left'): Uint8Array {
  const line = text.endsWith('\n') ? text.slice(0, -1) : text
  if (hasNonAscii(line)) {
    return renderTextAsRaster(line, paperWidth, align)
  }
  return asciiEncoder.encode(`${line}\n`)
}

function divider(char = '-', cols = 32, paperWidth: 58 | 80 = 58): Uint8Array {
  return textBytes(char.repeat(cols), paperWidth)
}

function concatBytes(...parts: Uint8Array[]): Uint8Array {
  const totalLen = parts.reduce((sum, part) => sum + part.length, 0)
  const merged = new Uint8Array(totalLen)
  let offset = 0
  for (const part of parts) {
    merged.set(part, offset)
    offset += part.length
  }
  return merged
}

function wrapByDisplayWidth(text: string, maxWidth: number): string[] {
  if (maxWidth < 1) return [text]
  const lines: string[] = []
  let current = ''
  for (const ch of text) {
    const next = current + ch
    if (displayWidth(next) > maxWidth && current) {
      lines.push(current)
      current = ch
    } else {
      current = next
    }
  }
  if (current) lines.push(current)
  return lines.length > 0 ? lines : ['']
}

function fmtMoney(n: number): string {
  return Number(n || 0).toFixed(2)
}

export function formatReceiptPaymentLabel(method: string): string {
  const key = String(method || '').trim().toLowerCase()
  if (key === 'cash') return 'Cash'
  if (key === 'qrpay' || key === 'qr_pay') return 'QRPay'
  if (key === 'credit_card' || key === 'billplz_credit_card') return 'Credit Card'
  if (key === 'customer_balance' || key === 'wallet') return 'Customer Balance'
  if (key === 'bank_transfer' || key === 'transfer') return 'Bank Transfer'
  if (key === 'split') return 'Split'
  if (!key) return '-'
  return method.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
}

export function formatReceiptPaymentMethod(
  paymentMethod: string,
  payments?: ReceiptPayment[] | null,
): string {
  const rows = (payments ?? []).filter((row) => String(row.method || '').trim() !== '')
  if (rows.length > 1) {
    return rows.map((row) => formatReceiptPaymentLabel(row.method)).join(' + ')
  }
  if (rows.length === 1) {
    return formatReceiptPaymentLabel(rows[0].method)
  }
  return formatReceiptPaymentLabel(paymentMethod)
}

function sanitizeCustomerFacingName(name: string): string {
  const raw = String(name ?? '').trim()
  if (!raw) return 'Item'
  // Keep "Deposit - …" / "Final Settlement - …"; only strip bracket tags like [DEPOSIT].
  return raw
    .replace(/\s*\[(DEPOSIT|SETTLEMENT)\]\s*/gi, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim() || raw
}

function withServiceStagePrefix(name: string, stage?: 'deposit' | 'settlement' | null): string {
  const base = String(name ?? '').trim()
  if (!base) return base
  if (
    /^(deposit|booking\s+deposit|final\s+settlement|appointment\s+deposit|appointment\s+settlement)\b/i.test(base)
  ) {
    return base
  }
  if (stage === 'deposit') return `Deposit - ${base}`
  if (stage === 'settlement') return `Final Settlement - ${base}`
  return base
}

function displayItemName(item: Pick<ReceiptLineItem, 'name' | 'cn_name' | 'stage'>): string {
  const name = withServiceStagePrefix(sanitizeCustomerFacingName(String(item.name ?? '')), item.stage)
  const cn = String(item.cn_name ?? '').trim()
  return cn ? `${name} / ${cn}` : name
}

function summaryLine(label: string, value: string, cols: number, paperWidth: 58 | 80): Uint8Array {
  const gap = Math.max(1, cols - displayWidth(label) - displayWidth(value))
  return textBytes(`${label}${' '.repeat(gap)}${value}`, paperWidth)
}

function metaLine(label: string, value: string, cols: number, paperWidth: 58 | 80): Uint8Array {
  const prefix = `${label.padEnd(14, ' ')}: `
  const restWidth = Math.max(8, cols - displayWidth(prefix))
  const valueLines = wrapByDisplayWidth(String(value || '-'), restWidth)
  const parts: Uint8Array[] = []
  valueLines.forEach((line, idx) => {
    if (idx === 0) {
      parts.push(textBytes(`${prefix}${line}`, paperWidth))
    } else {
      parts.push(textBytes(`${' '.repeat(displayWidth(prefix))}${line}`, paperWidth))
    }
  })
  return concatBytes(...parts)
}

/** Spec money format: `RM 180.00` / `- RM 50.00` */
function moneyLabel(amount: number, signed: '' | '-' = ''): string {
  const body = `RM ${fmtMoney(amount)}`
  return signed === '-' ? `- ${body}` : body
}

function formatReceiptDate(date: Date): string {
  try {
    return new Intl.DateTimeFormat('en-GB', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    }).format(date)
  } catch {
    return `${date.toLocaleDateString()} ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
  }
}

function sectionTitle(title: string, paperWidth: 58 | 80): Uint8Array {
  return concatBytes(CMD_BOLD_ON, textBytes(title, paperWidth), CMD_BOLD_OFF)
}

/** Fixed trailing columns so Qty / Amount always land under the headers. */
const QTY_COL_CHARS = 4 // "x99"
const AMT_COL_CHARS = 12 // "RM 9999.00"
const COL_GAP_CHARS = 2

function bodyRasterFont(bold = false): { font: string; fontSize: number; lineHeight: number } {
  const fontSize = 22
  const lineHeight = 28
  const fontFamily =
    `"Noto Sans SC", "Noto Sans CJK SC", "Microsoft YaHei", "PingFang SC", ` +
    `"Malgun Gothic", "Apple SD Gothic Neo", "Segoe UI", sans-serif`
  return {
    fontSize,
    lineHeight,
    font: `${bold ? 'bold' : 'normal'} ${fontSize}px ${fontFamily}`,
  }
}

/**
 * Draw one receipt row with name left + Qty/Amount in fixed right columns (pixel-aligned).
 * Avoids CJK/space padding drift from ESC/POS text mode.
 */
function renderAlignedColumnsRaster(
  name: string,
  qtyText: string,
  amountText: string,
  paperWidth: 58 | 80,
  options?: { bold?: boolean },
): Uint8Array {
  if (typeof document === 'undefined') {
    const right = amountText
      ? `${qtyText.padEnd(QTY_COL_CHARS)}${' '.repeat(COL_GAP_CHARS)}${amountText.padStart(AMT_COL_CHARS)}`
      : qtyText.padEnd(QTY_COL_CHARS)
    return asciiEncoder.encode(`${name} ${right}\n`)
  }

  const maxWidth = paperDots(paperWidth)
  const { font, lineHeight } = bodyRasterFont(Boolean(options?.bold))
  const pad = 2

  const measureCanvas = document.createElement('canvas')
  const measureCtx = measureCanvas.getContext('2d')
  if (!measureCtx) return asciiEncoder.encode(`${name}\n`)
  measureCtx.font = font

  // Fixed columns: Qty left-aligned, Amount right-aligned (under their headers).
  const sampleQty = 'x99'
  const sampleAmt = 'RM 9999.00'
  const qtyColPx = Math.max(
    Math.ceil(measureCtx.measureText(sampleQty).width),
    Math.ceil(measureCtx.measureText('Qty').width),
  ) + 8
  const amtColPx = Math.ceil(measureCtx.measureText(sampleAmt).width) + 4
  const gapPx = Math.ceil(measureCtx.measureText('   ').width)
  const rightBlockPx = qtyColPx + gapPx + amtColPx
  const nameMaxPx = Math.max(40, maxWidth - rightBlockPx - pad * 2)

  // Wrap name into the left zone only.
  const lines: string[] = []
  let current = ''
  for (const ch of name) {
    const next = current + ch
    if (measureCtx.measureText(next).width > nameMaxPx && current) {
      lines.push(current)
      current = ch
    } else {
      current = next
    }
  }
  if (current) lines.push(current)
  if (lines.length === 0) lines.push(' ')

  const canvas = document.createElement('canvas')
  canvas.width = maxWidth
  canvas.height = Math.max(lineHeight, lines.length * lineHeight + 4)
  const ctx = canvas.getContext('2d')
  if (!ctx) return asciiEncoder.encode(`${name}\n`)

  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, canvas.width, canvas.height)
  ctx.fillStyle = '#000000'
  ctx.font = font
  ctx.textBaseline = 'top'

  const qtyLeft = maxWidth - pad - amtColPx - gapPx - qtyColPx
  const amtRight = maxWidth - pad

  lines.forEach((line, index) => {
    const y = index * lineHeight + 2
    ctx.textAlign = 'left'
    ctx.fillText(line, pad, y)
    if (index === 0) {
      // Qty sits on the left of its column; Amount stays flush right.
      if (qtyText) {
        ctx.textAlign = 'left'
        ctx.fillText(qtyText, qtyLeft, y)
      }
      if (amountText) {
        ctx.textAlign = 'right'
        ctx.fillText(amountText, amtRight, y)
      }
    }
  })
  ctx.textAlign = 'left'

  return canvasToEscPosRaster(canvas)
}

function columnHeaderLine(_cols: number, paperWidth: 58 | 80): Uint8Array {
  return renderAlignedColumnsRaster('Item', 'Qty', 'Amount', paperWidth, { bold: true })
}

/**
 * Qty + Amount stay on the FIRST line under the Qty/Amount columns.
 * Long names wrap onto following lines without dragging qty/amount down.
 */
function qtyAmountColumns(
  name: string,
  qty: number,
  amount: number | null,
  _cols: number,
  paperWidth: 58 | 80,
  indent = '',
): Uint8Array {
  const qtyText = `x${Math.max(1, Number(qty) || 1)}`
  const amountText = amount == null || !Number.isFinite(amount) ? '' : moneyLabel(amount)
  return renderAlignedColumnsRaster(`${indent}${name}`, qtyText, amountText, paperWidth)
}

function claimNoteBytes(
  packageName: string | null | undefined,
  cols: number,
  paperWidth: 58 | 80,
  indent: string,
): Uint8Array {
  const name = String(packageName ?? '').trim()
  const parts: Uint8Array[] = [CMD_SMALL_ON]
  if (!name) {
    for (const line of wrapByDisplayWidth(`${indent}✓ Package Claimed`, cols)) {
      parts.push(textBytes(line, paperWidth))
    }
  } else {
    const prefix = `${indent}✓ Claimed by: `
    if (displayWidth(prefix) + displayWidth(name) <= cols) {
      parts.push(textBytes(`${prefix}${name}`, paperWidth))
    } else {
      parts.push(textBytes(`${indent}✓ Claimed by:`, paperWidth))
      for (const line of wrapByDisplayWidth(`${indent}  ${name}`, cols)) {
        parts.push(textBytes(line, paperWidth))
      }
    }
  }
  parts.push(CMD_SMALL_OFF)
  return concatBytes(...parts)
}

function pushAddonLines(
  push: (...arrs: Uint8Array[]) => void,
  nodes: ReceiptAddonLine[],
  cols: number,
  paperWidth: 58 | 80,
): void {
  for (const node of nodes) {
    const label = displayItemName(node)
    const qty = Math.max(1, Number(node.qty ?? 1) || 1)
    const amountValue = node.amount != null && Number.isFinite(Number(node.amount)) ? Number(node.amount) : null
    push(qtyAmountColumns(`+ ${label}`, qty, amountValue, cols, paperWidth, '   '))
    if (node.package_claim != null) {
      push(claimNoteBytes(node.package_claim || null, cols, paperWidth, '     '))
    }
  }
}

/** Epson-compatible QR code (GS ( k). */
function qrCodeBytes(content: string, moduleSize = 5): Uint8Array {
  const data = asciiEncoder.encode(content)
  const storeLen = data.length + 3
  const pL = storeLen & 0xff
  const pH = (storeLen >> 8) & 0xff
  const size = Math.max(3, Math.min(8, moduleSize))

  return concatBytes(
    new Uint8Array([GS, 0x28, 0x6b, 0x04, 0x00, 0x31, 0x41, 0x32, 0x00]),
    new Uint8Array([GS, 0x28, 0x6b, 0x03, 0x00, 0x31, 0x43, size]),
    new Uint8Array([GS, 0x28, 0x6b, 0x03, 0x00, 0x31, 0x45, 0x31]),
    concatBytes(new Uint8Array([GS, 0x28, 0x6b, pL, pH, 0x31, 0x50, 0x30]), data),
    new Uint8Array([GS, 0x28, 0x6b, 0x03, 0x00, 0x31, 0x51, 0x30]),
  )
}

function resolveDate(date?: Date | string): Date {
  if (date instanceof Date) return date
  if (typeof date === 'string' && date.trim()) {
    const parsed = new Date(date)
    if (!Number.isNaN(parsed.getTime())) return parsed
  }
  return new Date()
}

function groupItems(items: ReceiptLineItem[]): {
  products: ReceiptLineItem[]
  services: ReceiptLineItem[]
  packages: ReceiptLineItem[]
} {
  const products: ReceiptLineItem[] = []
  const services: ReceiptLineItem[] = []
  const packages: ReceiptLineItem[] = []

  for (const item of items) {
    const section = item.section ?? 'product'
    if (section === 'service') services.push(item)
    else if (section === 'package') packages.push(item)
    else products.push(item)
  }

  return { products, services, packages }
}

function pushSection(
  push: (...arrs: Uint8Array[]) => void,
  title: string,
  items: ReceiptLineItem[],
  startIndex: number,
  cols: number,
  paperWidth: 58 | 80,
): number {
  if (items.length === 0) return startIndex

  push(sectionTitle(title, paperWidth))
  push(columnHeaderLine(cols, paperWidth))

  let index = startIndex
  for (const item of items) {
    index += 1
    // Never print DEPOSIT / SETTLEMENT / backend labels — customer-facing name only.
    push(qtyAmountColumns(`${index}. ${displayItemName(item)}`, item.qty, item.amount, cols, paperWidth))
    if (item.package_claim != null) {
      push(claimNoteBytes(item.package_claim || null, cols, paperWidth, '   '))
    }

    const childNodes = [...(item.addons ?? []), ...(item.children ?? [])]
    if (childNodes.length > 0) {
      pushAddonLines(push, childNodes, cols, paperWidth)
    }
  }

  push(divider('-', cols, paperWidth))
  return index
}

function buildReceiptBytes(data: ReceiptData): Uint8Array {
  // Prefer 80mm layout; 58mm still works with fewer columns.
  const paperWidth = data.paper_width === 58 ? 58 : 80
  const cols = paperWidth === 80 ? 48 : 32
  const parts: Uint8Array[] = []
  const push = (...arrs: Uint8Array[]) => arrs.forEach((a) => parts.push(a))

  const shopName = data.shop?.name?.trim() || DEFAULT_RECEIPT_SHOP.name
  const shopAddress = data.shop?.address?.trim() || DEFAULT_RECEIPT_SHOP.address
  const shopPhone = (data.shop?.phone ?? DEFAULT_RECEIPT_SHOP.phone)?.trim() || DEFAULT_RECEIPT_SHOP.phone

  const now = resolveDate(data.date)
  const dateStr = formatReceiptDate(now)
  const customerName = String(data.customer_name ?? '').trim() || 'GUEST'
  const customerPhone = String(data.customer_phone ?? '').trim() || '-'
  const paymentRows = (data.payments ?? [])
    .filter((row) => String(row.method || '').trim() !== '')
    .filter((row) => Number(row.amount ?? 0) > 0.0001)
  const items = data.items ?? []
  const { products, services, packages } = groupItems(items)

  const discount = Number(data.discount ?? 0)
  const packageCovered = Number(data.package_covered ?? 0)
  const subtotal =
    data.subtotal != null && Number.isFinite(Number(data.subtotal))
      ? Number(data.subtotal)
      : Number(data.total || 0) + Math.max(0, discount) + Math.max(0, packageCovered)
  const total = Number(data.total || 0)
  const paidAmount = Number(data.paid_amount || 0)
  const showPaymentBreakdown = total > 0.0001 && paymentRows.length > 0

  push(CMD_INIT)
  // Reset print mode before header — avoid ESC double-size / UTF-8 mode junk (e.g. leading "co").
  push(CMD_NORMAL, CMD_BOLD_OFF, CMD_LEFT)

  // ── Header (centred) ──────────────────────────────────────────────────────
  push(CMD_CENTER)
  push(renderShopNameRaster(shopName, paperWidth))
  push(CMD_NORMAL, CMD_BOLD_OFF)
  for (const line of shopAddress.split(/\r?\n/).flatMap((row) => wrapByDisplayWidth(row.trim(), cols))) {
    if (line) push(textBytes(line, paperWidth, 'center'))
  }
  push(textBytes(`TEL : ${shopPhone}`, paperWidth, 'center'))
  push(CMD_LEFT)
  push(divider('-', cols, paperWidth))

  // Meta — no Payment Method here (split payments live in PAYMENT section)
  push(metaLine('Receipt No', data.order_number, cols, paperWidth))
  push(metaLine('Date', dateStr, cols, paperWidth))
  push(metaLine('Customer', customerName, cols, paperWidth))
  push(metaLine('Phone', customerPhone, cols, paperWidth))
  push(divider('-', cols, paperWidth))

  // ── Item sections (hidden when empty) ─────────────────────────────────────
  let nextIndex = 0
  nextIndex = pushSection(push, '[PRODUCTS]', products, nextIndex, cols, paperWidth)
  nextIndex = pushSection(push, '[SERVICES]', services, nextIndex, cols, paperWidth)
  nextIndex = pushSection(push, '[PACKAGE]', packages, nextIndex, cols, paperWidth)

  // ── Summary ───────────────────────────────────────────────────────────────
  push(summaryLine('Sub Total', moneyLabel(subtotal), cols, paperWidth))
  push(
    summaryLine(
      'Discount',
      discount > 0.0001 ? moneyLabel(discount, '-') : moneyLabel(0),
      cols,
      paperWidth,
    ),
  )
  if (packageCovered > 0.0001) {
    push(summaryLine('Package Covered', moneyLabel(packageCovered, '-'), cols, paperWidth))
  }

  push(divider('-', cols, paperWidth))
  push(CMD_BOLD_ON)
  push(summaryLine('TOTAL', moneyLabel(total), cols, paperWidth))
  push(CMD_NORMAL, CMD_BOLD_OFF)
  push(divider('-', cols, paperWidth))

  // ── Payment ───────────────────────────────────────────────────────────────
  if (showPaymentBreakdown) {
    push(sectionTitle('[PAYMENT]', paperWidth))
    for (const row of paymentRows) {
      push(summaryLine(formatReceiptPaymentLabel(row.method), moneyLabel(Number(row.amount ?? 0)), cols, paperWidth))
    }
    push(divider('-', cols, paperWidth))
  }

  push(CMD_BOLD_ON)
  push(summaryLine(total > 0.0001 || paidAmount > 0.0001 ? 'Paid' : 'Amount Paid', moneyLabel(paidAmount), cols, paperWidth))
  push(CMD_BOLD_OFF)
  if (data.change_amount > 0.0001) {
    push(summaryLine('Change', moneyLabel(data.change_amount), cols, paperWidth))
  }
  if (showPaymentBreakdown || paidAmount > 0.0001 || total <= 0.0001) {
    push(divider('-', cols, paperWidth))
  }

  // ── e-Invoice QR ──────────────────────────────────────────────────────────
  const qrUrl = String(data.qr_url ?? '').trim()
  if (qrUrl) {
    push(textBytes(''))
    push(CMD_CENTER)
    push(textBytes('Please scan the QR code', paperWidth, 'center'))
    push(textBytes('to request your e-Invoice', paperWidth, 'center'))
    push(textBytes(''))
    push(qrCodeBytes(qrUrl, paperWidth === 80 ? 6 : 5))
    push(textBytes(''))
    push(CMD_LEFT)
  }

  push(CMD_CENTER)
  push(textBytes('Thank You', paperWidth, 'center'))
  push(textBytes('See You Again!', paperWidth, 'center'))
  push(CMD_LEFT)
  push(textBytes(''))

  push(CMD_FEED_CUT)

  return concatBytes(...parts)
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

export async function printThermalReceiptCopies(
  settings: { ip_address: string | null; port: number | null; paper_width: 58 | 80; copies: number },
  data: ReceiptData,
): Promise<void> {
  if (!settings.ip_address || !settings.port) throw new Error('Network printer is not configured.')
  for (let copy = 0; copy < settings.copies; copy += 1) {
    await printReceiptWifi(settings.ip_address, settings.port, { ...data, paper_width: settings.paper_width })
  }
}

export async function testWifiPrinterConnection(ip: string, port: number): Promise<void> {
  const testData: ReceiptData = {
    order_number: 'POS-20260725-00052',
    payment_method: 'split',
    payments: [
      { method: 'cash', amount: 500 },
      { method: 'credit_card', amount: 500 },
      { method: 'customer_balance', amount: 729 },
    ],
    customer_name: 'Loyalty Tester',
    customer_phone: '0123456789',
    total: 1729,
    subtotal: 1929,
    discount: 50,
    package_covered: 150,
    paid_amount: 1729,
    change_amount: 0,
    items: [
      { section: 'product', name: 'Keratin Shampoo', qty: 1, amount: 180 },
      { section: 'product', name: 'Hair Oil', qty: 4, amount: 400 },
      {
        section: 'service',
        name: 'Hair Colour',
        qty: 1,
        amount: 180,
        addons: [
          { name: 'Olaplex', qty: 1, amount: 50, package_claim: 'Premium Hair Package' },
          { name: 'Hair Wash', qty: 1, amount: 30 },
        ],
      },
      {
        section: 'service',
        name: 'Blow Dry',
        qty: 1,
        amount: 80,
        addons: [{ name: 'Gloss Toner', qty: 1, amount: 100, package_claim: 'Premium Hair Package' }],
      },
      { section: 'service', name: 'Gel Manicure', qty: 1, amount: 90 },
      { section: 'package', name: 'Premium Hair Package', qty: 1, amount: 999 },
    ],
  }
  await printReceiptWifi(ip, port, testData)
}

/** Map sales-details API payload into thermal ReceiptData. */
export function mapSalesDetailsToThermalReceipt(input: {
  order?: {
    order_no?: string
    order_datetime?: string | null
    created_at?: string | null
    payment_method?: string
    grand_total?: number
    customer?: string | null
    customer_phone?: string | null
    customer_email?: string | null
    receipt_public_url?: string | null
    payments?: Array<{ method?: string; amount?: number }>
  } | null
  lines?: Array<{
    line_type?: string
    name?: string
    cn_name?: string | null
    qty?: number
    net_amount?: number
    gross_amount?: number
    discount_amount?: number
    package_applied?: boolean
    package_name?: string | null
    addon_service_context?: string | null
    children?: Array<{ name?: string; cn_name?: string | null; net_amount?: number; amount?: number; gross_amount?: number }>
  }> | null
  orderId?: number
}): ReceiptData {
  const order = input.order ?? {}
  const lines = input.lines ?? []
  const payments = (order.payments ?? [])
    .filter((row) => String(row.method ?? '').trim() !== '')
    .map((row) => ({ method: String(row.method), amount: Number(row.amount ?? 0) }))
    .filter((row) => row.amount > 0.0001)

  const items: ReceiptLineItem[] = []
  let packageCovered = 0
  let discountTotal = 0
  let itemsSubtotal = 0

  const pendingByContext = new Map<string, ReceiptAddonLine[]>()

  for (const line of lines) {
    const lineType = String(line.line_type ?? 'product')
    const name = String(line.name ?? 'Line item')
    const cn = line.cn_name ?? null
    const qty = Number(line.qty ?? 1)
    const net = Number(line.net_amount ?? 0)
    const gross = Number(line.gross_amount ?? net)
    const discount = Number(line.discount_amount ?? 0)
    if (discount > 0) discountTotal += discount

    if (lineType === 'booking_addon') {
      const context = String(line.addon_service_context ?? '').trim()
      const addonAmount = line.package_applied ? gross : (net > 0 ? net : gross)
      itemsSubtotal += addonAmount
      if (line.package_applied) packageCovered += Number(line.gross_amount ?? net) || 0
      const addon: ReceiptAddonLine = {
        name,
        cn_name: cn,
        qty,
        amount: addonAmount,
        package_claim: line.package_applied ? (String(line.package_name ?? '').trim() || '') : undefined,
      }
      if (context) {
        const list = pendingByContext.get(context) ?? []
        list.push(addon)
        pendingByContext.set(context, list)
      } else {
        const lastService = [...items].reverse().find((item) => item.section === 'service')
        if (lastService) {
          lastService.addons = [...(lastService.addons ?? []), addon]
        } else {
          items.push({
            section: 'service',
            name,
            cn_name: cn,
            qty,
            amount: addonAmount,
            package_claim: line.package_applied ? (String(line.package_name ?? '').trim() || '') : undefined,
          })
        }
      }
      continue
    }

    if (lineType === 'product') {
      itemsSubtotal += net
      items.push({ section: 'product', name, cn_name: cn, qty, amount: net })
      continue
    }

    if (lineType === 'service_package') {
      itemsSubtotal += net
      items.push({ section: 'package', name, cn_name: cn, qty, amount: net })
      continue
    }

    const children = (line.children ?? []).map((child) => {
      const childAmount = Number(child.net_amount ?? child.amount ?? 0) || null
      if (childAmount != null) itemsSubtotal += childAmount
      return {
        name: String(child.name ?? 'Option'),
        cn_name: child.cn_name ?? null,
        qty: 1,
        amount: childAmount,
      }
    })

    const addonsFromContext = pendingByContext.get(name) ?? []
    if (addonsFromContext.length) pendingByContext.delete(name)

    const displayAmount = line.package_applied ? (Number(line.gross_amount ?? net) || 0) : net
    itemsSubtotal += displayAmount
    if (line.package_applied) packageCovered += Number(line.gross_amount ?? net) || 0

    items.push({
      section: 'service',
      name,
      cn_name: cn,
      qty,
      amount: displayAmount,
      stage:
        lineType === 'booking_deposit'
          ? 'deposit'
          : lineType === 'booking_settlement'
            ? 'settlement'
            : null,
      children: children.length ? children : undefined,
      addons: addonsFromContext.length ? addonsFromContext : undefined,
      package_claim: line.package_applied ? (String(line.package_name ?? '').trim() || '') : undefined,
    })
  }

  for (const [context, addons] of pendingByContext) {
    items.push({
      section: 'service',
      name: context || 'Add-on',
      qty: 1,
      amount: addons.reduce((sum, row) => sum + Number(row.amount ?? 0), 0),
      addons,
    })
  }

  const paymentTotal = payments.reduce((sum, row) => sum + Number(row.amount ?? 0), 0)
  const grandTotal = Number(order.grand_total ?? 0)

  return {
    order_number: String(order.order_no ?? (input.orderId ? `Order #${input.orderId}` : '-')),
    date: order.order_datetime || order.created_at || undefined,
    payment_method: String(order.payment_method ?? 'unknown'),
    payments,
    customer_name: order.customer?.trim() || 'GUEST',
    customer_phone: order.customer_phone?.trim() || '-',
    total: grandTotal,
    subtotal: itemsSubtotal,
    discount: discountTotal > 0.0001 ? discountTotal : undefined,
    package_covered: packageCovered > 0.0001 ? packageCovered : undefined,
    paid_amount: paymentTotal > 0 ? paymentTotal : grandTotal,
    change_amount: 0,
    items,
    qr_url: order.receipt_public_url ?? null,
  }
}

function uint8ToBase64(bytes: Uint8Array): string {
  let binary = ''
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i])
  }
  return btoa(binary)
}
