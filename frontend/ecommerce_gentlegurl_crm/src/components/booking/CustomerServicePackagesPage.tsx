'use client'

import { useEffect, useState } from 'react'

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

type CustomerOption = {
  id: number
  name: string
  phone?: string | null
  email?: string | null
}

function parseRows<T>(payload: unknown): T[] {
  if (Array.isArray(payload)) return payload as T[]
  if (payload && typeof payload === 'object') {
    const maybe = payload as Record<string, unknown>
    if (Array.isArray(maybe.data)) return maybe.data as T[]
  }
  return []
}

export default function CustomerServicePackagesPage() {
  const [customerId, setCustomerId] = useState('')
  const [customerOptions, setCustomerOptions] = useState<CustomerOption[]>([])
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [packages, setPackages] = useState<CustomerPackage[]>([])
  const [balances, setBalances] = useState<CustomerPackageBalance[]>([])
  const [usages, setUsages] = useState<CustomerPackageUsage[]>([])

  const loadCustomers = async () => {
    const res = await fetch('/api/proxy/customers?per_page=50', { cache: 'no-store' })
    const json = await res.json().catch(() => ({}))
    const rows = parseRows<unknown>(json?.data)

    const mapped = rows
      .map((row): CustomerOption | null => {
        if (!row || typeof row !== 'object') return null
        const maybe = row as Record<string, unknown>
        const id = Number(maybe.id)
        if (!Number.isFinite(id) || id <= 0) return null
        return {
          id,
          name: String(maybe.name ?? `Customer #${id}`),
          phone: typeof maybe.phone === 'string' ? maybe.phone : null,
          email: typeof maybe.email === 'string' ? maybe.email : null,
        }
      })
      .filter((row): row is CustomerOption => Boolean(row))

    setCustomerOptions(mapped)
    if (!customerId && mapped.length > 0) {
      setCustomerId(String(mapped[0].id))
    }
  }

  const load = async (idArg?: string) => {
    const id = (idArg ?? customerId).trim()
    if (!id) {
      setMessage('Please select customer first.')
      return
    }

    setLoading(true)
    setMessage(null)
    try {
      const [pkgRes, balRes, usageRes] = await Promise.all([
        fetch(`/api/proxy/customers/${id}/service-packages`, { cache: 'no-store' }),
        fetch(`/api/proxy/customers/${id}/service-package-balances`, { cache: 'no-store' }),
        fetch(`/api/proxy/customers/${id}/service-package-usages`, { cache: 'no-store' }),
      ])

      if (!pkgRes.ok || !balRes.ok || !usageRes.ok) {
        setMessage('Unable to load customer service package data.')
        return
      }

      const pkgJson = await pkgRes.json().catch(() => ({}))
      const balJson = await balRes.json().catch(() => ({}))
      const usageJson = await usageRes.json().catch(() => ({}))

      setPackages(parseRows<CustomerPackage>(pkgJson?.data))
      setBalances(parseRows<CustomerPackageBalance>(balJson?.data))
      setUsages(parseRows<CustomerPackageUsage>(usageJson?.data))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadCustomers()
  }, [])

  useEffect(() => {
    if (customerId) {
      void load(customerId)
    }
  }, [customerId])

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-gray-200 bg-white p-4">
        <h3 className="text-lg font-semibold">Customer Service Packages</h3>
        <p className="mt-1 text-sm text-gray-600">Inspect owned packages, balances and usage logs by customer.</p>
        <div className="mt-3 flex flex-wrap gap-2">
          <select className="rounded border px-3 py-2" value={customerId} onChange={(e) => setCustomerId(e.target.value)}>
            <option value="">Select Customer</option>
            {customerOptions.map((customer) => (
              <option key={customer.id} value={customer.id}>
                {customer.name} ({customer.phone || customer.email || `#${customer.id}`})
              </option>
            ))}
          </select>
          <button className="rounded bg-blue-600 px-4 py-2 text-white" onClick={() => void load()} disabled={loading}>
            {loading ? 'Loading...' : 'Refresh'}
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
