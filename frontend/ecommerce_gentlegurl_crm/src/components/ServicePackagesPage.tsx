'use client'

import { useState } from 'react'

type PackageItem = {
  booking_service_id: number
  service_name?: string | null
  quantity: number
}

type ServicePackage = {
  id: number
  name: string
  description?: string | null
  is_active: boolean
  items: PackageItem[]
}

type AssignmentBalance = {
  booking_service_id: number
  service_name?: string | null
  total_quantity: number
  used_quantity: number
  remaining_quantity: number
}

type Assignment = {
  id: number
  package_name?: string | null
  assigned_at?: string | null
  balances: AssignmentBalance[]
}

export default function ServicePackagesPage() {
  const [rows, setRows] = useState<ServicePackage[]>([])
  const [loading, setLoading] = useState(false)

  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [itemsJson, setItemsJson] = useState('[{"booking_service_id":1,"quantity":1}]')

  const [customerId, setCustomerId] = useState('')
  const [assignPackageId, setAssignPackageId] = useState('')
  const [assignments, setAssignments] = useState<Assignment[]>([])

  const load = async () => {
    setLoading(true)
    const res = await fetch('/api/proxy/ecommerce/service-packages', { cache: 'no-store' })
    const json = await res.json()
    const data = json?.data?.data ?? json?.data ?? []
    setRows(Array.isArray(data) ? data : [])
    setLoading(false)
  }


  const onCreate = async () => {
    let parsedItems: PackageItem[] = []
    try {
      parsedItems = JSON.parse(itemsJson)
    } catch {
      window.alert('Items JSON is invalid')
      return
    }

    const res = await fetch('/api/proxy/ecommerce/service-packages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name,
        description,
        is_active: true,
        items: parsedItems,
      }),
    })

    if (!res.ok) {
      window.alert('Failed to create package')
      return
    }

    setName('')
    setDescription('')
    setItemsJson('[{"booking_service_id":1,"quantity":1}]')
    await load()
  }

  const onAssign = async () => {
    const cid = Number(customerId)
    const pid = Number(assignPackageId)
    if (!cid || !pid) {
      window.alert('Customer ID and package are required')
      return
    }

    const res = await fetch('/api/proxy/ecommerce/customer-service-packages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ customer_id: cid, service_package_id: pid }),
    })

    if (!res.ok) {
      window.alert('Failed to assign package')
      return
    }

    await loadAssignments(cid)
  }

  const loadAssignments = async (cidParam?: number) => {
    const cid = cidParam ?? Number(customerId)
    if (!cid) return

    const qs = new URLSearchParams({ customer_id: String(cid) })
    const res = await fetch(`/api/proxy/ecommerce/customer-service-packages?${qs.toString()}`, { cache: 'no-store' })
    const json = await res.json()
    setAssignments(Array.isArray(json?.data) ? json.data : [])
  }

  return (
    <div className="space-y-6">
      <div className="rounded-lg border p-4">
        <h3 className="mb-3 text-lg font-semibold">Create Service Package</h3>
        <div className="grid gap-3 md:grid-cols-2">
          <input className="rounded border px-3 py-2" placeholder="Package name" value={name} onChange={(e) => setName(e.target.value)} />
          <input className="rounded border px-3 py-2" placeholder="Description" value={description} onChange={(e) => setDescription(e.target.value)} />
          <textarea className="rounded border px-3 py-2 md:col-span-2" rows={4} value={itemsJson} onChange={(e) => setItemsJson(e.target.value)} />
        </div>
        <button type="button" className="mt-3 rounded bg-blue-600 px-4 py-2 text-white" onClick={() => void onCreate()}>Create Package</button>
      </div>

      <div className="rounded-lg border p-4">
        <h3 className="mb-3 text-lg font-semibold">Assign Package to Customer</h3>
        <div className="grid gap-3 md:grid-cols-3">
          <input className="rounded border px-3 py-2" placeholder="Customer ID" value={customerId} onChange={(e) => setCustomerId(e.target.value)} />
          <select className="rounded border px-3 py-2" value={assignPackageId} onChange={(e) => setAssignPackageId(e.target.value)}>
            <option value="">Select package</option>
            {rows.map((row) => <option key={row.id} value={row.id}>{row.name}</option>)}
          </select>
          <button type="button" className="rounded bg-emerald-600 px-4 py-2 text-white" onClick={() => void onAssign()}>Assign</button>
        </div>
        <button type="button" className="mt-3 rounded border px-4 py-2" onClick={() => void loadAssignments()}>Load Customer Balances</button>
      </div>

      <div className="rounded-lg border p-4">
        <h3 className="mb-3 text-lg font-semibold">Packages</h3>
        <button type="button" className="mb-3 rounded border px-3 py-1.5 text-sm" onClick={() => void load()}>Refresh Packages</button>
        {loading ? <p className="text-sm text-gray-500">Loading...</p> : (
          <div className="space-y-3">
            {rows.map((row) => (
              <div key={row.id} className="rounded border p-3">
                <p className="font-semibold">{row.name}</p>
                <p className="text-sm text-gray-600">{row.description || '-'}</p>
                <ul className="mt-2 list-disc pl-5 text-sm">
                  {row.items.map((item, idx) => <li key={`${row.id}_${idx}`}>{item.service_name || `Service #${item.booking_service_id}`} × {item.quantity}</li>)}
                </ul>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="rounded-lg border p-4">
        <h3 className="mb-3 text-lg font-semibold">Customer Package Balances</h3>
        <div className="space-y-3">
          {assignments.map((assignment) => (
            <div key={assignment.id} className="rounded border p-3">
              <p className="font-semibold">{assignment.package_name}</p>
              <p className="text-xs text-gray-500">Assigned at: {assignment.assigned_at || '-'}</p>
              <ul className="mt-2 list-disc pl-5 text-sm">
                {assignment.balances.map((balance, idx) => (
                  <li key={`${assignment.id}_${idx}`}>{balance.service_name || `Service #${balance.booking_service_id}`}: {balance.remaining_quantity} remaining ({balance.used_quantity}/{balance.total_quantity} used)</li>
                ))}
              </ul>
            </div>
          ))}
          {!assignments.length && <p className="text-sm text-gray-500">No assignments loaded.</p>}
        </div>
      </div>
    </div>
  )
}
