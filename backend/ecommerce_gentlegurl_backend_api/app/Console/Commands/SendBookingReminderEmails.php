<?php

namespace App\Console\Commands;

use App\Mail\BookingReminderMail;
use App\Models\Booking\Booking;
use App\Services\SettingService;
use Illuminate\Console\Command;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Mail;

class SendBookingReminderEmails extends Command
{
    protected $signature = 'booking:send-reminder-emails {--force : Skip time check and send immediately}';
    protected $description = 'Send reminder emails to customers with CONFIRMED bookings scheduled for tomorrow';

    public function handle(): int
    {
        $setting = SettingService::get('booking_reminder_email', ['enabled' => true, 'send_at' => '10:00'], 'booking');

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

            $cacheKey = 'booking_reminder_sent_' . $now->toDateString();
            if (Cache::has($cacheKey)) {
                return self::SUCCESS;
            }

            Cache::put($cacheKey, true, Carbon::tomorrow());
        }

        $tomorrowStart = Carbon::tomorrow()->startOfDay();
        $tomorrowEnd = Carbon::tomorrow()->endOfDay();

        $bookings = Booking::query()
            ->with(['service', 'staff', 'customer'])
            ->where('status', 'CONFIRMED')
            ->whereBetween('start_at', [$tomorrowStart, $tomorrowEnd])
            ->get();

        if ($bookings->isEmpty()) {
            $this->info('No confirmed bookings for tomorrow.');
            return self::SUCCESS;
        }

        $contactPhone = $this->resolveContactPhone();
        $sent = 0;

        foreach ($bookings as $booking) {
            $email = $booking->billing_email
                ?: $booking->guest_email
                ?: $booking->customer?->email;

            if (! $email || ! filter_var($email, FILTER_VALIDATE_EMAIL)) {
                continue;
            }

            $customerName = $booking->billing_name
                ?: $booking->guest_name
                ?: $booking->customer?->name
                ?: 'Customer';

            $addonItems = collect(is_array($booking->addon_items_json) ? $booking->addon_items_json : [])
                ->map(fn ($item) => is_array($item) ? [
                    'name' => (string) ($item['name'] ?? $item['label'] ?? 'Add-on'),
                    'extra_price' => round((float) ($item['extra_price'] ?? 0), 2),
                ] : null)
                ->filter()
                ->values()
                ->all();

            try {
                Mail::to($email)->queue(new BookingReminderMail(
                    customerName: $customerName,
                    serviceName: (string) ($booking->service?->name ?? 'Service'),
                    addonItems: $addonItems,
                    staffName: (string) ($booking->staff?->name ?? ''),
                    appointmentDate: $booking->start_at->format('l, d M Y'),
                    appointmentStartTime: $booking->start_at->format('h:i A'),
                    appointmentEndTime: $booking->end_at ? $booking->end_at->format('h:i A') : '—',
                    durationMin: (int) ($booking->service?->duration_min ?? 0),
                    contactPhone: $contactPhone,
                ));
                $sent++;
            } catch (\Throwable $e) {
                Log::error('Failed to queue booking reminder email.', [
                    'booking_id' => $booking->id,
                    'error' => $e->getMessage(),
                ]);
            }
        }

        $this->info("Reminder emails queued: {$sent} / {$bookings->count()}");

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
}
