import type { MarqueeRowData } from './MarqueeRow'

export type MarqueeApiItem = {
  id: number | string
  text?: string | null
  start_at?: string | null
  end_at?: string | null
  is_active?: boolean | number | string | null
  sort_order?: number | null
  created_at?: string | null
  updated_at?: string | null
}

export const mapMarqueeApiItemToRow = (item: MarqueeApiItem): MarqueeRowData => {
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

  return {
    id: normalizedId,
    text: item.text ?? '-',
    startAt: item.start_at ?? '', // Direct from API
    endAt: item.end_at ?? '', // Direct from API
    isActive,
    sortOrder: item.sort_order ?? null,
    createdAt: item.created_at ?? '', // Direct from API
    updatedAt: item.updated_at ?? '', // Direct from API
  }
}

