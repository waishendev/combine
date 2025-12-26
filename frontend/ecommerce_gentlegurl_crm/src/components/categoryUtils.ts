import type { CategoryRowData } from './CategoryRow'

export type CategoryApiMenu = {
  id?: number | string | null
  name?: string | null
  slug?: string | null
}

export type CategoryApiItem = {
  id: number | string
  parent_id?: number | string | null
  name?: string | null
  slug?: string | null
  description?: string | null
  meta_title?: string | null
  meta_description?: string | null
  meta_keywords?: string | null
  meta_og_image?: string | null
  is_active?: boolean | number | string | null
  sort_order?: number | string | null
  menu_ids?: (number | string)[] | null
  menus?: CategoryApiMenu[] | null
  children?: CategoryApiItem[] | null
  created_at?: string | null
  updated_at?: string | null
}

export const mapCategoryApiItemToRow = (item: CategoryApiItem): CategoryRowData => {
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

  const menuNames = Array.isArray(item.menus)
    ? item.menus.map((menu) => menu?.name).filter(Boolean).join(', ')
    : '-'

  return {
    id: normalizedId,
    name: item.name ?? '-',
    slug: item.slug ?? '-',
    description: item.description ?? '-',
    metaTitle: item.meta_title ?? '-',
    metaDescription: item.meta_description ?? '-',
    metaKeywords: item.meta_keywords ?? '-',
    metaOgImage: item.meta_og_image ?? '-',
    isActive,
    sortOrder: typeof item.sort_order === 'number' ? item.sort_order : (item.sort_order ? Number(item.sort_order) : 0),
    menuIds: Array.isArray(item.menu_ids) ? item.menu_ids.map(id => typeof id === 'number' ? id : Number(id)).filter(id => Number.isFinite(id)) : [],
    menuNames,
    createdAt: item.created_at ?? '',
    updatedAt: item.updated_at ?? '',
  }
}

