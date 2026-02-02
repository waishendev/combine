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
          max-width: 390px;
          border-radius: 32px;
          border: 2px solid rgba(226, 232, 240, 0.6);
          box-shadow: 0 25px 50px -12px rgba(15, 23, 42, 0.35);
          background: rgba(248, 250, 252, 0.9);
          padding-top: 40px;
          overflow: visible !important;
        }

        .mobile-preview-container > * {
          position: relative;
          z-index: 1;
        }

        .mobile-preview-container::before {
          content: '9:41';
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          height: 40px;
          padding: 0 16px;
          display: flex;
          align-items: center;
          font-size: 11px;
          font-weight: 600;
          color: #334155;
          background: linear-gradient(#cbd5e1, #cbd5e1) right 48px center / 12px 8px
              no-repeat,
            linear-gradient(#cbd5e1, #cbd5e1) right 30px center / 12px 8px
              no-repeat,
            linear-gradient(#cbd5e1, #cbd5e1) right 10px center / 18px 8px
              no-repeat,
            rgba(255, 255, 255, 0.95);
          border-radius: 30px 30px 18px 18px;
          box-shadow: inset 0 -1px 0 rgba(148, 163, 184, 0.35);
          pointer-events: none;
        }

        .mobile-preview-container::after {
          content: '';
          position: absolute;
          top: 9px;
          left: 50%;
          width: 92px;
          height: 18px;
          transform: translateX(-50%);
          border-radius: 9999px;
          background: rgba(15, 23, 42, 0.15);
          box-shadow: inset 0 0 0 1px rgba(15, 23, 42, 0.1);
          pointer-events: none;
        }
      `}</style>
    </>
  )
}
