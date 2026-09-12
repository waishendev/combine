import assert from 'node:assert/strict'
import test from 'node:test'

import {
  normalizeBranchNotificationTime,
  normalizeBranchNotificationTimes,
  type BranchNotificationSettings,
} from './branchNotificationSettings'

const settings: BranchNotificationSettings = {
  booking_reminder_enabled: true,
  booking_reminder_send_at: '09:00:00',
  booking_feedback_enabled: true,
  booking_feedback_send_at: '10:00:00',
  booking_payment_proof_enabled: true,
  booking_payment_proof_recipients: ['branch@example.com'],
  daily_order_summary_enabled: true,
  daily_order_summary_send_at: '17:30:00',
  daily_order_summary_recipients: ['branch@example.com'],
  daily_low_stock_enabled: true,
  daily_low_stock_send_at: '22:05:00',
  daily_low_stock_recipients: ['branch@example.com'],
}

test('normalizes database time values to strict HH:mm without timezone conversion', () => {
  assert.equal(normalizeBranchNotificationTime('10:00:00'), '10:00')
  assert.equal(normalizeBranchNotificationTime('9:05'), '09:05')
  assert.equal(normalizeBranchNotificationTime('17:30'), '17:30')
})

test('normalizes every Branch notification schedule before API serialization', () => {
  const normalized = normalizeBranchNotificationTimes(settings)
  assert.deepEqual({
    booking_reminder_send_at: normalized.booking_reminder_send_at,
    booking_feedback_send_at: normalized.booking_feedback_send_at,
    daily_order_summary_send_at: normalized.daily_order_summary_send_at,
    daily_low_stock_send_at: normalized.daily_low_stock_send_at,
  }, {
    booking_reminder_send_at: '09:00',
    booking_feedback_send_at: '10:00',
    daily_order_summary_send_at: '17:30',
    daily_low_stock_send_at: '22:05',
  })
})
