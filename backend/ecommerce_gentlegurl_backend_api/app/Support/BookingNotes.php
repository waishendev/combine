<?php

namespace App\Support;

/**
 * Parse internal booking.notes metadata (guest_token, customer_remarks, etc.).
 */
class BookingNotes
{
    public static function extractGuestToken(?string $notes): ?string
    {
        $raw = trim((string) ($notes ?? ''));
        if ($raw === '') {
            return null;
        }

        if (preg_match('/(?:^|\|\s*)guest_token:([^\s|]+)/i', $raw, $matches)) {
            $token = trim((string) ($matches[1] ?? ''));

            return $token !== '' ? $token : null;
        }

        return null;
    }

    /** Customer-facing remark text only; strips guest_token, void remark, and other system markers. */
    public static function customerRemarksForDisplay(?string $notes): ?string
    {
        $raw = trim((string) ($notes ?? ''));
        if ($raw === '') {
            return null;
        }

        $raw = trim(preg_replace('/\s*\[VOID REMARK\].*$/is', '', $raw) ?? $raw);
        if ($raw === '') {
            return null;
        }

        if (preg_match('/(?:^|\|\s*)customer_remarks:\s*(.+?)(?:\s*\|\s*deposit_waived_for_member\s*)?$/is', $raw, $matches)) {
            $value = trim((string) ($matches[1] ?? ''));
            if ($value !== '') {
                return $value;
            }
        }

        $stripped = preg_replace('/(?:^|\|\s*)guest_token:[^\s|]+/i', '', $raw) ?? $raw;
        $stripped = preg_replace('/(?:^|\|\s*)deposit_waived_for_member/i', '', $stripped) ?? $stripped;
        $stripped = trim(preg_replace('/\s*\|\s*/', ' ', $stripped) ?? $stripped);

        if ($stripped === '' || preg_match('/^(guest_token:|Booking cart checkout|\[VOID REMARK\])/i', $stripped)) {
            return null;
        }

        return $stripped;
    }

    public static function voidRemarksForDisplay(?string $notes): ?string
    {
        $raw = (string) ($notes ?? '');
        if (! preg_match('/\[VOID REMARK\]\s*(.+)/is', $raw, $matches)) {
            return null;
        }

        $value = trim((string) ($matches[1] ?? ''));

        return $value !== '' ? $value : null;
    }
}
