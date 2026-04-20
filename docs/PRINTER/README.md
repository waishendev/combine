# Thermal Printer — POS Auto Print Receipt

## Overview

The POS checkout now supports **automatic receipt printing** via three connection methods:

| Mode       | Protocol                 | Where it runs              | Requires                  |
|------------|--------------------------|----------------------------|---------------------------|
| Bluetooth  | ESC/POS over BLE (GATT)  | Browser → Printer directly | Web Bluetooth API (Chrome) |
| WiFi       | ESC/POS over TCP (port 9100) | Next.js server → Printer | Printer on same network   |
| USB        | Browser `window.print()` | Browser iframe → OS driver | OS printer driver installed |

---

## Files Changed / Added

```
frontend/ecommerce_gentlegurl_crm/
├── src/
│   ├── utils/
│   │   └── printReceipt.ts              ← Reusable print helper (all 3 modes)
│   ├── app/
│   │   └── api/print/wifi/route.ts      ← Server-side TCP proxy for WiFi printing
│   └── components/
│       └── PosPageContent.tsx            ← Auto Print checkbox + mode UI
```

### `src/utils/printReceipt.ts`

Reusable module, can be imported from any page. Exports:

| Function                          | Description                                              |
|-----------------------------------|----------------------------------------------------------|
| `printReceipt(url)`               | USB mode — opens receipt URL in hidden iframe, triggers `window.print()` |
| `connectBluetoothPrinter()`       | Pairs + connects to a BLE thermal printer, returns device name |
| `disconnectBluetoothPrinter()`    | Disconnects BLE printer                                  |
| `isBluetoothPrinterConnected()`   | Returns `true` if BLE printer is still connected         |
| `getBluetoothPrinterName()`       | Returns connected printer name or `null`                 |
| `printReceiptBluetooth(data)`     | Sends ESC/POS receipt bytes to connected BLE printer     |
| `printReceiptWifi(ip, port, data)` | Sends ESC/POS receipt via server-side TCP proxy          |
| `testWifiPrinterConnection(ip, port)` | Sends a test receipt to verify WiFi printer is reachable |

### `src/app/api/print/wifi/route.ts`

Next.js API route — **POST** `/api/print/wifi`

```json
{
  "ip": "192.168.1.100",
  "port": 9100,
  "data": "<base64 encoded ESC/POS bytes>"
}
```

Opens a raw TCP socket from the Node.js server to the printer IP, writes the bytes, then closes. Timeout: 5 seconds.

### `PosPageContent.tsx`

Added in the **Checkout Confirmation** panel:

- `[x] Auto Print Receipt` checkbox (default: unchecked)
- When checked, shows **Print via** toggle: `Bluetooth` | `WiFi` | `USB`
- Bluetooth: Connect/Disconnect button with live status
- WiFi: IP + Port inputs with Test Print button
- USB: No extra config needed

---

## How to Configure Each Mode

### Bluetooth

**Requirements:**
- Browser that supports Web Bluetooth (Chrome / Edge on desktop or Android)
- Thermal printer with BLE support (most portable 58mm/80mm printers)
- Printer must be powered on and in pairing mode

**Steps:**
1. In POS checkout, check **Auto Print Receipt**
2. Select **Bluetooth**
3. Click **Connect Bluetooth Printer**
4. Browser will show a device picker — select your printer
5. Wait for "Connected: [printer name]" green indicator
6. Done. Every successful checkout will auto-print a receipt

**Supported BLE service UUIDs** (auto-detected):
```
e7810a71-73ae-499d-8c15-faa9aef0c3f2
000018f0-0000-1000-8000-00805f9b34fb
49535343-fe7d-4ae5-8fa9-9fafd205e455
0000ff00-0000-1000-8000-00805f9b34fb
0000fee7-0000-1000-8000-00805f9b34fb
```

**Troubleshooting Bluetooth:**
- If the picker shows no devices → ensure printer is on + discoverable
- "No writable characteristic found" → printer uses an unsupported BLE service UUID — see Customisation section
- Print is garbled → printer may use a different column width (default is 32 cols for 58mm paper) — see Customisation section
- Safari/Firefox do NOT support Web Bluetooth — use Chrome or Edge

### WiFi

**Requirements:**
- Thermal printer connected to the **same network** as the Next.js server
- Printer supports RAW TCP printing on port 9100 (virtually all network thermal printers do)
- The Next.js server (not the browser) makes the TCP connection

**Steps:**
1. Connect the thermal printer to WiFi (refer to printer manual — usually via AP setup or WPS)
2. Find the printer's IP address:
   - Check your router's DHCP client list
   - Or print a self-test page on the printer (usually hold feed button while powering on)
3. In POS checkout, check **Auto Print Receipt**
4. Select **WiFi**
5. Enter the printer IP (e.g. `192.168.1.100`) and port (default `9100`)
6. Click **Test Print** — a test receipt should print
7. If test succeeds, you're ready. Every successful checkout will auto-print

**Troubleshooting WiFi:**
- "Connection timed out" → wrong IP, printer off, or firewall blocking port 9100
- "Connection refused" → printer doesn't listen on that port (try 9100 or check manual)
- Test works but auto-print doesn't → check browser console for errors
- Assign a **static IP** to the printer via router DHCP reservation so the IP doesn't change

### USB

**Requirements:**
- Thermal printer connected via USB to the computer running the browser
- Printer driver installed in the OS and set as the default printer (or selected during print dialog)

