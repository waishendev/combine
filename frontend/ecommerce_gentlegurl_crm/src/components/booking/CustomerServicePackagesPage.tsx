'use client'

import { useState } from 'react'

type CustomerPackage = {
  id: number
  service_package?: { id: number; name: string }
  status: string
  started_at?: string | null
  expires_at?: string | null
}

type CustomerPackageBalance = {
  id: number
  customer_service_package_id: number
  booking_service_id: number
  total_qty: number
  used_qty: number
  remaining_qty: number
  booking_service?: { id: number; name: string }
}

type CustomerPackageUsage = {
  id: number
  customer_service_package_id: number
  booking_service_id: number
  used_qty: number
  used_from: string
  created_at?: string
  booking_service?: { id: number; name: string }
}

export default function CustomerServicePackagesPage() {
  const [customerId, setCustomerId] = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [packages, setPackages] = useState<CustomerPackage[]>([])
  const [balances, setBalances] = useState<CustomerPackageBalance[]>([])
  const [usages, setUsages] = useState<CustomerPackageUsage[]>([])

  const load = async () => {
    if (!customerId.trim()) {
      setMessage('Please enter customer id.')
      return
    }
    setLoading(true)
    setMessage(null)
    try {
      const [pkgRes, balRes, usageRes] = await Promise.all([
        fetch(`/api/proxy/customers/${customerId}/service-packages`, { cache: 'no-store' }),
        fetch(`/api/proxy/customers/${customerId}/service-package-balances`, { cache: 'no-store' }),
        fetch(`/api/proxy/customers/${customerId}/service-package-usages`, { cache: 'no-store' }),
      ])

      if (!pkgRes.ok || !balRes.ok || !usageRes.ok) {
        setMessage('Unable to load customer service package data.')
        return
      }

      const pkgJson = await pkgRes.json().catch(() => ({}))
      const balJson = await balRes.json().catch(() => ({}))
      const usageJson = await usageRes.json().catch(() => ({}))

      setPackages(Array.isArray(pkgJson?.data) ? pkgJson.data : [])
      setBalances(Array.isArray(balJson?.data) ? balJson.data : [])
      setUsages(Array.isArray(usageJson?.data) ? usageJson.data : [])
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-gray-200 bg-white p-4">
        <h3 className="text-lg font-semibold">Customer Service Packages</h3>
        <p className="mt-1 text-sm text-gray-600">Inspect owned packages, balances and usage logs by customer id.</p>
        <div className="mt-3 flex flex-wrap gap-2">
          <input
            className="rounded border px-3 py-2"
            placeholder="Customer ID"
            value={customerId}
            onChange={(e) => setCustomerId(e.target.value)}
          />
          <button className="rounded bg-blue-600 px-4 py-2 text-white" onClick={() => void load()} disabled={loading}>
            {loading ? 'Loading...' : 'Load'}
          </button>
        </div>
        {message ? <p className="mt-2 text-sm text-red-600">{message}</p> : null}
      </div>

      <section className="rounded-xl border border-gray-200 bg-white p-4">
        <h4 className="font-semibold">Owned Packages</h4>
        <div className="mt-2 space-y-2 text-sm">
          {packages.length === 0 ? <p className="text-gray-500">No data.</p> : packages.map((pkg) => (
            <div key={pkg.id} className="rounded border p-2">
              <p>{pkg.service_package?.name ?? `Package #${pkg.service_package?.id ?? pkg.id}`}</p>
              <p className="text-xs text-gray-600">Status: {pkg.status} • Start: {pkg.started_at ?? '-'} • Expire: {pkg.expires_at ?? '-'}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-xl border border-gray-200 bg-white p-4">
        <h4 className="font-semibold">Balances</h4>
        <div className="mt-2 space-y-2 text-sm">
          {balances.length === 0 ? <p className="text-gray-500">No data.</p> : balances.map((bal) => (
            <div key={bal.id} className="rounded border p-2">
              <p>{bal.booking_service?.name ?? `Service #${bal.booking_service_id}`}</p>
              <p className="text-xs text-gray-600">Remaining {bal.remaining_qty} / Total {bal.total_qty} / Used {bal.used_qty}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-xl border border-gray-200 bg-white p-4">
        <h4 className="font-semibold">Usage Logs</h4>
        <div className="mt-2 space-y-2 text-sm">
          {usages.length === 0 ? <p className="text-gray-500">No data.</p> : usages.map((usage) => (
            <div key={usage.id} className="rounded border p-2">
              <p>{usage.booking_service?.name ?? `Service #${usage.booking_service_id}`} x{usage.used_qty}</p>
              <p className="text-xs text-gray-600">From: {usage.used_from} • At: {usage.created_at ?? '-'}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}
