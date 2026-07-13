'use client'

import { useCallback, useState } from 'react'

import DashboardPageLoading from '@/components/dashboard/DashboardPageLoading'
import EcommerceAnalyticsDashboard from '@/components/dashboard/EcommerceAnalyticsDashboard'
import PackageAnalyticsDashboard from '@/components/dashboard/PackageAnalyticsDashboard'

type DashboardAnalyticsContentProps = {
  canViewEcommerce: boolean
  canViewPackage: boolean
}

export default function DashboardAnalyticsContent({
  canViewEcommerce,
  canViewPackage,
}: DashboardAnalyticsContentProps) {
  const [ecommerceReady, setEcommerceReady] = useState(!canViewEcommerce)
  const [packageReady, setPackageReady] = useState(!canViewPackage)

  const onEcommerceReady = useCallback(() => setEcommerceReady(true), [])
  const onPackageReady = useCallback(() => setPackageReady(true), [])

  const isLoading = !ecommerceReady || !packageReady

  return (
    <div className="relative">
      {isLoading ? <DashboardPageLoading /> : null}
      <div className={isLoading ? 'hidden' : 'space-y-8'}>
        {canViewEcommerce ? <EcommerceAnalyticsDashboard onInitialLoad={onEcommerceReady} /> : null}
        {canViewPackage ? <PackageAnalyticsDashboard onInitialLoad={onPackageReady} /> : null}
      </div>
    </div>
  )
}
