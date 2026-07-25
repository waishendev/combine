'use client'

import { useEffect, useMemo, useState } from 'react'
import { defaultThermalPrinterSettings, getThermalPrinterAvailability, getThermalPrinterSettings, type ThermalPrinterSettings } from '@/lib/thermalPrinterSettings'
import { printThermalReceiptCopies, type ReceiptData } from '@/utils/printReceipt'

type ReceiptSharePanelProps = {
  orderId?: number
  receiptPublicUrl: string
  defaultEmail?: string | null
  compact?: boolean
  thermalReceipt?: ReceiptData
}

export default function ReceiptSharePanel({
  orderId,
  receiptPublicUrl,
  defaultEmail = '',
  compact = false,
  thermalReceipt,
}: ReceiptSharePanelProps) {
  const [receiptEmail, setReceiptEmail] = useState(defaultEmail?.trim() ?? '')
  const [receiptEmailError, setReceiptEmailError] = useState<string | null>(null)
  const [sendingReceiptEmail, setSendingReceiptEmail] = useState(false)
  const [receiptCooldownUntil, setReceiptCooldownUntil] = useState(0)
  const [receiptQrLoaded, setReceiptQrLoaded] = useState(false)
  const [qrCodeFullscreen, setQrCodeFullscreen] = useState(false)
  const [sendSuccess, setSendSuccess] = useState(false)
  const [printerSettings, setPrinterSettings] = useState<ThermalPrinterSettings>(defaultThermalPrinterSettings)
  const [printerLoading, setPrinterLoading] = useState(Boolean(thermalReceipt))
  const [printerLoadError, setPrinterLoadError] = useState<string | null>(null)
  const [printing, setPrinting] = useState(false)
  const [printToast, setPrintToast] = useState<{ tone: 'success' | 'error'; text: string } | null>(null)

  useEffect(() => {
    setReceiptEmail(defaultEmail?.trim() ?? '')
    setReceiptEmailError(null)
    setSendSuccess(false)
    setReceiptQrLoaded(false)
  }, [defaultEmail, orderId, receiptPublicUrl])

  useEffect(() => {
    if (!thermalReceipt) return
    let active = true
    setPrinterLoading(true)
    setPrinterLoadError(null)
    getThermalPrinterSettings()
      .then((settings) => { if (active) setPrinterSettings(settings) })
      .catch((error) => {
        if (active) setPrinterLoadError(error instanceof Error ? error.message : 'Printer settings are unavailable.')
      })
      .finally(() => { if (active) setPrinterLoading(false) })
    return () => { active = false }
  }, [thermalReceipt, orderId])

  useEffect(() => {
    if (!printToast) return
    const timer = window.setTimeout(() => setPrintToast(null), 4000)
    return () => window.clearTimeout(timer)
  }, [printToast])

  const printReceipt = async () => {
    if (!thermalReceipt || printing) return
    setPrinting(true)
    setPrintToast(null)
    try {
      await printThermalReceiptCopies(printerSettings, thermalReceipt)
      setPrintToast({ tone: 'success', text: 'Receipt sent to printer.' })
    } catch (error) {
      setPrintToast({ tone: 'error', text: error instanceof Error ? error.message : 'Unable to print receipt.' })
    } finally {
      setPrinting(false)
    }
  }

  const receiptQrImageUrl = useMemo(
    () => `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(receiptPublicUrl)}`,
    [receiptPublicUrl],
  )

  const receiptQrFullscreenImageUrl = useMemo(
    () => `https://api.qrserver.com/v1/create-qr-code/?size=400x400&data=${encodeURIComponent(receiptPublicUrl)}`,
    [receiptPublicUrl],
  )

  const receiptCooldownActive = receiptCooldownUntil > Date.now()
  const printerAvailability = getThermalPrinterAvailability(printerSettings)
  const printDisabled = printerLoading || printing || Boolean(printerLoadError) || !printerAvailability.available
  const printerUnavailableMessage = printerLoadError
    ?? (printerLoading ? 'Loading printer settings…' : printerAvailability.available ? null : printerAvailability.label)

  useEffect(() => {
    if (!receiptCooldownUntil) return
    const remaining = receiptCooldownUntil - Date.now()
    if (remaining <= 0) return
    const timer = window.setTimeout(() => setReceiptCooldownUntil(0), remaining)
    return () => window.clearTimeout(timer)
  }, [receiptCooldownUntil])

  const sendReceiptToEmail = async () => {
    if (!orderId) return
    const normalizedEmail = receiptEmail.trim()
    if (!normalizedEmail) {
      setReceiptEmailError('Email is required.')
      return
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
      setReceiptEmailError('Please enter a valid email.')
      return
    }

    setSendingReceiptEmail(true)
    setReceiptEmailError(null)
    setSendSuccess(false)

    try {
      const res = await fetch(`/api/proxy/orders/${orderId}/send-receipt-email`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: normalizedEmail }),
      })
      const json = await res.json().catch(() => null)
      if (!res.ok) {
        setReceiptEmailError(typeof json?.message === 'string' ? json.message : 'Unable to send receipt email.')
        return
      }
      setReceiptCooldownUntil(Date.now() + 10_000)
      setSendSuccess(true)
    } catch {
      setReceiptEmailError('Unable to send receipt email.')
    } finally {
      setSendingReceiptEmail(false)
    }
  }

  return (
    <>
      <section className={`rounded-xl border border-slate-200 bg-white ${compact ? 'border-0 p-0' : 'p-4'} space-y-3`}>
        {!compact ? (
          <div>
            <h4 className="text-sm font-bold text-slate-900">Customer receipt</h4>
            <p className="mt-0.5 text-xs text-slate-500">
              Share a scannable QR or email the receipt if the customer asks for it later.
            </p>
          </div>
        ) : null}

        <div className="text-center">
          <p className="mb-2 text-sm font-semibold text-slate-700">Scan QR code to view receipt</p>
          <button
            type="button"
            className="relative mx-auto flex cursor-pointer justify-center rounded-xl border-2 border-slate-200 bg-white p-3 transition-all hover:border-blue-400 hover:shadow-md"
            onClick={() => setQrCodeFullscreen(true)}
            title="Click to enlarge QR code"
          >
            {!receiptQrLoaded ? <div className="h-40 w-40 animate-pulse rounded-lg bg-slate-100" /> : null}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={receiptQrImageUrl}
              onLoad={() => setReceiptQrLoaded(true)}
              onError={() => setReceiptQrLoaded(true)}
              alt="Receipt QR Code"
              className={`h-40 w-40 ${receiptQrLoaded ? 'block' : 'hidden'}`}
            />
          </button>
          <p className="mt-1.5 text-xs text-slate-500">Tap QR code to enlarge for customer scanning</p>
        </div>

        <div className="space-y-2 rounded-xl border border-slate-200 bg-slate-50 p-3">
          <p className="text-sm font-semibold text-slate-700">Send receipt to email</p>
          {orderId ? (
          <>
          <div className="flex flex-col gap-2 sm:flex-row">
            <input
              type="email"
              value={receiptEmail}
              onChange={(event) => {
                setReceiptEmail(event.target.value)
                if (receiptEmailError) setReceiptEmailError(null)
                if (sendSuccess) setSendSuccess(false)
              }}
              placeholder="customer@email.com"
              className="h-10 flex-1 rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-800 outline-none transition focus:border-blue-500"
            />
            <button
              type="button"
              onClick={() => void sendReceiptToEmail()}
              disabled={sendingReceiptEmail || receiptCooldownActive}
              className="h-10 rounded-lg bg-blue-600 px-4 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {sendingReceiptEmail ? 'Sending…' : receiptCooldownActive ? 'Send (wait…)' : 'Send'}
            </button>
          </div>
          {receiptEmailError ? <p className="text-xs font-medium text-red-600">{receiptEmailError}</p> : null}
          {sendSuccess ? <p className="text-xs font-medium text-emerald-700">Receipt sent successfully.</p> : null}
          </>
          ) : (
            <p className="text-xs text-slate-500">Email delivery is not available for this receipt.</p>
          )}
        </div>

        {thermalReceipt ? (
          <div className="space-y-2">
            <button
              type="button"
              onClick={() => void printReceipt()}
              disabled={printDisabled}
              className="w-full rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {printing ? 'Printing…' : 'Print Receipt'}
            </button>
            {printerUnavailableMessage ? <p className="text-center text-xs font-medium text-amber-700">{printerUnavailableMessage}</p> : null}
            {!printerAvailability.available || printerLoadError ? <p className="text-center"><a href="/settings/thermal-printer" className="text-xs font-semibold text-blue-600 hover:underline">Manage Printer Settings</a></p> : null}
          </div>
        ) : null}

        <button type="button" onClick={() => window.open(receiptPublicUrl, '_blank')} className="w-full rounded-xl border-2 border-blue-500 bg-blue-50 px-4 py-2.5 text-sm font-semibold text-blue-700 transition-all hover:bg-blue-100">Open receipt</button>
      </section>

      {printToast ? (
        <div className={`fixed bottom-5 right-5 z-[90] max-w-sm rounded-xl border px-4 py-3 text-sm font-semibold shadow-xl ${printToast.tone === 'success' ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-red-200 bg-red-50 text-red-700'}`} role="status">
          {printToast.text}
        </div>
      ) : null}

      {qrCodeFullscreen ? (
        <div
          className="fixed inset-0 z-[70] flex items-center justify-center overflow-y-auto bg-black/90 p-4 backdrop-blur-sm"
          onClick={() => setQrCodeFullscreen(false)}
        >
          <div className="relative" onClick={(event) => event.stopPropagation()}>
            <div className="rounded-2xl bg-white p-8 shadow-2xl">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={receiptQrFullscreenImageUrl} alt="Receipt QR Code - Fullscreen" className="h-80 w-80" />
              <p className="mt-4 text-center text-sm font-medium text-slate-600">Customer can scan to view receipt</p>
            </div>
            <button
              type="button"
              onClick={() => setQrCodeFullscreen(false)}
              className="absolute -right-2 -top-2 rounded-full bg-white p-2 text-slate-600 shadow-lg hover:bg-slate-100"
              aria-label="Close"
            >
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
      ) : null}
    </>
  )
}
