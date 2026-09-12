<?php

namespace App\Console\Commands;

use App\Mail\BookingFeedbackMail;
use App\Models\Booking\Booking;
use App\Models\Ecommerce\BranchNotificationSetting;
use App\Support\BranchEmailPresentation;
use Illuminate\Console\Command;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Mail;

class SendBookingFeedbackEmails extends Command
{
    protected $signature = 'booking:send-feedback-emails {--force : Skip time check and send immediately}';
    protected $description = 'Send Branch-aware booking feedback emails';

    public function handle(): int
    {
        $now = now();
        $settings = BranchNotificationSetting::query()
            ->with('storeLocation')
            ->where('booking_feedback_enabled', true)
            ->get()
            ->filter(fn (BranchNotificationSetting $setting) => $this->option('force')
                || $this->isDue($now, (string) $setting->booking_feedback_send_at));

        foreach ($settings as $setting) {
            $cacheKey = 'booking_feedback_sent_'.$setting->store_location_id.'_'.$now->toDateString();
            if (! $this->option('force') && Cache::has($cacheKey)) continue;
            if (! $this->option('force')) Cache::put($cacheKey, true, Carbon::tomorrow());
            $this->sendForBranch($setting);
        }
        return self::SUCCESS;
    }

    private function isDue(Carbon $now, string $sendAt): bool
    {
        $scheduled = $now->copy()->startOfDay()->setTimeFromTimeString(substr($sendAt, 0, 5));
        return $now->betweenIncluded($scheduled, $scheduled->copy()->addMinutes(5));
    }

    private function sendForBranch(BranchNotificationSetting $setting): void
    {
        $start = Carbon::yesterday()->startOfDay();
        $end = Carbon::yesterday()->endOfDay();
        $bookings = Booking::query()->with(['service', 'staff', 'customer', 'storeLocation'])
            ->where('store_location_id', $setting->store_location_id)
            ->where('status', 'COMPLETED')
            ->whereBetween('completed_at', [$start, $end])->get();
        $sent = 0;
        foreach ($bookings as $booking) {
            $email = $booking->billing_email ?: $booking->guest_email ?: $booking->customer?->email;
            $guestName = trim((string) ($booking->guest_name ?? ''));
            if (! $email || ! filter_var($email, FILTER_VALIDATE_EMAIL) || str_starts_with(strtoupper($guestName), 'UNKNOWN') || str_ends_with(strtolower($email), '@example.com')) continue;
            $customerName = $booking->billing_name ?: $booking->guest_name ?: $booking->customer?->name ?: 'Customer';
            $addons = collect((array) $booking->addon_items_json)->filter(fn ($item) => is_array($item))->map(fn ($item) => [
                'name' => (string) ($item['name'] ?? $item['label'] ?? 'Add-on'),
                'extra_price' => round((float) ($item['extra_price'] ?? 0), 2),
            ])->values()->all();
            try {
                $phone = (string) ($booking->storeLocation?->phone ?? '');
                $digits = preg_replace('/[^0-9]/', '', $phone);
                if (str_starts_with($digits, '0')) $digits = '60'.substr($digits, 1);
                Mail::to($email)->queue(new BookingFeedbackMail(
                    customerName: $customerName, serviceName: (string) ($booking->service?->name ?? ''), addonItems: $addons,
                    staffName: (string) ($booking->staff?->name ?? ''), appointmentDate: $booking->start_at?->format('l, d M Y') ?? '',
                    appointmentStartTime: $booking->start_at?->format('h:i A') ?? '', appointmentEndTime: $booking->end_at?->format('h:i A') ?? '',
                    durationMin: (int) ($booking->service?->duration_min ?? 0),
                    whatsappUrl: $digits !== '' ? 'https://wa.me/'.$digits.'?text='.rawurlencode('Hi, I would like to share feedback about my recent visit.') : '',
                    contactPhone: $phone, venue: BranchEmailPresentation::from($booking->storeLocation),
                ));
                $sent++;
            } catch (\Throwable $e) {
                Log::error('Failed to queue Branch booking feedback email.', ['booking_id' => $booking->id, 'store_location_id' => $setting->store_location_id, 'error' => $e->getMessage()]);
            }
        }
        $this->info('Feedback emails queued for '.$setting->storeLocation?->name.': '.$sent);
    }
}