**Steps:**
1. Install the printer driver from the manufacturer
2. Set the printer as the default printer in OS settings
3. In POS checkout, check **Auto Print Receipt**
4. Select **USB**
5. On checkout, the browser will open a print dialog with the receipt page

**Note:** USB mode uses the backend `receipt_public_url` HTML page, so the receipt format is controlled by the backend. Bluetooth and WiFi modes use the ESC/POS receipt format built in the frontend.

---

## ESC/POS Receipt Format

Bluetooth and WiFi modes generate ESC/POS binary commands. The receipt layout (32 columns for 58mm paper):

```
================================
           RECEIPT
================================
Order: ORD-20250420-0001
Date:  4/20/2025 14:30
Pay:   CASH
--------------------------------
Product ABC          x2    50.00
Service XYZ          x1    30.00
Booking #BK-001      x1    45.00
--------------------------------
TOTAL                 RM  125.00
Paid                  RM  150.00
Change                RM   25.00
================================
          Thank you!
================================
(feed 4 lines + auto cut)
```

**ESC/POS commands used:**

| Command            | Hex                 | Purpose                    |
|--------------------|---------------------|----------------------------|
| Initialize         | `1B 40`             | Reset printer              |
| Center align       | `1B 61 01`          | Center text                |
| Left align         | `1B 61 00`          | Left align text            |
| Bold on            | `1B 45 01`          | Bold text                  |
| Bold off           | `1B 45 00`          | Normal weight              |
| Double size        | `1B 21 30`          | Double height + width      |
| Normal size        | `1B 21 00`          | Normal size                |
| Feed + Cut         | `1B 64 04 1D 56 00` | Feed 4 lines then cut      |

---

## Customisation

### Change paper width (column count)

Edit `src/utils/printReceipt.ts`, line with:
```typescript
const COLS = 32 // 58 mm paper
```
Change to `48` for 80mm paper, or `42` for 72mm paper.

### Add more BLE service UUIDs

If your Bluetooth printer uses a service UUID not in the list, add it to the `PRINTER_SERVICE_UUIDS` array in `src/utils/printReceipt.ts`:
```typescript
const PRINTER_SERVICE_UUIDS = [
  'e7810a71-73ae-499d-8c15-faa9aef0c3f2',
  // ... existing UUIDs
  'your-new-uuid-here',
]
```
You can find the UUID using a BLE scanner app (e.g. "nRF Connect" on Android/iOS).

### Change WiFi TCP port

Default is `9100` (standard RAW printing port). Some printers use `9200` or other ports. The port is configurable in the UI input field, or you can change the default in `PosPageContent.tsx`:
```typescript
const [wifiPrinterPort, setWifiPrinterPort] = useState('9100')
```

### Change WiFi TCP timeout

Edit `src/app/api/print/wifi/route.ts`, the `setTimeout` value (default 5000ms):
```typescript
const timeout = setTimeout(() => {
  socket.destroy()
  reject(new Error(`Connection to ${ip}:${port} timed out (5s).`))
}, 5000) // ← change this
```

### Customise receipt content

The receipt is built in `buildReceiptBytes()` in `src/utils/printReceipt.ts`. Modify that function to:
- Add store name / logo
- Change currency from `RM` to something else
- Add extra footer text
- Add QR code (if printer supports ESC/POS QR commands)

---

## Reusing the Print Helper in Other Pages

The module is designed to be imported anywhere:

```typescript
import {
  printReceipt,                  // USB
  printReceiptBluetooth,         // Bluetooth
  printReceiptWifi,              // WiFi
  connectBluetoothPrinter,
  disconnectBluetoothPrinter,
  isBluetoothPrinterConnected,
  testWifiPrinterConnection,
  type ReceiptData,
  type ReceiptLineItem,
} from '@/utils/printReceipt'

// Example: WiFi print from any page
await printReceiptWifi('192.168.1.100', 9100, {
  order_number: 'ORD-123',
  payment_method: 'cash',
  total: 50.00,
  paid_amount: 50.00,
  change_amount: 0,
  items: [
    { name: 'Product A', qty: 2, amount: 50.00 },
  ],
})
```

---

## Testing Checklist

When the new printer arrives, test the following:

### Bluetooth
- [ ] Chrome shows the BLE device picker when clicking "Connect Bluetooth Printer"
- [ ] Printer appears in the picker and pairs successfully
- [ ] Green "Connected: [name]" status shows after pairing
- [ ] "Disconnect" button works and status resets
- [ ] After checkout with auto-print ON + Bluetooth, receipt prints automatically
- [ ] Receipt content is correct (order number, items, total, change)
- [ ] Text alignment and formatting looks correct on paper
- [ ] Printer auto-cuts paper after printing
- [ ] If printer is turned off mid-session, disconnection is detected

### WiFi
- [ ] Entering printer IP + port and clicking "Test Print" sends a test receipt
- [ ] Green "Printer reachable" status appears after successful test
- [ ] Red error appears if IP is wrong or printer is off
- [ ] After checkout with auto-print ON + WiFi, receipt prints automatically
- [ ] Receipt content matches Bluetooth output

### USB
- [ ] After checkout with auto-print ON + USB, browser print dialog appears
- [ ] Receipt HTML page loads correctly in the print dialog
- [ ] Printer prints the receipt from the browser

### General
- [ ] Auto Print checkbox persists across multiple checkouts in same session
- [ ] Print mode selection (BT/WiFi/USB) persists across checkouts
- [ ] Unchecking Auto Print stops all auto-printing
- [ ] When auto-print fails, a toast error appears but checkout still succeeds
- [ ] Switching between print modes works without errors
