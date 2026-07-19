'use client'

import { ChangeEvent, FormEvent, useEffect, useState } from 'react'

import type { PaymentGatewayRowData } from './PaymentGatewayRow'
import { mapPaymentGatewayApiItemToRow, type PaymentGatewayApiItem } from './paymentGatewayUtils'
import CrmFormModalShell from './CrmFormModalShell'
import { useI18n } from '@/lib/i18n'
import { getWorkspace } from '@/lib/workspace'

interface PaymentGatewayEditModalProps {
  paymentGatewayId: number
  onClose: () => void
  onSuccess: (paymentGateway: PaymentGatewayRowData) => void
}

interface FormState {
  name: string
  isActive: 'active' | 'inactive'
  isDefault: 'yes' | 'no'
  allowCheckout: boolean
  allowWalletTopup: boolean
  apiKey: string
  collectionId: string
  xSignature: string
  baseUrl: string
  frontendUrl: string
  publicUrl: string
}

const initialFormState: FormState = {
  name: '',
  isActive: 'active',
  isDefault: 'no',
  allowCheckout: true,
  allowWalletTopup: false,
  apiKey: '',
  collectionId: '',
  xSignature: '',
  baseUrl: 'https://www.billplz.com/api/v3',
  frontendUrl: '',
  publicUrl: '',
}

