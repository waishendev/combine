import { NextRequest, NextResponse } from 'next/server'
import net from 'net'

/**
 * POST /api/print/wifi
 *
 * Sends raw ESC/POS bytes to a WiFi thermal printer via TCP.
 *
 * Body: { ip: string, port?: number, data: string (base64) }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { ip, port = 9100, data } = body as {
      ip?: string
      port?: number
      data?: string
    }

    if (!ip || typeof ip !== 'string') {
      return NextResponse.json({ message: 'Missing or invalid "ip".' }, { status: 400 })
    }
    if (!data || typeof data !== 'string') {
      return NextResponse.json({ message: 'Missing or invalid "data" (base64).' }, { status: 400 })
    }

    const buffer = Buffer.from(data, 'base64')

    await sendToPrinter(ip, port, buffer)

    return NextResponse.json({ success: true })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ success: false, message }, { status: 500 })
  }
}

function sendToPrinter(ip: string, port: number, data: Buffer): Promise<void> {
  return new Promise((resolve, reject) => {
    const socket = new net.Socket()
    const timeout = setTimeout(() => {
      socket.destroy()
      reject(new Error(`Connection to ${ip}:${port} timed out (5s).`))
    }, 5000)

    socket.connect(port, ip, () => {
      socket.write(data, (err) => {
        clearTimeout(timeout)
        socket.end()
        if (err) reject(err)
        else resolve()
      })
    })

    socket.on('error', (err) => {
      clearTimeout(timeout)
      socket.destroy()
      reject(new Error(`Printer connection failed: ${err.message}`))
    })
  })
}
