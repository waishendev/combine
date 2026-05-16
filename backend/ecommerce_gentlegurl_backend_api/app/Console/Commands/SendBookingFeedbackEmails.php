<?php

namespace App\Console\Commands;

use App\Mail\BookingFeedbackMail;
use App\Models\Booking\Booking;
use App\Services\SettingService;
use Illuminate\Console\Command;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Mail;

class SendBookingFeedbackEmails extends Command
{
    protected $signature = 'booking:send-feedback-emails {--force : Skip time check and send immediately}';
    protected $description = 'Send feedback emails to customers whose bookings were completed yesterday';

    public function handle(): int
    {
        $setting = SettingService::get('booking_feedback_email', ['enabled' => true, 'send_at' => '10:00'], 'booking');

        if (! ($setting['enabled'] ?? true)) {
            return self::SUCCESS;
        }

        $force = $this->option('force');

        if (! $force) {
            $sendAt = $setting['send_at'] ?? '10:00';
            $now = now();
            $scheduledTime = Carbon::today()->setTimeFromTimeString($sendAt);

            if ($now->lt($scheduledTime) || $now->gt($scheduledTime->copy()->addMinutes(5))) {
                return self::SUCCESS;
            }

            $cacheKey = 'booking_feedback_sent_' . $now->toDateString();
            if (Cache::has($cacheKey)) {
                return self::SUCCESS;
            }

            Cache::put($cacheKey, true, Carbon::tomorrow());
        }

        $yesterdayStart = Carbon::yesterday()->startOfDay();
        $yesterdayEnd = Carbon::yesterday()->endOfDay();

        $bookings = Booking::query()
            ->with(['service', 'staff', 'customer'])
            ->where('status', 'COMPLETED')
            ->whereBetween('completed_at', [$yesterdayStart, $yesterdayEnd])
            ->get();

        if ($bookings->isEmpty()) {
            $this->info('No completed bookings from yesterday.');
            return self::SUCCESS;
        }

        $contactPhone = $this->resolveContactPhone();
        $whatsappUrl = $this->buildWhatsappUrl($contactPhone);
        $sent = 0;

        foreach ($bookings as $booking) {
            $email = $booking->billing_email
                ?: $booking->guest_email
                ?: $booking->customer?->email;

            $guestName = trim((string) ($booking->guest_name ?? ''));
            if (! $email || ! filter_var($email, FILTER_VALIDATE_EMAIL) || strtoupper($guestName) === 'UNKNOWN') {
                continue;
            }

            $customerName = $booking->billing_name
                ?: $booking->guest_name
                ?: $booking->customer?->name
                ?: 'Customer';

            try {
                Mail::to($email)->queue(new BookingFeedbackMail(
                    customerName: $customerName,
                    serviceName: (string) ($booking->service?->name ?? ''),
                    staffName: (string) ($booking->staff?->name ?? ''),
                    appointmentDate: $booking->start_at ? $booking->start_at->format('l, d M Y') : '',
                    whatsappUrl: $whatsappUrl,
                    contactPhone: $contactPhone,
                ));
                $sent++;
            } catch (\Throwable $e) {
                Log::error('Failed to queue booking feedback email.', [
                    'booking_id' => $booking->id,
                    'error' => $e->getMessage(),
                ]);
            }
        }

        $this->info("Feedback emails queued: {$sent} / {$bookings->count()}");

        return self::SUCCESS;
    }

    private function resolveContactPhone(): string
    {
        $widget = SettingService::get('shop_contact_widget', null, 'booking');
        $phone = data_get($widget, 'whatsapp.phone');

        if ($phone && is_string($phone) && trim($phone) !== '') {
            return trim($phone);
        }

        return '010-387 0881';
    }

    private function buildWhatsappUrl(string $phone): string
    {
        $digits = preg_replace('/[^0-9]/', '', $phone);

        if (str_starts_with($digits, '0')) {
            $digits = '60' . substr($digits, 1);
        }

        $widget = SettingService::get('shop_contact_widget', null, 'booking');
        $defaultMsg = data_get($widget, 'whatsapp.default_message');
        $message = ($defaultMsg && is_string($defaultMsg) && trim($defaultMsg) !== '')
            ? trim($defaultMsg)
            : 'Hi, I would like to share some feedback about my recent visit.';

        return 'https://wa.me/' . $digits . '?text=' . rawurlencode($message);
    }
}
