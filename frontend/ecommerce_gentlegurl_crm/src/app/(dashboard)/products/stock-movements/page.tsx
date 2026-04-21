export const dynamic = 'force-dynamic'

import Link from 'next/link'
import { redirect } from 'next/navigation'

import ProductStockMovementLogsPage from '@/components/ProductStockMovementLogsPage'
import { getCurrentUser } from '@/lib/auth'

export default async function ProductsStockMovementsPage() {
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
        <span className="text-gray-700">Stock Movements Logs</span>
      </div>

      <h2 className="text-3xl font-semibold mb-6">Stock Movements Logs</h2>
      <ProductStockMovementLogsPage />
    </div>
  )
}
