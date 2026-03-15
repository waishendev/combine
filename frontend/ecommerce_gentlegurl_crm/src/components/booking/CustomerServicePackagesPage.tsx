'use client'

import { useEffect, useState } from 'react'
import { useI18n } from '@/lib/i18n'
import TableLoadingRow from '../TableLoadingRow'
import TableEmptyState from '../TableEmptyState'

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
  const { t } = useI18n()
  const [customerId, setCustomerId] = useState('')
  const [customerOptions, setCustomerOptions] = useState<CustomerOption[]>([])
  const [loading, setLoading] = useState(false)
  const [loadingCustomers, setLoadingCustomers] = useState(true)
  const [message, setMessage] = useState<string | null>(null)
  const [packages, setPackages] = useState<CustomerPackage[]>([])
  const [balances, setBalances] = useState<CustomerPackageBalance[]>([])
  const [usages, setUsages] = useState<CustomerPackageUsage[]>([])

  const formatDate = (dateString: string | null | undefined) => {
    if (!dateString) return '-'
    try {
      const date = new Date(dateString)
      return date.toLocaleString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    } catch {
      return dateString
    }
  }

  const getStatusBadge = (status: string) => {
    const statusLower = status.toLowerCase()
    if (statusLower.includes('active') || statusLower.includes('valid')) {
      return 'bg-green-100 text-green-800'
    }
    if (statusLower.includes('expired') || statusLower.includes('inactive')) {
      return 'bg-red-100 text-red-800'
    }
    if (statusLower.includes('pending')) {
      return 'bg-yellow-100 text-yellow-800'
    }
    return 'bg-gray-100 text-gray-800'
  }

  const loadCustomers = async () => {
    setLoadingCustomers(true)
    try {
      const res = await fetch('/api/proxy/customers?per_page=100', { cache: 'no-store' })
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
    } catch (error) {
      console.error('Failed to load customers:', error)
    } finally {
      setLoadingCustomers(false)
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
    } catch (error) {
      console.error('Failed to load data:', error)
      setMessage('Failed to load customer service package data.')
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

  const selectedCustomer = customerOptions.find((c) => String(c.id) === customerId)

  return (
    <div className="space-y-6">
      {/* Customer Selector Card */}
      <div className="rounded-xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-lg font-semibold text-slate-900">Select Customer</h3>
            <p className="mt-1 text-sm text-slate-500">View service packages, balances and usage logs by customer</p>
          </div>
        </div>
        <div className="flex flex-wrap items-end gap-4">
          <div className="flex-1 min-w-[300px]">
            <label className="mb-2 block text-sm font-medium text-slate-700">
              Customer
            </label>
            <div className="relative">
              <i className="fa-solid fa-user absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <select
                className="w-full rounded-lg border border-slate-300 bg-white pl-10 pr-4 py-2.5 text-sm text-slate-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-colors disabled:opacity-50"
                value={customerId}
                onChange={(e) => setCustomerId(e.target.value)}
                disabled={loadingCustomers}
              >
                <option value="">Select Customer</option>
                {customerOptions.map((customer) => (
                  <option key={customer.id} value={customer.id}>
                    {customer.name} {customer.phone ? `(${customer.phone})` : customer.email ? `(${customer.email})` : `(#${customer.id})`}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <button
            className="flex items-center gap-2 rounded-lg bg-blue-500 px-5 py-2.5 text-sm font-medium text-white shadow-sm transition-all hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
            onClick={() => void load()}
            disabled={loading || !customerId}
            type="button"
          >
            {loading ? (
              <>
                <i className="fa-solid fa-spinner fa-spin" />
                <span>Loading...</span>
              </>
            ) : (
              <>
                <i className="fa-solid fa-rotate-right" />
                <span>Refresh</span>
              </>
            )}
          </button>
        </div>
        {message && (
          <div className="mt-4 rounded-lg bg-red-50 border border-red-200 px-4 py-3">
            <p className="text-sm text-red-700">{message}</p>
          </div>
        )}
        {selectedCustomer && (
          <div className="mt-4 rounded-lg bg-blue-50 border border-blue-200 px-4 py-3">
            <div className="flex items-center gap-2">
              <i className="fa-solid fa-user-circle text-blue-600" />
              <div>
                <p className="text-sm font-medium text-blue-900">{selectedCustomer.name}</p>
                {selectedCustomer.phone && (
                  <p className="text-xs text-blue-700">Phone: {selectedCustomer.phone}</p>
                )}
                {selectedCustomer.email && (
                  <p className="text-xs text-blue-700">Email: {selectedCustomer.email}</p>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Owned Packages Table */}
      <div className="rounded-xl bg-white shadow-sm ring-1 ring-slate-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200">
          <div className="flex items-center gap-2">
            <i className="fa-solid fa-box text-slate-600" />
            <h4 className="text-lg font-semibold text-slate-900">Owned Packages</h4>
            {packages.length > 0 && (
              <span className="ml-2 inline-flex items-center rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-medium text-blue-800">
                {packages.length}
              </span>
            )}
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-700">
                  Package Name
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-700">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-700">
                  Started At
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-700">
                  Expires At
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 bg-white">
              {loading ? (
                <TableLoadingRow colSpan={4} />
              ) : packages.length === 0 ? (
                <TableEmptyState colSpan={4} />
              ) : (
                packages.map((pkg) => (
                  <tr key={pkg.id} className="transition-colors hover:bg-slate-50/50">
                    <td className="whitespace-nowrap px-6 py-4 text-sm font-medium text-slate-900">
                      {pkg.service_package?.name ?? `Package #${pkg.service_package?.id ?? pkg.id}`}
                    </td>
                    <td className="whitespace-nowrap px-6 py-4 text-sm">
                      <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${getStatusBadge(pkg.status)}`}>
                        {pkg.status}
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-6 py-4 text-sm text-slate-600">
                      {formatDate(pkg.started_at)}
                    </td>
                    <td className="whitespace-nowrap px-6 py-4 text-sm text-slate-600">
                      {formatDate(pkg.expires_at)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Balances Table */}
      <div className="rounded-xl bg-white shadow-sm ring-1 ring-slate-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200">
          <div className="flex items-center gap-2">
            <i className="fa-solid fa-wallet text-slate-600" />
            <h4 className="text-lg font-semibold text-slate-900">Balances</h4>
            {balances.length > 0 && (
              <span className="ml-2 inline-flex items-center rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-800">
                {balances.length}
              </span>
            )}
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-700">
                  Service Name
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-700">
                  Total Quantity
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-700">
                  Used
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-700">
                  Remaining
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 bg-white">
              {loading ? (
                <TableLoadingRow colSpan={4} />
              ) : balances.length === 0 ? (
                <TableEmptyState colSpan={4} />
              ) : (
                balances.map((bal) => {
                  const usagePercent = bal.total_qty > 0 ? (bal.used_qty / bal.total_qty) * 100 : 0
                  return (
                    <tr key={bal.id} className="transition-colors hover:bg-slate-50/50">
                      <td className="whitespace-nowrap px-6 py-4 text-sm font-medium text-slate-900">
                        {bal.booking_service?.name ?? `Service #${bal.booking_service_id}`}
                      </td>
                      <td className="whitespace-nowrap px-6 py-4 text-sm text-slate-600">
                        <span className="inline-flex items-center rounded-md bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700">
                          {bal.total_qty}
                        </span>
                      </td>
                      <td className="whitespace-nowrap px-6 py-4 text-sm text-slate-600">
                        <div className="flex items-center gap-2">
                          <span className="inline-flex items-center rounded-md bg-orange-100 px-2.5 py-1 text-xs font-medium text-orange-700">
                            {bal.used_qty}
                          </span>
                          <div className="w-16 bg-gray-200 rounded-full h-2">
                            <div
                              className="bg-orange-500 h-2 rounded-full transition-all"
                              style={{ width: `${Math.min(usagePercent, 100)}%` }}
                            />
                          </div>
                        </div>
                      </td>
                      <td className="whitespace-nowrap px-6 py-4 text-sm">
                        <span className={`inline-flex items-center rounded-md px-2.5 py-1 text-xs font-medium ${
                          bal.remaining_qty > 0
                            ? 'bg-green-100 text-green-700'
                            : 'bg-red-100 text-red-700'
                        }`}>
                          {bal.remaining_qty}
                        </span>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Usage Logs Table */}
      <div className="rounded-xl bg-white shadow-sm ring-1 ring-slate-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200">
          <div className="flex items-center gap-2">
            <i className="fa-solid fa-clock-rotate-left text-slate-600" />
            <h4 className="text-lg font-semibold text-slate-900">Usage Logs</h4>
            {usages.length > 0 && (
              <span className="ml-2 inline-flex items-center rounded-full bg-purple-100 px-2.5 py-0.5 text-xs font-medium text-purple-800">
                {usages.length}
              </span>
            )}
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-700">
                  Service Name
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-700">
                  Quantity Used
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-700">
                  Used From
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-700">
                  Created At
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 bg-white">
              {loading ? (
                <TableLoadingRow colSpan={4} />
              ) : usages.length === 0 ? (
                <TableEmptyState colSpan={4} />
              ) : (
                usages.map((usage) => (
                  <tr key={usage.id} className="transition-colors hover:bg-slate-50/50">
                    <td className="whitespace-nowrap px-6 py-4 text-sm font-medium text-slate-900">
                      {usage.booking_service?.name ?? `Service #${usage.booking_service_id}`}
                    </td>
                    <td className="whitespace-nowrap px-6 py-4 text-sm">
                      <span className="inline-flex items-center rounded-md bg-blue-100 px-2.5 py-1 text-xs font-medium text-blue-700">
                        <i className="fa-solid fa-minus-circle mr-1" />
                        {usage.used_qty}
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-6 py-4 text-sm text-slate-600">
                      {usage.used_from}
                    </td>
                    <td className="whitespace-nowrap px-6 py-4 text-sm text-slate-600">
                      {formatDate(usage.created_at)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
