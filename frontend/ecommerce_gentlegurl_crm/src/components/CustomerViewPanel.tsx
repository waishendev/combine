'use client'

import { useEffect, useState } from 'react'

import StatusBadge from './StatusBadge'
import { useI18n } from '@/lib/i18n'

interface CustomerViewPanelProps {
  customerId: number
  onClose: () => void
}

type CustomerDetailData = {
  id: number
  name: string
  email: string
  phone: string
  tier: string
  tier_marked_pending_at: string | null
  tier_effective_at: string | null
  is_active: boolean
  last_login_at: string | null
  last_login_ip: string | null
  created_at: string
  updated_at: string
  loyalty_summary?: {
    available_points: number
    total_earned: number
    total_redeemed: number
    window: {
      months_window: number
      start_date: string
      end_date: string
      spent_in_window: number
    }
    next_tier: {
      tier: string
      threshold_amount: string
      amount_to_reach: number
    }
  }
}

export default function CustomerViewPanel({
  customerId,
  onClose,
}: CustomerViewPanelProps) {
  const { t } = useI18n()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [customer, setCustomer] = useState<CustomerDetailData | null>(null)

  useEffect(() => {
    const controller = new AbortController()

    const loadCustomer = async () => {
      setLoading(true)
      setError(null)
      try {
        const res = await fetch(`/api/proxy/customers/${customerId}`, {
          cache: 'no-store',
          signal: controller.signal,
          headers: {
            Accept: 'application/json',
            'Accept-Language': 'en',
          },
        })

        const data = await res.json().catch(() => null)
        if (data && typeof data === 'object') {
          if (data?.success === false && data?.message === 'Unauthorized') {
            window.location.replace('/dashboard')
            return
          }
        }

        if (!res.ok) {
          if (data && typeof data === 'object' && 'message' in data) {
            const message = (data as { message?: unknown }).message
            if (typeof message === 'string') {
              setError(message)
              return
            }
          }
          setError(t('customer.loadError'))
          return
        }

        const customerData = data?.data as CustomerDetailData | undefined
        if (!customerData || typeof customerData !== 'object') {
          setError(t('customer.loadError'))
          return
        }

        setCustomer(customerData)
      } catch (err) {
        if (!(err instanceof DOMException && err.name === 'AbortError')) {
          setError(t('customer.loadError'))
        }
      } finally {
        setLoading(false)
      }
    }

    loadCustomer().catch(() => {
      setLoading(false)
      setError(t('customer.loadError'))
    })

    return () => controller.abort()
  }, [customerId, t])

  const formatDate = (dateString: string | null) => {
    if (!dateString) return '-'
    try {
      return new Date(dateString).toLocaleString()
    } catch {
      return dateString
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex bg-black/40 px-0 md:bg-transparent md:px-0"
      role="dialog"
      aria-modal="true"
      onClick={onClose}
    >
      <div className="hidden flex-1 bg-black/40 md:block" />
      <aside
        className="ml-auto flex h-full w-full max-w-md flex-col bg-white shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-gray-200 px-5 py-4">
          <h3 className="text-sm font-semibold text-gray-900">
            {t('customer.detailTitle')}
          </h3>
          <button
            type="button"
            className="text-gray-500 hover:text-gray-700"
            onClick={onClose}
            aria-label={t('common.close')}
          >
            <i className="fa-solid fa-xmark" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-4">
          {loading ? (
            <div className="py-8 text-center text-sm text-gray-500">
              {t('common.loadingDetails')}
            </div>
          ) : error ? (
            <div className="py-8 text-center text-sm text-red-600">{error}</div>
          ) : customer ? (
            <div className="space-y-5">
              {/* Basic Information */}
              <section className="rounded border border-gray-200">
                <div className="border-b border-gray-200 bg-gray-50 px-4 py-3">
                  <p className="text-sm font-semibold text-gray-900">
                    {t('customer.basicInfo')}
                  </p>
                </div>
                <div className="px-4 py-3 space-y-3 text-sm">
                  <div>
                    <p className="text-xs text-gray-500">{t('common.name')}</p>
                    <p className="font-medium text-gray-900">{customer.name}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">{t('common.email')}</p>
                    <p className="font-medium text-gray-900">{customer.email}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Phone</p>
                    <p className="font-medium text-gray-900">{customer.phone}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">{t('common.status')}</p>
                    <div className="mt-1">
                      <StatusBadge
                        status={customer.is_active ? 'active' : 'inactive'}
                        label={customer.is_active ? t('common.active') : t('common.inactive')}
                      />
                    </div>
                  </div>
                </div>
              </section>

              {/* Tier Information */}
              <section className="rounded border border-gray-200">
                <div className="border-b border-gray-200 bg-gray-50 px-4 py-3">
                  <p className="text-sm font-semibold text-gray-900">
                    {t('customer.tierInfo')}
                  </p>
                </div>
                <div className="px-4 py-3 space-y-3 text-sm">
                  <div>
                    <p className="text-xs text-gray-500">Tier</p>
                    <p className="font-medium text-gray-900 capitalize">{customer.tier}</p>
                  </div>
                  {customer.tier_marked_pending_at && (
                    <div>
                      <p className="text-xs text-gray-500">Tier Marked Pending At</p>
                      <p className="font-medium text-gray-900">
                        {formatDate(customer.tier_marked_pending_at)}
                      </p>
                    </div>
                  )}
                  {customer.tier_effective_at && (
                    <div>
                      <p className="text-xs text-gray-500">Tier Effective At</p>
                      <p className="font-medium text-gray-900">
                        {formatDate(customer.tier_effective_at)}
                      </p>
                    </div>
                  )}
                </div>
              </section>

              {/* Login Information */}
              <section className="rounded border border-gray-200">
                <div className="border-b border-gray-200 bg-gray-50 px-4 py-3">
                  <p className="text-sm font-semibold text-gray-900">
                    {t('customer.loginInfo')}
                  </p>
                </div>
                <div className="px-4 py-3 space-y-3 text-sm">
                  <div>
                    <p className="text-xs text-gray-500">Last Login At</p>
                    <p className="font-medium text-gray-900">
                      {formatDate(customer.last_login_at)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Last Login IP</p>
                    <p className="font-medium text-gray-900">
                      {customer.last_login_ip || '-'}
                    </p>
                  </div>
                </div>
              </section>

              {/* Loyalty Summary */}
              {customer.loyalty_summary && (
                <section className="rounded border border-gray-200">
                  <div className="border-b border-gray-200 bg-gray-50 px-4 py-3">
                    <p className="text-sm font-semibold text-gray-900">
                      {t('customer.loyaltySummary')}
                    </p>
                  </div>
                  <div className="px-4 py-3 space-y-3 text-sm">
                    <div>
                      <p className="text-xs text-gray-500">Available Points</p>
                      <p className="font-medium text-gray-900">
                        {customer.loyalty_summary.available_points.toLocaleString()}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500">Total Earned</p>
                      <p className="font-medium text-gray-900">
                        {customer.loyalty_summary.total_earned.toLocaleString()}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500">Total Redeemed</p>
                      <p className="font-medium text-gray-900">
                        {customer.loyalty_summary.total_redeemed.toLocaleString()}
                      </p>
                    </div>
                    {customer.loyalty_summary.window && (
                      <div className="pt-2 border-t border-gray-200">
                        <p className="text-xs font-medium text-gray-700 mb-2">Window</p>
                        <div className="space-y-2 pl-2">
                          <div>
                            <p className="text-xs text-gray-500">Months Window</p>
                            <p className="font-medium text-gray-900">
                              {customer.loyalty_summary.window.months_window}
                            </p>
                          </div>
                          <div>
                            <p className="text-xs text-gray-500">Start Date</p>
                            <p className="font-medium text-gray-900">
                              {customer.loyalty_summary.window.start_date}
                            </p>
                          </div>
                          <div>
                            <p className="text-xs text-gray-500">End Date</p>
                            <p className="font-medium text-gray-900">
                              {customer.loyalty_summary.window.end_date}
                            </p>
                          </div>
                          <div>
                            <p className="text-xs text-gray-500">Spent in Window</p>
                            <p className="font-medium text-gray-900">
                              {customer.loyalty_summary.window.spent_in_window.toLocaleString()}
                            </p>
                          </div>
                        </div>
                      </div>
                    )}
                    {customer.loyalty_summary.next_tier && (
                      <div className="pt-2 border-t border-gray-200">
                        <p className="text-xs font-medium text-gray-700 mb-2">Next Tier</p>
                        <div className="space-y-2 pl-2">
                          <div>
                            <p className="text-xs text-gray-500">Tier</p>
                            <p className="font-medium text-gray-900 capitalize">
                              {customer.loyalty_summary.next_tier.tier}
                            </p>
                          </div>
                          <div>
                            <p className="text-xs text-gray-500">Threshold Amount</p>
                            <p className="font-medium text-gray-900">
                              {customer.loyalty_summary.next_tier.threshold_amount}
                            </p>
                          </div>
                          <div>
                            <p className="text-xs text-gray-500">Amount to Reach</p>
                            <p className="font-medium text-gray-900">
                              {customer.loyalty_summary.next_tier.amount_to_reach.toLocaleString()}
                            </p>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </section>
              )}

              {/* Timestamps */}
              <section className="rounded border border-gray-200">
                <div className="border-b border-gray-200 bg-gray-50 px-4 py-3">
                  <p className="text-sm font-semibold text-gray-900">
                    {t('customer.timestamps')}
                  </p>
                </div>
                <div className="px-4 py-3 space-y-3 text-sm">
                  <div>
                    <p className="text-xs text-gray-500">{t('common.createdAt')}</p>
                    <p className="font-medium text-gray-900">
                      {formatDate(customer.created_at)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">{t('common.updatedAt')}</p>
                    <p className="font-medium text-gray-900">
                      {formatDate(customer.updated_at)}
                    </p>
                  </div>
                </div>
              </section>
            </div>
          ) : null}
        </div>
      </aside>
    </div>
  )
}

