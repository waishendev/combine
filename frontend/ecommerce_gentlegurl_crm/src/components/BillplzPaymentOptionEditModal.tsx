'use client'

import { ChangeEvent, FormEvent, useEffect, useRef, useState } from 'react'

import type { BillplzPaymentOptionRowData } from './BillplzPaymentOptionRow'
import {
  BILLPLZ_LOGO_ACCEPT,
  getBillplzOptionApiError,
  mapBillplzPaymentOptionApiItemToRow,
  type BillplzPaymentOptionApiItem,
  type GatewayGroup,
} from './billplzPaymentOptionUtils'
import CrmFormModalShell from './CrmFormModalShell'
import { useI18n } from '@/lib/i18n'
import { getWorkspace } from '@/lib/workspace'

interface BillplzPaymentOptionEditModalProps {
  optionId: number
  onClose: () => void
  onSuccess: (option: BillplzPaymentOptionRowData) => void
}

interface FormState {
  gateway_group: GatewayGroup
  code: string
  name: string
  description: string
  status: 'active' | 'inactive'
  isDefault: 'yes' | 'no'
}

const initialFormState: FormState = {
  gateway_group: 'online_banking',
  code: '',
  name: '',
  description: '',
  status: 'active',
  isDefault: 'no',
}

export default function BillplzPaymentOptionEditModal({
  optionId,
  onClose,
  onSuccess,
}: BillplzPaymentOptionEditModalProps) {
  const { t } = useI18n()
  const workspaceType = getWorkspace()
  const [form, setForm] = useState<FormState>({ ...initialFormState })
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loadedOption, setLoadedOption] = useState<BillplzPaymentOptionRowData | null>(null)
  const [logoFile, setLogoFile] = useState<File | null>(null)
  const [logoPreview, setLogoPreview] = useState<string | null>(null)
  const [logoRemoved, setLogoRemoved] = useState(false)
  const logoInputRef = useRef<HTMLInputElement>(null)

  const disableForm = loading || submitting

  useEffect(() => {
    const controller = new AbortController()

    const loadOption = async () => {
      setLoading(true)
      setError(null)
      try {
        const res = await fetch(
          `/api/proxy/ecommerce/billplz-payment-gateway-options/${optionId}?type=${workspaceType}`,
          {
            cache: 'no-store',
            signal: controller.signal,
            headers: {
              Accept: 'application/json',
              'Accept-Language': 'en',
            },
          },
        )

        const data = await res.json().catch(() => null)
        if (data && typeof data === 'object') {
          if (data?.success === false && data?.message === 'Unauthorized') {
            window.location.replace('/dashboard')
            return
          }
        }

        if (!res.ok) {
          setError(getBillplzOptionApiError(data, t('common.loadError')))
          return
        }

        const option = data?.data as BillplzPaymentOptionApiItem | undefined
        if (!option || typeof option !== 'object') {
          setError(t('common.loadError'))
          return
        }

        const mapped = mapBillplzPaymentOptionApiItemToRow(option)
        setLoadedOption(mapped)
        setLogoFile(null)
        setLogoRemoved(false)
        setLogoPreview(mapped.logo_url)
        if (logoInputRef.current) logoInputRef.current.value = ''

        setForm({
          gateway_group: mapped.gateway_group,
          code: mapped.code,
          name: mapped.name,
          description: mapped.description || '',
          status: mapped.isActive ? 'active' : 'inactive',
          isDefault: mapped.isDefault ? 'yes' : 'no',
        })
      } catch (err) {
        if (!(err instanceof DOMException && err.name === 'AbortError')) {
          setError(t('common.loadError'))
        }
      } finally {
        setLoading(false)
      }
    }

    loadOption().catch(() => {
      setLoading(false)
      setError(t('common.loadError'))
    })

    return () => controller.abort()
  }, [optionId, t, workspaceType])

  const handleChange = (
    event: ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>,
  ) => {
    const { name, value } = event.target
    setForm((prev) => ({ ...prev, [name]: value }))
  }

  const handleLogoClick = () => {
    logoInputRef.current?.click()
  }

  const handleLogoChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (file) {
      setLogoFile(file)
      setLogoRemoved(false)
      const reader = new FileReader()
      reader.onloadend = () => {
        setLogoPreview(reader.result as string)
      }
      reader.readAsDataURL(file)
    }
  }

  const handleRemoveLogo = () => {
    setLogoFile(null)
    setLogoPreview(null)
    setLogoRemoved(true)
    if (logoInputRef.current) {
      logoInputRef.current.value = ''
    }
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    const trimmedCode = form.code.trim()
    const trimmedName = form.name.trim()
    const trimmedDescription = form.description.trim()

    if (!trimmedCode || !trimmedName) {
      setError(t('common.allFieldsRequired'))
      return
    }

    setSubmitting(true)
    setError(null)

    try {
      const typeQs = `type=${encodeURIComponent(workspaceType)}`
      const url = `/api/proxy/ecommerce/billplz-payment-gateway-options/${optionId}?${typeQs}`

      let res: Response
      if (logoFile) {
        const fd = new FormData()
        fd.append('gateway_group', form.gateway_group)
        fd.append('code', trimmedCode)
        fd.append('name', trimmedName)
        if (trimmedDescription) fd.append('description', trimmedDescription)
        fd.append('is_active', form.status === 'active' ? '1' : '0')
        fd.append('is_default', form.isDefault === 'yes' ? '1' : '0')
        fd.append('logo', logoFile)

        res = await fetch(url, {
          method: 'POST',
          headers: { Accept: 'application/json' },
          body: fd,
        })
      } else {
        res = await fetch(url, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
            'Accept-Language': 'en',
          },
          body: JSON.stringify({
            gateway_group: form.gateway_group,
            code: trimmedCode,
            name: trimmedName,
            logo_url: logoRemoved ? null : undefined,
            description: trimmedDescription || null,
            is_active: form.status === 'active',
            is_default: form.isDefault === 'yes',
          }),
        })
      }

      const data = await res.json().catch(() => null)
      if (data && typeof data === 'object') {
        if (data?.success === false && data?.message === 'Unauthorized') {
          window.location.replace('/dashboard')
          return
        }
      }

      if (!res.ok || data?.success === false) {
        setError(getBillplzOptionApiError(data, t('common.updateError')))
        return
      }

      const payloadData =
        data && typeof data === 'object' && 'data' in data
          ? ((data as { data?: BillplzPaymentOptionApiItem | null }).data ?? null)
          : null

      const optionRow: BillplzPaymentOptionRowData = payloadData
        ? mapBillplzPaymentOptionApiItemToRow(payloadData)
        : {
            id: loadedOption?.id ?? optionId,
            type: workspaceType,
            gateway_group: form.gateway_group,
            code: trimmedCode,
            name: trimmedName,
            logo_url: logoRemoved ? null : logoPreview,
            description: trimmedDescription || null,
            isActive: form.status === 'active',
            isDefault: form.isDefault === 'yes',
            sort_order: loadedOption?.sort_order ?? null,
            createdAt: loadedOption?.createdAt ?? '',
            updatedAt: new Date().toISOString(),
          }

      setLoadedOption(optionRow)
      onSuccess(optionRow)
    } catch (err) {
      console.error(err)
      setError(t('common.updateError'))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <CrmFormModalShell
      title="Edit Billplz Option"
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
            form="billplz-option-edit-form"
            className="px-4 py-2 text-sm text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50"
            disabled={disableForm}
          >
            {submitting ? t('common.saving') : t('common.save')}
          </button>
        </>
      }
    >
      <form id="billplz-option-edit-form" onSubmit={handleSubmit} className="p-5">
        {loading ? (
          <div className="py-8 text-center text-sm text-gray-500">{t('common.loadingDetails')}</div>
        ) : (
          <div className="grid grid-cols-2 gap-6">
            <div>
              <h3 className="text-sm font-medium text-gray-700">Image</h3>
              <p className="text-xs text-gray-500 mb-2">Upload SVG, PNG, JPG, or WebP</p>
              <div
                onClick={handleLogoClick}
                className={`relative border-2 border-dashed rounded-lg p-4 cursor-pointer transition-colors ${
                  logoPreview ? 'border-gray-300' : 'border-gray-300 hover:border-blue-400'
                }`}
              >
                <input
                  ref={logoInputRef}
                  type="file"
                  accept={BILLPLZ_LOGO_ACCEPT}
                  onChange={handleLogoChange}
                  className="hidden"
                  disabled={disableForm}
                />
                {logoPreview ? (
                  <div className="relative group">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={logoPreview} alt="Preview" className="w-full h-48 object-contain rounded" />
                    <div className="absolute top-2 right-2 flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation()
                          handleLogoClick()
                        }}
                        className="w-8 h-8 bg-blue-500/95 backdrop-blur-md text-white rounded-full flex items-center justify-center shadow-lg border border-blue-400/30 hover:bg-blue-600 hover:shadow-xl hover:scale-110 transition-all duration-200"
                        aria-label="Replace image"
                        disabled={disableForm}
                      >
                        <i className="fa-solid fa-image text-xs" />
                      </button>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation()
                          handleRemoveLogo()
                        }}
                        className="w-8 h-8 bg-red-500/95 backdrop-blur-md text-white rounded-full flex items-center justify-center shadow-lg border border-red-400/30 hover:bg-red-600 hover:shadow-xl hover:scale-110 transition-all duration-200"
                        aria-label="Delete image"
                        disabled={disableForm}
                      >
                        <i className="fa-solid fa-trash-can text-xs" />
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-8">
                    <i className="fa-solid fa-cloud-arrow-up text-4xl text-gray-400 mb-2" />
                    <p className="text-sm text-gray-600">Click to upload</p>
                  </div>
                )}
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <label htmlFor="edit-gateway_group" className="block text-sm font-medium text-gray-700 mb-1">
                  Group <span className="text-red-500">*</span>
                </label>
                <select
                  id="edit-gateway_group"
                  name="gateway_group"
                  value={form.gateway_group}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-blue-500 focus:border-blue-500"
                  disabled={disableForm}
                >
                  <option value="online_banking">Online Banking</option>
                  <option value="credit_card">Credit Card</option>
                </select>
              </div>

              <div>
                <label htmlFor="edit-code" className="block text-sm font-medium text-gray-700 mb-1">
                  Code <span className="text-red-500">*</span>
                </label>
                <input
                  id="edit-code"
                  name="code"
                  type="text"
                  value={form.code}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-blue-500 focus:border-blue-500"
                  placeholder="e.g., MB2U"
                  disabled={disableForm}
                />
              </div>

              <div>
                <label htmlFor="edit-name" className="block text-sm font-medium text-gray-700 mb-1">
                  Name <span className="text-red-500">*</span>
                </label>
                <input
                  id="edit-name"
                  name="name"
                  type="text"
                  value={form.name}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-blue-500 focus:border-blue-500"
                  placeholder="e.g., Maybank2u"
                  disabled={disableForm}
                />
              </div>

              <div>
                <label htmlFor="edit-description" className="block text-sm font-medium text-gray-700 mb-1">
                  Description
                </label>
                <textarea
                  id="edit-description"
                  name="description"
                  value={form.description}
                  onChange={handleChange}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Optional description"
                  disabled={disableForm}
                />
              </div>

              <div>
                <label htmlFor="edit-status" className="block text-sm font-medium text-gray-700 mb-1">
                  Status <span className="text-red-500">*</span>
                </label>
                <select
                  id="edit-status"
                  name="status"
                  value={form.status}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-blue-500 focus:border-blue-500"
                  disabled={disableForm}
                >
                  <option value="active">{t('common.active')}</option>
                  <option value="inactive">{t('common.inactive')}</option>
                </select>
              </div>

              <div>
                <label htmlFor="edit-isDefault" className="block text-sm font-medium text-gray-700 mb-1">
                  Default
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
            </div>
          </div>
        )}

        {error && (
          <div className="mt-4 text-sm text-red-600" role="alert">
            {error}
          </div>
        )}
      </form>
    </CrmFormModalShell>
  )
}
