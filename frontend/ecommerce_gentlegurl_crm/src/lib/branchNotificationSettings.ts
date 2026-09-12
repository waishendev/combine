import { apiFetch } from '@/lib/api'

export type BranchNotificationSettings = {
  booking_reminder_enabled: boolean; booking_reminder_send_at: string
  booking_feedback_enabled: boolean; booking_feedback_send_at: string
  booking_payment_proof_enabled: boolean; booking_payment_proof_recipients: string[]
  daily_order_summary_enabled: boolean; daily_order_summary_send_at: string; daily_order_summary_recipients: string[]
  daily_low_stock_enabled: boolean; daily_low_stock_send_at: string; daily_low_stock_recipients: string[]
}
type Response<T> = { data: T | null; message: string | null; success: boolean }
export const getBranchNotificationSettings = (id: number) => apiFetch<Response<BranchNotificationSettings>>(`/api/proxy/ecommerce/branch-notification-settings?store_location_id=${id}`)
export const saveBranchNotificationSettings = (id: number, data: BranchNotificationSettings) => apiFetch<Response<BranchNotificationSettings>>(`/api/proxy/ecommerce/branch-notification-settings?store_location_id=${id}`, { method: 'PUT', body: JSON.stringify(data) })
