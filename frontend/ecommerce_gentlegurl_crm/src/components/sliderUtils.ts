import type { SliderRowData } from './SliderRow'

export type SliderApiItem = {
  id: number | string
  title?: string | null
  subtitle?: string | null
  image_path?: string | null
  image_url?: string | null
  mobile_image_path?: string | null
  button_label?: string | null
  button_link?: string | null
  start_at?: string | null
  end_at?: string | null
  is_active?: boolean | number | string | null
  sort_order?: number | string | null
  created_at?: string | null
  updated_at?: string | null
}

export const mapSliderApiItemToRow = (item: SliderApiItem): SliderRowData => {
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
    title: item.title ?? '-',
    subtitle: item.subtitle ?? '-',
    image_path: item.image_url ?? item.image_path ?? '',
    mobile_image_path: item.mobile_image_path ?? '',
    button_label: item.button_label ?? '-',
    button_link: item.button_link ?? '-',
    start_at: item.start_at ?? '',
    end_at: item.end_at ?? '',
    isActive,
    sort_order: normalizedSortOrder,
    createdAt: item.created_at ?? '',
    updatedAt: item.updated_at ?? '',
  }
}

