'use client'

import { useEffect, useState } from 'react'

export type PosPaymentConfiguration = {
  store_location_id: number
  is_configured: boolean
  methods: Array<{ key: 'cash' | 'qrpay' | 'credit_card' | 'customer_balance'; name: string; is_enabled: boolean; sort_order: number }>
  allow_split_payment: boolean
  auto_calculate_split: boolean
}

export function usePosPaymentConfiguration(storeLocationId: number | null | undefined) {
  const [configuration, setConfiguration] = useState<PosPaymentConfiguration | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    const controller = new AbortController()
    setConfiguration(null)
    if (!storeLocationId) return () => controller.abort()
    setLoading(true)
    fetch(`/api/proxy/pos/payment-methods?store_location_id=${storeLocationId}`, { cache: 'no-store', signal: controller.signal })
      .then(async (response) => {
        const payload = await response.json()
        if (!response.ok) throw new Error(payload?.message || 'Unable to load POS payment methods.')
        setConfiguration(payload.data)
      })
      .catch((error) => { if (error?.name !== 'AbortError') setConfiguration(null) })
      .finally(() => { if (!controller.signal.aborted) setLoading(false) })
    return () => controller.abort()
  }, [storeLocationId])

  return { configuration, loading }
}
