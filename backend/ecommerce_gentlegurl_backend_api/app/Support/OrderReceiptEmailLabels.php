<?php

namespace App\Support;

use App\Models\Ecommerce\Order;

/**
 * Human-readable payment + status lines for POS receipt emails (keep in sync with customer-facing wording).
 */
class OrderReceiptEmailLabels
{
    public static function paymentMethod(Order $order): string
    {
        $raw = strtolower(trim((string) ($order->payment_method ?? '')));
        $gateway = trim((string) ($order->selected_gateway_name ?? ''));

        $withGateway = static fn (string $base) => $gateway !== ''
            ? "{$base} ({$gateway})"
            : $base;

        return match ($raw) {
            'billplz_online_banking' => $withGateway('Online Banking'),
            'billplz_fpx' => $withGateway('Online Banking (FPX)'),
            'billplz_card', 'billplz_credit_card' => $withGateway('Credit Card'),
            'manual_transfer' => self::manualTransferLabel($order),
            'cash' => 'Cash',
            'qrpay' => 'QR Pay',
            'billplz' => 'Billplz',
            '' => '—',
            default => self::fallbackLabel($raw),
        };
    }

    public static function paymentStatus(Order $order): string
    {
        $ps = strtolower(trim((string) ($order->payment_status ?? '')));

        if ($ps === 'paid' || $order->paid_at) {
            return 'Paid ✅';
        }

        return match ($ps) {
            'pending', 'unpaid' => 'Unpaid',
            'failed' => 'Failed',
            'refunded' => 'Refunded',
            'partially_refunded' => 'Partially refunded',
            '' => $order->paid_at ? 'Paid ✅' : '—',
            default => ucfirst(str_replace('_', ' ', $ps)),
        };
    }

    protected static function manualTransferLabel(Order $order): string
    {
        $bank = trim((string) ($order->bankAccount?->bank_name ?? ''));
        if ($bank === '') {
            $bank = trim((string) ($order->bankAccount?->label ?? ''));
        }

        return $bank !== '' ? "Manual Transfer ({$bank})" : 'Manual Transfer';
    }

    protected static function fallbackLabel(string $raw): string
    {
        return str_replace('_', ' ', ucwords($raw, '_'));
    }
}
