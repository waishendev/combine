'use client'

import { ChangeEvent, FormEvent, useRef, useState } from 'react'

import type { BankAccountRowData } from './BankAccountRow'
import { mapBankAccountApiItemToRow, type BankAccountApiItem } from './bankAccountUtils'
import { useI18n } from '@/lib/i18n'

interface BankAccountCreateModalProps {
  onClose: () => void
  onSuccess: (bankAccount: BankAccountRowData) => void
}

interface FormState {
  label: string
  bank_name: string
  account_name: string
  account_number: string
  branch: string
  swift_code: string
  instructions: string
  isActive: 'active' | 'inactive'
  isDefault: 'yes' | 'no'
}

const initialFormState: FormState = {
  label: '',
  bank_name: '',
  account_name: '',
  account_number: '',
  branch: '',
  swift_code: '',
  instructions: '',
  isActive: 'active',
  isDefault: 'no',
}

export default function BankAccountCreateModal({
  onClose,
  onSuccess,
}: BankAccountCreateModalProps) {
  const { t } = useI18n()
  const [form, setForm] = useState<FormState>({ ...initialFormState })
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [logoFile, setLogoFile] = useState<File | null>(null)
  const [qrImageFile, setQrImageFile] = useState<File | null>(null)
  const [logoPreview, setLogoPreview] = useState<string | null>(null)
  const [qrImagePreview, setQrImagePreview] = useState<string | null>(null)
  const logoInputRef = useRef<HTMLInputElement>(null)
  const qrImageInputRef = useRef<HTMLInputElement>(null)

  const handleChange = (
    event: ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>,
  ) => {
    const { name, value } = event.target
    setForm((prev) => ({ ...prev, [name]: value }))
  }

  const handleLogoChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (file) {
      setLogoFile(file)
      const reader = new FileReader()
      reader.onloadend = () => {
        setLogoPreview(reader.result as string)
      }
      reader.readAsDataURL(file)
    }
  }

  const handleQrImageChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (file) {
      setQrImageFile(file)
      const reader = new FileReader()
      reader.onloadend = () => {
        setQrImagePreview(reader.result as string)
      }
      reader.readAsDataURL(file)
    }
  }

  const handleLogoClick = () => {
    logoInputRef.current?.click()
  }

  const handleQrImageClick = () => {
    qrImageInputRef.current?.click()
  }

  const handleRemoveLogo = () => {
    setLogoFile(null)
    setLogoPreview(null)
    if (logoInputRef.current) {
      logoInputRef.current.value = ''
    }
  }

  const handleRemoveQrImage = () => {
    setQrImageFile(null)
    setQrImagePreview(null)
    if (qrImageInputRef.current) {
      qrImageInputRef.current.value = ''
    }
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    const trimmedLabel = form.label.trim()
    const trimmedBankName = form.bank_name.trim()
    const trimmedAccountName = form.account_name.trim()
    const trimmedAccountNumber = form.account_number.trim()
    const trimmedBranch = form.branch.trim()
    const trimmedSwiftCode = form.swift_code.trim()
    const trimmedInstructions = form.instructions.trim()

    setSubmitting(true)
    setError(null)

    try {
      const formData = new FormData()
      formData.append('label', trimmedLabel)
      formData.append('bank_name', trimmedBankName)
      formData.append('account_name', trimmedAccountName)
      formData.append('account_number', trimmedAccountNumber)
      formData.append('branch', trimmedBranch)
      formData.append('swift_code', trimmedSwiftCode)
      formData.append('instructions', trimmedInstructions)
      formData.append('is_active', form.isActive === 'active' ? '1' : '0')
      formData.append('is_default', form.isDefault === 'yes' ? '1' : '0')

      if (logoFile) {
        formData.append('logo_file', logoFile)
      }
      if (qrImageFile) {
        formData.append('qr_image_file', qrImageFile)
      }

      const res = await fetch('/api/proxy/ecommerce/bank-accounts', {
        method: 'POST',
        headers: {
          Accept: 'application/json',
        },
        body: formData,
      })

      const data = await res.json().catch(() => null)

      if (!res.ok) {
        let message = 'Failed to create bank account'
        if (data && typeof data === 'object') {
          if (typeof (data as { message?: unknown }).message === 'string') {
            message = (data as { message: string }).message
          } else if (data && 'errors' in data) {
            const errors = (data as { errors?: unknown }).errors
            if (errors && typeof errors === 'object') {
              const firstKey = Object.keys(errors)[0]
              const firstValue = firstKey ? (errors as Record<string, unknown>)[firstKey] : null
              if (Array.isArray(firstValue) && typeof firstValue[0] === 'string') {
                message = firstValue[0]
              } else if (typeof firstValue === 'string') {
                message = firstValue
              }
            }
          }
        }
        setError(message)
        return
      }

      const payload =
        data && typeof data === 'object' && 'data' in data
          ? ((data as { data?: BankAccountApiItem | null }).data ?? null)
          : null

      const bankAccountRow: BankAccountRowData = payload
        ? mapBankAccountApiItemToRow(payload)
        : {
            id: 0,
            label: trimmedLabel,
            bank_name: trimmedBankName,
            account_name: trimmedAccountName,
            account_number: trimmedAccountNumber,
            branch: trimmedBranch || null,
            swift_code: trimmedSwiftCode || null,
            logo_url: logoPreview || '',
            qr_image_url: qrImagePreview || null,
            isActive: form.isActive === 'active',
            isDefault: form.isDefault === 'yes',
            sort_order: null,
            instructions: trimmedInstructions || null,
            createdAt: '',
            updatedAt: '',
          }

      setForm({ ...initialFormState })
      setLogoFile(null)
      setQrImageFile(null)
      setLogoPreview(null)
      setQrImagePreview(null)
      onSuccess(bankAccountRow)
    } catch (err) {
      console.error(err)
      setError('Failed to create bank account')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div
        className="absolute inset-0 bg-black/50"
        onClick={() => {
          if (!submitting) onClose()
        }}
      />
      <div className="relative w-full max-w-4xl mx-auto bg-white rounded-lg shadow-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between border-b border-gray-300 px-5 py-4">
          <h2 className="text-lg font-semibold">Create Bank Account</h2>
          <button
            onClick={() => {
              if (!submitting) onClose()
            }}
            className="text-gray-500 hover:text-gray-700 text-2xl leading-none"
            aria-label={t('common.close')}
            type="button"
          >
            <i className="fa-solid fa-xmark" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5">
          <div className="grid grid-cols-2 gap-6">
            {/* Left Side - Image Upload */}
            <div className="space-y-4">
              {/* Logo field hidden for now */}
              <div className="hidden">
                <h3 className="text-sm font-medium text-gray-700 mb-1">Logo</h3>
                <div
                  onClick={handleLogoClick}
                  className={`relative border-2 border-dashed rounded-lg p-4 cursor-pointer transition-colors ${
                    logoPreview
                      ? 'border-gray-300'
                      : 'border-gray-300 hover:border-blue-400'
                  }`}
                >
                  <input
                    ref={logoInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleLogoChange}
                    className="hidden"
                    disabled={submitting}
                  />
                  {logoPreview ? (
                    <div className="relative group">
                      <img
                        src={logoPreview}
                        alt="Logo Preview"
                        className="w-full h-48 object-contain rounded"
                      />
                      <div className="absolute top-2 right-2 flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation()
                            handleLogoClick()
                          }}
                          className="w-8 h-8 bg-blue-500/95 backdrop-blur-md text-white rounded-full flex items-center justify-center shadow-lg border border-blue-400/30 hover:bg-blue-600 hover:shadow-xl hover:scale-110 transition-all duration-200"
                          aria-label="Replace logo"
                          disabled={submitting}
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
                          aria-label="Delete logo"
                          disabled={submitting}
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

              <div>
                <h3 className="text-sm font-medium text-gray-700 mb-1">QR Code Image</h3>
                <div
                  onClick={handleQrImageClick}
                  className={`relative border-2 border-dashed rounded-lg p-4 cursor-pointer transition-colors ${
                    qrImagePreview
                      ? 'border-gray-300'
                      : 'border-gray-300 hover:border-blue-400'
                  }`}
                >
                  <input
                    ref={qrImageInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleQrImageChange}
                    className="hidden"
                    disabled={submitting}
                  />
                  {qrImagePreview ? (
                    <div className="relative group">
                      <img
                        src={qrImagePreview}
                        alt="QR Code Preview"
                        className="w-full h-48 object-contain rounded"
                      />
                      <div className="absolute top-2 right-2 flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation()
                            handleQrImageClick()
                          }}
                          className="w-8 h-8 bg-blue-500/95 backdrop-blur-md text-white rounded-full flex items-center justify-center shadow-lg border border-blue-400/30 hover:bg-blue-600 hover:shadow-xl hover:scale-110 transition-all duration-200"
                          aria-label="Replace QR code image"
                          disabled={submitting}
                        >
                          <i className="fa-solid fa-image text-xs" />
                        </button>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation()
                            handleRemoveQrImage()
                          }}
                          className="w-8 h-8 bg-red-500/95 backdrop-blur-md text-white rounded-full flex items-center justify-center shadow-lg border border-red-400/30 hover:bg-red-600 hover:shadow-xl hover:scale-110 transition-all duration-200"
                          aria-label="Delete QR code image"
                          disabled={submitting}
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
            </div>

            {/* Right Side - Form Fields */}
            <div className="space-y-4">
              <div>
                <label
                  htmlFor="label"
                  className="block text-sm font-medium text-gray-700 mb-1"
                >
                  Label <span className="text-red-500">*</span>
                </label>
                <input
                  id="label"
                  name="label"
                  type="text"
                  value={form.label}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-blue-500 focus:border-blue-500"
                  placeholder="e.g., Maybank Account 1"
                  required
                  disabled={submitting}
                />
              </div>

              <div>
                <label
                  htmlFor="bank_name"
                  className="block text-sm font-medium text-gray-700 mb-1"
                >
                  Bank Name <span className="text-red-500">*</span>
                </label>
                <input
                  id="bank_name"
                  name="bank_name"
                  type="text"
                  value={form.bank_name}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-blue-500 focus:border-blue-500"
                  placeholder="e.g., Maybank"
                  required
                  disabled={submitting}
                />
              </div>

              <div>
                <label
                  htmlFor="account_name"
                  className="block text-sm font-medium text-gray-700 mb-1"
                >
                  Account Name <span className="text-red-500">*</span>
                </label>
                <input
                  id="account_name"
                  name="account_name"
                  type="text"
                  value={form.account_name}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-blue-500 focus:border-blue-500"
                  placeholder="e.g., John Doe"
                  required
                  disabled={submitting}
                />
              </div>

              <div>
                <label
                  htmlFor="account_number"
                  className="block text-sm font-medium text-gray-700 mb-1"
                >
                  Account Number <span className="text-red-500">*</span>
                </label>
                <input
                  id="account_number"
                  name="account_number"
                  type="text"
                  value={form.account_number}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-blue-500 focus:border-blue-500"
                  placeholder="e.g., 1234567890"
                  required
                  disabled={submitting}
                />
              </div>

              <div>
                <label
                  htmlFor="branch"
                  className="block text-sm font-medium text-gray-700 mb-1"
                >
                  Branch
                </label>
                <input
                  id="branch"
                  name="branch"
                  type="text"
                  value={form.branch}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-blue-500 focus:border-blue-500"
                  placeholder="e.g., Main Branch"
                  disabled={submitting}
                />
              </div>

              <div>
                <label
                  htmlFor="swift_code"
                  className="block text-sm font-medium text-gray-700 mb-1"
                >
                  Swift Code
                </label>
                <input
                  id="swift_code"
                  name="swift_code"
                  type="text"
                  value={form.swift_code}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-blue-500 focus:border-blue-500"
                  placeholder="e.g., MBBEMYKL"
                  disabled={submitting}
                />
              </div>

              <div>
                <label
                  htmlFor="instructions"
                  className="block text-sm font-medium text-gray-700 mb-1"
                >
                  Instructions
                </label>
                <textarea
                  id="instructions"
                  name="instructions"
                  value={form.instructions}
                  onChange={handleChange}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Additional instructions for payment"
                  disabled={submitting}
                />
              </div>

              <div>
                <label
                  htmlFor="isActive"
                  className="block text-sm font-medium text-gray-700 mb-1"
                >
                  Status
                </label>
                <select
                  id="isActive"
                  name="isActive"
                  value={form.isActive}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-blue-500 focus:border-blue-500"
                  disabled={submitting}
                >
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                </select>
              </div>

              <div>
                <label
                  htmlFor="isDefault"
                  className="block text-sm font-medium text-gray-700 mb-1"
                >
                  Default Account
                </label>
                <select
                  id="isDefault"
                  name="isDefault"
                  value={form.isDefault}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-blue-500 focus:border-blue-500"
                  disabled={submitting}
                >
                  <option value="no">No</option>
                  <option value="yes">Yes</option>
                </select>
              </div>
            </div>
          </div>

          {error && (
            <div className="text-sm text-red-600 mt-4" role="alert">
              {error}
            </div>
          )}

          <div className="flex items-center justify-end gap-3 pt-4 mt-4 border-t border-gray-200">
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
              className="px-4 py-2 text-sm text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50"
              disabled={submitting}
            >
              {submitting ? 'Creating...' : t('common.create')}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

