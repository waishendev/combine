<?php

namespace App\Services\Booking;

use App\Mail\BookingConfirmationMail;
use App\Models\Booking\Booking;
use App\Models\Booking\BookingLog;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Mail;

class BookingConfirmationEmailService
{
    public function sendForBooking(Booking $booking, ?string $paymentMethod = null): bool
    {
        $booking->loadMissing(['customer', 'service', 'staff']);

        $email = (string) ($booking->billing_email ?: $booking->guest_email ?: $booking->customer?->email ?: '');
        if ($email === '') {
            Log::info('Booking confirmation email skipped: no recipient email.', [
                'booking_id' => $booking->id,
                'booking_code' => $booking->booking_code,
            ]);
            return false;
        }

        if (! $this->isEligibleForConfirmationEmail($booking)) {
            Log::info('Booking confirmation email skipped: booking is not fully paid/confirmed.', [
                'booking_id' => $booking->id,
                'booking_status' => $booking->status,
                'payment_status' => $booking->payment_status,
            ]);
            return false;
        }

        $existingLog = BookingLog::query()
            ->where('booking_id', (int) $booking->id)
            ->where('action', 'BOOKING_CONFIRMATION_EMAIL_SENT')
            ->exists();

        if ($existingLog) {
            Log::info('Booking confirmation email skipped: duplicate prevented.', [
                'booking_id' => $booking->id,
                'booking_code' => $booking->booking_code,
            ]);
            return false;
        }

        $customerName = (string) ($booking->billing_name ?: $booking->guest_name ?: $booking->customer?->name ?: 'Customer');
        $serviceName = (string) ($booking->service?->name ?: 'Booking Service');
        $addons = collect($booking->addon_items_json ?? [])
            ->map(fn ($item) => (string) data_get($item, 'name', data_get($item, 'label', '')))
            ->filter()
            ->values()
            ->all();

        $paymentMethodLabel = $this->mapPaymentMethodLabel($paymentMethod);

        Mail::to($email)->queue(new BookingConfirmationMail(
            customerName: $customerName,
            bookingNumber: (string) ($booking->booking_code ?: $booking->id),
            services: [$serviceName],
            addons: $addons,
            staffName: $booking->staff?->name,
            bookingDate: optional($booking->start_at)->format('Y-m-d'),
            bookingTime: optional($booking->start_at)->format('H:i'),
            branchName: null,
            paymentMethod: $paymentMethodLabel,
            totalAmountPaid: (float) $booking->deposit_amount,
            bookingStatus: (string) ($booking->status ?? 'CONFIRMED'),
            paymentStatusMessage: 'Payment successful',
        ));

        BookingLog::create([
            'booking_id' => (int) $booking->id,
            'actor_type' => 'SYSTEM',
            'actor_id' => null,
            'action' => 'BOOKING_CONFIRMATION_EMAIL_SENT',
            'meta' => [
                'email' => $email,
                'payment_method' => $paymentMethod,
            ],
            'created_at' => now(),
        ]);

        Log::info('Booking confirmation email queued.', [
            'booking_id' => $booking->id,
            'booking_code' => $booking->booking_code,
            'email' => $email,
        ]);

        return true;
    }

    private function isEligibleForConfirmationEmail(Booking $booking): bool
    {
        return strtoupper((string) $booking->payment_status) === 'PAID'
            && strtoupper((string) $booking->status) === 'CONFIRMED';
    }

    private function mapPaymentMethodLabel(?string $paymentMethod): string
    {
        return match ((string) $paymentMethod) {
            'billplz_online_banking', 'billplz_fpx' => 'Billplz Online Banking',
            'billplz_credit_card', 'billplz_card' => 'Billplz Credit/Debit Card',
            'cash' => 'Cash',
            'manual_transfer' => 'Manual Transfer',
            'qrpay' => 'QR Pay',
            default => $paymentMethod ?: 'Payment',
        };
    }
}
