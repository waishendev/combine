import type { BankAccountRowData } from './BankAccountRow'

export type BankAccountApiItem = {
  id: number | string
  label?: string | null
  bank_name?: string | null
  account_name?: string | null
  account_number?: string | null
  branch?: string | null
  swift_code?: string | null
  logo_path?: string | null
  logo_url?: string | null
  qr_image_path?: string | null
  qr_image_url?: string | null
  is_active?: boolean | number | string | null
  is_default?: boolean | number | string | null
  sort_order?: number | string | null
  instructions?: string | null
  created_at?: string | null
  updated_at?: string | null
}

export const mapBankAccountApiItemToRow = (item: BankAccountApiItem): BankAccountRowData => {
  const idValue =
    typeof item.id === 'number'
      ? item.id
      : Number(item.id) || Number.parseInt(String(item.id), 10)
  const normalizedId = Number.isFinite(idValue) ? Number(idValue) : 0

  const isActiveValue = item.is_active
  const isActive =
    isActiveValue === true ||
    isActiveValue === 'true' ||
    isActiveValue === '1' ||
    isActiveValue === 1

  const isDefaultValue = item.is_default
  const isDefault =
    isDefaultValue === true ||
    isDefaultValue === 'true' ||
    isDefaultValue === '1' ||
    isDefaultValue === 1

  const sortOrderValue = item.sort_order
  let normalizedSortOrder: number | null = null
  if (typeof sortOrderValue === 'number') {
    normalizedSortOrder = sortOrderValue
  } else if (sortOrderValue != null) {
    const parsed = Number(sortOrderValue)
    normalizedSortOrder = Number.isFinite(parsed) ? parsed : null
  }

  return {
    id: normalizedId,
    label: item.label ?? '',
    bank_name: item.bank_name ?? '',
    account_name: item.account_name ?? '',
    account_number: item.account_number ?? '',
    branch: item.branch ?? null,
    swift_code: item.swift_code ?? null,
    logo_url: item.logo_url ?? item.logo_path ?? '',
    qr_image_url: item.qr_image_url ?? item.qr_image_path ?? null,
    isActive,
    isDefault,
    sort_order: normalizedSortOrder,
    instructions: item.instructions ?? null,
    createdAt: item.created_at ?? '',
    updatedAt: item.updated_at ?? '',
  }
}

