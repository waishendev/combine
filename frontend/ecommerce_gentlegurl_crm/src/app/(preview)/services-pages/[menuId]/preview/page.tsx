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

  return (
    <>
      <PreviewClient menuId={numericMenuId} />
      <style>{`
        .mobile-preview-container {
          position: relative;
          border-radius: 28px;
          border-color: rgba(15, 23, 42, 0.12);
          box-shadow: 0 30px 70px -45px rgba(15, 23, 42, 0.35), 0 18px 40px -30px rgba(15, 23, 42, 0.25);
          overflow: visible !important;
          background: rgba(255, 255, 255, 0.9);
        }

        .mobile-preview-container::before {
          content: '';
          position: absolute;
          inset: -12px;
          border-radius: 36px;
          border: 1px solid rgba(15, 23, 42, 0.1);
          box-shadow: 0 8px 28px rgba(15, 23, 42, 0.2);
          pointer-events: none;
        }

        .mobile-preview-container::after {
          content: '';
          position: absolute;
          top: 10px;
          left: 50%;
          width: 84px;
          height: 7px;
          transform: translateX(-50%);
          border-radius: 9999px;
          background: rgba(15, 23, 42, 0.12);
          pointer-events: none;
        }
      `}</style>
    </>
  )
}