export default function PaymentGatewayEditModal({
  paymentGatewayId,
  onClose,
  onSuccess,
}: PaymentGatewayEditModalProps) {
  const { t } = useI18n()
  const workspaceType = getWorkspace()
  const [form, setForm] = useState<FormState>({ ...initialFormState })
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loadedPaymentGateway, setLoadedPaymentGateway] = useState<PaymentGatewayRowData | null>(null)

  useEffect(() => {
    const controller = new AbortController()

    const loadPaymentGateway = async () => {
      setLoading(true)
      setError(null)
      try {
        const res = await fetch(`/api/proxy/ecommerce/payment-gateways/${paymentGatewayId}?type=${workspaceType}`, {
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
          setError('Failed to load payment gateway')
          return
        }

        const paymentGateway = data?.data as PaymentGatewayApiItem | undefined
        if (!paymentGateway || typeof paymentGateway !== 'object') {
          setError('Failed to load payment gateway')
          return
        }

        const config = (paymentGateway.config && typeof paymentGateway.config === 'object')
          ? (paymentGateway.config as Record<string, unknown>)
          : {}

        const mappedPaymentGateway = mapPaymentGatewayApiItemToRow(paymentGateway)
        setLoadedPaymentGateway(mappedPaymentGateway)

        setForm({
          name: typeof paymentGateway.name === 'string' ? paymentGateway.name : '',
          isActive:
            paymentGateway.is_active === true || paymentGateway.is_active === 'true' || paymentGateway.is_active === 1
              ? 'active'
              : 'inactive',
          isDefault:
            paymentGateway.is_default === true || paymentGateway.is_default === 'true' || paymentGateway.is_default === 1
              ? 'yes'
              : 'no',
          allowCheckout: paymentGateway.allow_checkout !== false && paymentGateway.allow_checkout !== 'false' && paymentGateway.allow_checkout !== 0 && paymentGateway.allow_checkout !== '0',
          allowWalletTopup: paymentGateway.allow_wallet_topup === true || paymentGateway.allow_wallet_topup === 'true' || paymentGateway.allow_wallet_topup === 1 || paymentGateway.allow_wallet_topup === '1',
          apiKey: typeof config.api_key === 'string' ? config.api_key : '',
          collectionId: typeof config.collection_id === 'string' ? config.collection_id : '',
          xSignature: typeof config.x_signature === 'string' ? config.x_signature : '',
          baseUrl: typeof config.base_url === 'string' && config.base_url ? config.base_url : 'https://www.billplz.com/api/v3',
          frontendUrl: typeof config.frontend_url === 'string' ? config.frontend_url : '',
          publicUrl: typeof config.public_url === 'string' ? config.public_url : '',
        })
      } catch (err) {
        if (!(err instanceof DOMException && err.name === 'AbortError')) {
          setError('Failed to load payment gateway')
        }
      } finally {
        setLoading(false)
      }
    }

    loadPaymentGateway().catch(() => {
      setLoading(false)
      setError('Failed to load payment gateway')
    })

    return () => controller.abort()
  }, [paymentGatewayId])

  const handleChange = (
    event: ChangeEvent<HTMLInputElement | HTMLSelectElement>,
  ) => {
    const { name, value } = event.target
    const checked = 'checked' in event.target ? event.target.checked : false
    setForm((prev) => ({ ...prev, [name]: event.target.type === 'checkbox' ? checked : value }))
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    const trimmedName = form.name.trim()

    setSubmitting(true)
    setError(null)

    try {
      const config = {
        api_key: form.apiKey.trim() || undefined,
        collection_id: form.collectionId.trim() || undefined,
        x_signature: form.xSignature.trim() || undefined,
        base_url: form.baseUrl.trim() || undefined,
        frontend_url: form.frontendUrl.trim() || undefined,
        public_url: form.publicUrl.trim() || undefined,
      }

      const res = await fetch(`/api/proxy/ecommerce/payment-gateways/${paymentGatewayId}?type=${workspaceType}`, {
        method: 'PUT',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: trimmedName,
          is_active: form.isActive === 'active',
          is_default: form.isDefault === 'yes',
          allow_checkout: form.allowCheckout,
          allow_wallet_topup: form.allowWalletTopup,
          config,
          type: workspaceType,
        }),
      })

      const data = await res.json().catch(() => null)
      if (data && typeof data === 'object') {
        if (data?.success === false && data?.message === 'Unauthorized') {
          window.location.replace('/dashboard')
          return
        }
      }

      if (!res.ok) {
        if (data && typeof data === 'object') {
          if ('message' in data && typeof data.message === 'string') {
            setError(data.message)
            return
          }
          if ('errors' in data && typeof data.errors === 'object') {
            const errors = data.errors as Record<string, unknown>
            const firstKey = Object.keys(errors)[0]
            if (firstKey) {
              const firstValue = errors[firstKey]
              if (Array.isArray(firstValue) && typeof firstValue[0] === 'string') {
                setError(firstValue[0])
                return
              }
              if (typeof firstValue === 'string') {
                setError(firstValue)
                return
              }
            }
          }
        }
        setError('Failed to update payment gateway')
        return
      }

      const payloadData =
        data && typeof data === 'object' && 'data' in data
          ? ((data as { data?: PaymentGatewayApiItem | null }).data ?? null)
          : null

      const paymentGatewayRow: PaymentGatewayRowData = payloadData
        ? mapPaymentGatewayApiItemToRow(payloadData)
        : {
            id: loadedPaymentGateway?.id ?? paymentGatewayId,
            key: loadedPaymentGateway?.key ?? '',
            name: trimmedName,
            isActive: form.isActive === 'active',
            isDefault: form.isDefault === 'yes',
            allowCheckout: form.allowCheckout,
            allowWalletTopup: form.allowWalletTopup,
            sort_order: loadedPaymentGateway?.sort_order ?? null,
            createdAt: loadedPaymentGateway?.createdAt ?? '',
            updatedAt: new Date().toISOString(),
          }

      setLoadedPaymentGateway(paymentGatewayRow)
      onSuccess(paymentGatewayRow)
    } catch (err) {
      console.error(err)
      setError('Failed to update payment gateway')
    } finally {
      setSubmitting(false)
    }
  }

  const disableForm = loading || submitting

  return (
    <CrmFormModalShell
      title="Edit Payment Gateway"
      size="lg"
      onClose={onClose}
      closeDisabled={submitting}
      closeLabel={t('common.close')}
      footer={
        <>
          <button
            type="button"
            className="px-4 py-2 text-sm text-gray-700 border border-gray-300 rounded-md hover:bg-gray-100 disabled:opacity-50"
            onClick={() => {
              if (!submitting) onClose()
            }}
            disabled={submitting}
          >
            {t('common.cancel')}
          </button>
          <button
            type="submit"
            form="payment-gateway-edit-form"
            className="px-4 py-2 text-sm text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50"
            disabled={disableForm}
          >
            {submitting ? t('common.saving') : 'Save Changes'}
          </button>
        </>
      }
    >
      <form id="payment-gateway-edit-form" onSubmit={handleSubmit} className="space-y-4 px-5 py-4">
          {loading ? (
            <div className="py-8 text-center text-sm text-gray-500">Loading payment gateway details...</div>
          ) : (
            <>
              <div className="space-y-4">
                <div>
                  <label
                    htmlFor="edit-name"
                    className="block text-sm font-medium text-gray-700 mb-1"
                  >
                    Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    id="edit-name"
                    name="name"
                    type="text"
                    value={form.name}
                    onChange={handleChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-blue-500 focus:border-blue-500"
                    placeholder="e.g., Online Banking (Billplz FPX)"
                    required
                    disabled={disableForm}
                  />
                </div>

                <div>
                  <label
                    htmlFor="edit-isActive"
                    className="block text-sm font-medium text-gray-700 mb-1"
                  >
                    Status
                  </label>
                  <select
                    id="edit-isActive"
                    name="isActive"
                    value={form.isActive}
                    onChange={handleChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-blue-500 focus:border-blue-500"
                    disabled={disableForm}
                  >
                    <option value="active">{t('common.active')}</option>
                    <option value="inactive">{t('common.inactive')}</option>
                  </select>
                </div>

                <fieldset className="rounded-md border border-gray-200 p-3">
                  <legend className="px-1 text-sm font-medium text-gray-700">Available For</legend>
                  <label className="flex items-center gap-2 text-sm text-gray-700">
                    <input type="checkbox" name="allowCheckout" checked={form.allowCheckout} onChange={handleChange} disabled={disableForm} />
                    Allow Checkout
                  </label>
                  <label className="mt-2 flex items-center gap-2 text-sm text-gray-700">
                    <input type="checkbox" name="allowWalletTopup" checked={form.allowWalletTopup} onChange={handleChange} disabled={disableForm} />
                    Allow Wallet Top Up
                  </label>
                </fieldset>

                <div>
                  <label
                    htmlFor="edit-isDefault"
                    className="block text-sm font-medium text-gray-700 mb-1"
                  >
                    Default Checkout Gateway
                  </label>
                  <select
                    id="edit-isDefault"
                    name="isDefault"
                    value={form.isDefault}
                    onChange={handleChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-blue-500 focus:border-blue-500"
                    disabled={disableForm}
                  >
                    <option value="no">No</option>
                    <option value="yes">Yes</option>
                  </select>
                </div>

                <div className="rounded-md border border-gray-200 p-3">
                  <p className="mb-3 text-sm font-semibold text-gray-800">Billplz Config</p>
                  <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                    <input name="apiKey" value={form.apiKey} onChange={handleChange} className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm" placeholder="API Key" disabled={disableForm} />
                    <input name="collectionId" value={form.collectionId} onChange={handleChange} className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm" placeholder="Collection ID" disabled={disableForm} />
                    <input name="xSignature" value={form.xSignature} onChange={handleChange} className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm" placeholder="X Signature" disabled={disableForm} />
                    <input name="baseUrl" value={form.baseUrl} onChange={handleChange} className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm" placeholder="Base URL" disabled={disableForm} />
                    <input name="frontendUrl" value={form.frontendUrl} onChange={handleChange} className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm md:col-span-2" placeholder="Frontend URL (redirect URL base)" disabled={disableForm} />
                    <input name="publicUrl" value={form.publicUrl} onChange={handleChange} className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm md:col-span-2" placeholder="Public API URL (callback URL base)" disabled={disableForm} />
                  </div>
                </div>
              </div>
            </>
          )}

          {error && (
            <div className="text-sm text-red-600" role="alert">
              {error}
            </div>
          )}
      </form>
    </CrmFormModalShell>
  )
}
