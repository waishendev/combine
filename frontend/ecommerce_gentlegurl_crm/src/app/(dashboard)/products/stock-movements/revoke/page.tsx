export const dynamic = 'force-dynamic'

import Link from 'next/link'
import { redirect } from 'next/navigation'

import ProductStockMovementLogsPage from '@/components/ProductStockMovementLogsPage'
import { getCurrentUser } from '@/lib/auth'

export default async function ProductsStockMovementRevokePage() {
  const user = await getCurrentUser()

  if (!user) {
    redirect('/login')
  }

  const hasPermission = user.permissions.some((perm) => perm === 'ecommerce.stock-movements-logs.view')
  if (!hasPermission) {
    redirect('/dashboard')
  }

  return (
    <div className="overflow-y-auto py-6 px-10">
      <div className="text-xs mb-4">
        <span className="text-gray-500">Catalog</span>
        <span className="mx-1">/</span>
        <Link href="/product" className="text-blue-600 hover:underline">Products</Link>
        <span className="mx-1">/</span>
        <Link href="/products/stock-movements" className="text-blue-600 hover:underline">Stock Movements Logs</Link>
        <span className="mx-1">/</span>
        <span className="text-gray-700">Stock Movement Revoke</span>
      </div>

      <h2 className="text-3xl font-semibold mb-2">Stock Movement Revoke</h2>
      <p className="mb-6 max-w-3xl text-sm text-gray-600">
        Correct wrong manual stock movements by creating reversal records while keeping the original audit log intact.
      </p>
      <ProductStockMovementLogsPage basePath="/products/stock-movements/revoke" workflow="revoke" />
    </div>
  )
}
