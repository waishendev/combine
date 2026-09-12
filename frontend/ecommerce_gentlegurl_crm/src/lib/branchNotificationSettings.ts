import { apiFetch } from '@/lib/api'

export type BranchNotificationSettings = {
  booking_reminder_enabled: boolean; booking_reminder_send_at: string
  booking_feedback_enabled: boolean; booking_feedback_send_at: string
  booking_payment_proof_enabled: boolean; booking_payment_proof_recipients: string[]
  daily_order_summary_enabled: boolean; daily_order_summary_send_at: string; daily_order_summary_recipients: string[]
  daily_low_stock_enabled: boolean; daily_low_stock_send_at: string; daily_low_stock_recipients: string[]
}
type Response<T> = { data: T | null; message: string | null; success: boolean }

export function normalizeBranchNotificationTime(value: unknown): string {
  if (typeof value !== 'string') return ''

  const match = value.trim().match(/^(\d{1,2}):(\d{2})(?::\d{2})?$/)
  if (!match) return ''

  const hours = Number(match[1])
  const minutes = Number(match[2])
  if (hours > 23 || minutes > 59) return ''

  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`
}

export function normalizeBranchNotificationTimes(settings: BranchNotificationSettings): BranchNotificationSettings {
  return {
    ...settings,
    booking_reminder_send_at: normalizeBranchNotificationTime(settings.booking_reminder_send_at),
    booking_feedback_send_at: normalizeBranchNotificationTime(settings.booking_feedback_send_at),
    daily_order_summary_send_at: normalizeBranchNotificationTime(settings.daily_order_summary_send_at),
    daily_low_stock_send_at: normalizeBranchNotificationTime(settings.daily_low_stock_send_at),
  }
}

export async function getBranchNotificationSettings(id: number, signal?: AbortSignal) {
  const response = await apiFetch<Response<BranchNotificationSettings>>(`/api/proxy/ecommerce/branch-notification-settings?store_location_id=${id}`, { signal })
  return { ...response, data: response.data ? normalizeBranchNotificationTimes(response.data) : null }
}

export async function saveBranchNotificationSettings(id: number, data: BranchNotificationSettings) {
  const normalized = normalizeBranchNotificationTimes(data)
  const response = await apiFetch<Response<BranchNotificationSettings>>(`/api/proxy/ecommerce/branch-notification-settings?store_location_id=${id}`, {
    method: 'PUT',
    body: JSON.stringify(normalized),
  })
  return { ...response, data: response.data ? normalizeBranchNotificationTimes(response.data) : null }
}
