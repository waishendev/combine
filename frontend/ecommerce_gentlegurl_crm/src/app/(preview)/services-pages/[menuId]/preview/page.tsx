export const dynamic = 'force-dynamic'

import { redirect } from 'next/navigation'

import PreviewClient from './PreviewClient'
import { getCurrentUser } from '@/lib/auth'

export default async function ServicesPagePreviewPage({
  params,
}: {
  params: Promise<{ menuId: string }>
}) {
  const user = await getCurrentUser()

  if (!user) {
    redirect('/login')
  }

  const hasPermission = user.permissions.some(
    (perm) => perm === 'ecommerce.services-pages.view',
  )

  if (!hasPermission) {
    redirect('/dashboard')
  }

  const { menuId } = await params
  const numericMenuId = Number(menuId)
  if (!Number.isFinite(numericMenuId)) {
    redirect('/services-pages')
  }

  return <PreviewClient menuId={numericMenuId} />
}
