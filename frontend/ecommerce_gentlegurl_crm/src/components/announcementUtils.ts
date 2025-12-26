import type { AnnouncementRowData } from './AnnouncementRow'

export type AnnouncementApiItem = {
  id: number | string
  key?: string | null
  title?: string | null
  subtitle?: string | null
  body_text?: string | null
  image_path?: string | null
  image_url?: string | null
  button_label?: string | null
  button_link?: string | null
  is_active?: boolean | number | string | null
  start_at?: string | null
  end_at?: string | null
  show_once_per_session?: boolean | number | string | null
  sort_order?: number | string | null
  created_at?: string | null
  updated_at?: string | null
}

export const mapAnnouncementApiItemToRow = (item: AnnouncementApiItem): AnnouncementRowData => {
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

  const showOncePerSessionValue = item.show_once_per_session
  const showOncePerSession =
    showOncePerSessionValue === true ||
    showOncePerSessionValue === 'true' ||
    showOncePerSessionValue === '1' ||
    showOncePerSessionValue === 1

  const sortOrderValue = item.sort_order
  const sortOrder =
    typeof sortOrderValue === 'number'
      ? sortOrderValue
      : Number(sortOrderValue) || 0

  return {
    id: normalizedId,
    key: item.key ?? '-',
    title: item.title ?? '-',
    subtitle: item.subtitle ?? '-',
    bodyText: item.body_text ?? '-',
    imagePath: item.image_path ?? item.image_url ?? '-',
    imageUrl: item.image_url ?? item.image_path ?? '-',
    buttonLabel: item.button_label ?? '-',
    buttonLink: item.button_link ?? '-',
    isActive,
    startAt: item.start_at ?? '', // Direct from API
    endAt: item.end_at ?? '', // Direct from API
    showOncePerSession,
    sortOrder,
    createdAt: item.created_at ?? '', // Direct from API
    updatedAt: item.updated_at ?? '', // Direct from API
    formattedStartAt: item.start_at ?? '', // Direct from API (no longer formatted)
    formattedEndAt: item.end_at ?? '', // Direct from API (no longer formatted)
    formattedCreatedAt: item.created_at ?? '', // Direct from API (no longer formatted)
    formattedUpdatedAt: item.updated_at ?? '', // Direct from API (no longer formatted)
  }
}

