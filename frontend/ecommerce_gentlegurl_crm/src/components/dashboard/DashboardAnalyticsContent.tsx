'use client'

import { useCallback, useEffect, useState } from 'react'

import DashboardPageLoading from '@/components/dashboard/DashboardPageLoading'
import EcommerceAnalyticsDashboard, {
  type AnalyticsResponse,
  type CategoryOption,
} from '@/components/dashboard/EcommerceAnalyticsDashboard'
import PackageAnalyticsDashboard, {
  type FilterOptionsResponse,
  type LiabilityPage,
  type PackageSummary,
} from '@/components/dashboard/PackageAnalyticsDashboard'
import { useBranch } from '@/contexts/BranchContext'
import { apiFetch } from '@/lib/api'

type DashboardAnalyticsContentProps = {
  canViewEcommerce: boolean
  canViewPackage: boolean
}

type OverviewResponse = {
  meta?: {
    enhancement?: string
    includes?: string[]
  }
  ecommerce: AnalyticsResponse | null
  packages: {
    summary: PackageSummary
    filter_options: FilterOptionsResponse
    customer_packages: LiabilityPage
  } | null
  categories: CategoryOption[] | null
}

export default function DashboardAnalyticsContent({
  canViewEcommerce,
  canViewPackage,
}: DashboardAnalyticsContentProps) {
  const { selectedBranchId } = useBranch()
  const branchKey = selectedBranchId === null ? 'all' : String(selectedBranchId)
  const [overview, setOverview] = useState<OverviewResponse | null>(null)
  const [overviewError, setOverviewError] = useState<string | null>(null)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    let cancelled = false
    setReady(false)
    setOverview(null)
    setOverviewError(null)

    const params = new URLSearchParams({
      page: '1',
      per_page: '10',
      status: 'active',
      include: [
        canViewEcommerce ? 'ecommerce' : null,
        canViewEcommerce ? 'categories' : null,
        canViewPackage ? 'packages' : null,
      ]
        .filter(Boolean)
        .join(','),
    })
    if (selectedBranchId === null) params.set('branch_scope', 'all')
    else params.set('branch_store_location_id', String(selectedBranchId))

    apiFetch<OverviewResponse>(`/api/admin/dashboard/analytics/overview?${params}`)
      .then((response) => {
        if (cancelled) return
        setOverview(response)
        setOverviewError(null)
      })
      .catch((err) => {
        if (cancelled) return
        setOverviewError(err instanceof Error ? err.message : 'Unable to load dashboard analytics')
      })
      .finally(() => {
        if (!cancelled) setReady(true)
      })

    return () => {
      cancelled = true
    }
  }, [branchKey, canViewEcommerce, canViewPackage, selectedBranchId])

  const onChildReady = useCallback(() => {
    // Overview already gates the page shell; children stay silent for initial paint.
  }, [])

  if (!ready) {
    return <DashboardPageLoading />
  }

  if (overviewError && !overview) {
    return <p className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{overviewError}</p>
  }

  return (
    <div className="relative space-y-8">
      {canViewEcommerce ? (
        <EcommerceAnalyticsDashboard
          key={branchKey}
          initialData={overview?.ecommerce ?? null}
          initialCategories={overview?.categories ?? []}
          onInitialLoad={onChildReady}
        />
      ) : null}
      {canViewPackage ? (
        <PackageAnalyticsDashboard
          key={`pkg-${branchKey}`}
          initialSummary={overview?.packages?.summary ?? null}
          initialFilterOptions={overview?.packages?.filter_options}
          initialLiability={overview?.packages?.customer_packages ?? null}
          onInitialLoad={onChildReady}
        />
      ) : null}
    </div>
  )
}
