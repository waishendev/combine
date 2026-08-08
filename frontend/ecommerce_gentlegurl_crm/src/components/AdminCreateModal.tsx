'use client'

import { ChangeEvent, FormEvent, useState } from 'react'

import type { AdminRowData } from './AdminRow'
import { AdminRoleOption } from './AdminFilters'
import { mapAdminApiItemToRow, type AdminApiItem } from './adminUtils'
import CrmFormModalShell from './CrmFormModalShell'
import { useI18n } from '@/lib/i18n'
import BranchAccessChecklist, { type BranchAccessOption } from './BranchAccessChecklist'

type BranchOption = BranchAccessOption

interface AdminCreateModalProps {
  onClose: () => void
  onSuccess: (admin: AdminRowData) => void
  roles: AdminRoleOption[]
  rolesLoading: boolean
  branchOptions: BranchOption[]
  canAssignBranches: boolean
}


interface FormState {
  username: string
  password: string
  email: string
  roleId: string
  storeLocationIds: string[]
}

const initialFormState: FormState = {
  username: '',
  password: '',
  email: '',
  roleId: '',
  storeLocationIds: [],
}

export default function AdminCreateModal({
  onClose,
  onSuccess,
  roles,
  rolesLoading,
  branchOptions,
  canAssignBranches,
}: AdminCreateModalProps) {
  const { t } = useI18n()
  const [form, setForm] = useState<FormState>({ ...initialFormState })
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleChange = (
    event: ChangeEvent<HTMLInputElement | HTMLSelectElement>,
  ) => {
    const { name, value } = event.target
    setForm((prev) => ({ ...prev, [name]: value }))
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    const trimmedUsername = form.username.trim()
    const trimmedEmail = form.email.trim()
    const roleIdNumber = Number(form.roleId)

    if (!form.password || !trimmedEmail || !roleIdNumber) {
      setError(t('common.allFieldsRequired'))
      return
    }

    setSubmitting(true)
    setError(null)

    try {
      const res = await fetch('/api/proxy/admins', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({
          name: trimmedUsername || trimmedEmail.split('@')[0],
          username: trimmedUsername || null,
          password: form.password,
          email: trimmedEmail,
          role_ids: [roleIdNumber],
          is_active: true,
          ...(canAssignBranches ? { store_location_ids: form.storeLocationIds.map(Number) } : {}),
        }),
      })

      const data = await res.json().catch(() => null)

      if (!res.ok) {
        let message = t('admin.createError')
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
          ? ((data as { data?: AdminApiItem | null }).data ?? null)
          : null

      const roleName =
        roles.find((role) => Number(role.id) === roleIdNumber)?.name ?? '-'

      const adminRow: AdminRowData = payload
        ? mapAdminApiItemToRow(payload)
        : {
            id: 0,
            username: trimmedUsername || '',
            email: trimmedEmail,
            isActive: true,
            roleName,
            roleId: roleIdNumber,
            createdAt: '',
            updatedAt: '',
            storeLocations: branchOptions.filter((location) => form.storeLocationIds.includes(String(location.id))).map((location) => ({ id: location.id, name: location.name, code: location.code })),
          }

      setForm({ ...initialFormState })
      onSuccess(adminRow)
    } catch (err) {
      console.error(err)
      setError(t('admin.createError'))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <CrmFormModalShell
      title={t('admin.createTitle')}
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
            form="admin-create-form"
            className="px-4 py-2 text-sm text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50"
            disabled={submitting}
          >
            {submitting ? t('common.creating') : t('common.create')}
          </button>
        </>
      }
    >
      <form id="admin-create-form" onSubmit={handleSubmit} className="space-y-4 px-5 py-4">
          <div>
            <label
              htmlFor="email"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              {t('common.email')} <span className="text-red-500">*</span>
            </label>
            <input
              id="email"
              name="email"
              type="email"
              value={form.email}
              onChange={handleChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-blue-500 focus:border-blue-500"
              placeholder={t('common.emailPlaceholder')}
              disabled={submitting}
            />
          </div>

          <div>
            <label
              htmlFor="password"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              {t('common.password')} <span className="text-red-500">*</span>
            </label>
            <input
              id="password"
              name="password"
              type="password"
              value={form.password}
              onChange={handleChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-blue-500 focus:border-blue-500"
              placeholder={t('common.passwordPlaceholder')}
              disabled={submitting}
            />
          </div>
          <div>
            <label
              htmlFor="roleId"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              {t('common.role')}  <span className="text-red-500">*</span>
            </label>
            <select
              id="roleId"
              name="roleId"
              value={form.roleId}
              onChange={handleChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-blue-500 focus:border-blue-500"
              disabled={submitting || rolesLoading}
            >
              <option value="">{t('common.selectRole')}</option>
              {roles.map((role) => (
                <option key={String(role.id)} value={String(role.id ?? '')}>
                  {role.name ?? role.id}
                </option>
              ))}
            </select>
          </div>

          {canAssignBranches && (
            <div>
              <label htmlFor="storeLocationIds" className="block text-sm font-medium text-gray-700 mb-1">
                Branch access
              </label>
              <BranchAccessChecklist
                id="storeLocationIds"
                options={branchOptions}
                selectedIds={form.storeLocationIds}
                onChange={(storeLocationIds) => setForm((previous) => ({ ...previous, storeLocationIds }))}
                disabled={submitting}
              />
              <p className="mt-1 text-xs text-gray-500">Select every Branch this Admin may access. Platform Super Admin users do not require branch rows.</p>
            </div>
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
