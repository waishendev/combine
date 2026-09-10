'use client'

import { useCallback, useState } from 'react'

import PaymentProofNotificationSettingsCard from '@/components/PaymentProofNotificationSettingsCard'
import ShippingFulfillmentPriorityCard from '@/components/ShippingFulfillmentPriorityCard'
import ShopSettingsPageContent from '@/components/ShopSettingsPageContent'

type ReadyKey = 'shop' | 'shipping' | 'payment'

export default function GeneralSettingsBody({ canEdit }: { canEdit: boolean }) {
  const [ready, setReady] = useState<Record<ReadyKey, boolean>>({
    shop: false,
    shipping: false,
    payment: false,
  })

  const onShopReady = useCallback(() => {
    setReady((prev) => (prev.shop ? prev : { ...prev, shop: true }))
  }, [])

  const onShippingReady = useCallback(() => {
    setReady((prev) => (prev.shipping ? prev : { ...prev, shipping: true }))
  }, [])

  const onPaymentReady = useCallback(() => {
    setReady((prev) => (prev.payment ? prev : { ...prev, payment: true }))
  }, [])

  const allReady = ready.shop && ready.shipping && ready.payment

  return (
    <>
      {!allReady ? (
        <div className="rounded-xl border border-slate-200 bg-white p-6 text-sm text-slate-500 shadow-sm">
          Loading shop settings...
        </div>
      ) : null}

      <div className={allReady ? undefined : 'hidden'} aria-hidden={!allReady}>
        <ShopSettingsPageContent
          canEdit={canEdit}
          hideLoadingUi
          onReady={onShopReady}
        />
        <div className="mt-6">
          <ShippingFulfillmentPriorityCard
            canEdit={canEdit}
            hideLoadingUi
            onReady={onShippingReady}
          />
        </div>
        <div className="mt-6">
          <PaymentProofNotificationSettingsCard
            canEdit={canEdit}
            settingKey="ecommerce_payment_proof_notification"
            settingType="ecommerce"
            title="Payment Proof Upload Notification"
            description="Notify an admin via email when a customer uploads or re-uploads a manual transfer payment slip for an order."
            hideLoadingUi
            onReady={onPaymentReady}
          />
        </div>
      </div>
    </>
  )
}
