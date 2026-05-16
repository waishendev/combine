<?php

namespace Database\Seeders;

use App\Models\Booking\Booking;
use App\Models\Booking\BookingLog;
use App\Models\Booking\BookingService;
use Illuminate\Database\Seeder;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;

class GuestCompletedBookingSeeder extends Seeder
{
    public function run(): void
    {
        date_default_timezone_set('Asia/Kuala_Lumpur');

        $staffId = (int) DB::table('staffs')->orderBy('id')->value('id');
        if (! $staffId) {
            $this->command?->warn('No staff found. Run staff seeders first.');

            return;
        }

        $service = BookingService::query()
            ->where('name', 'Haircut')
            ->first()
            ?? BookingService::query()->orderBy('id')->first();

        if (! $service) {
            $this->command?->warn('No booking service found. Run BookingTestingSeeder first.');

            return;
        }

        $startAt = Carbon::parse('2026-05-16 10:00:00', 'Asia/Kuala_Lumpur');
        $completedAt = Carbon::parse('2026-05-16 11:00:00', 'Asia/Kuala_Lumpur');
        $duration = (int) $service->duration_min;

        $booking = Booking::query()->updateOrCreate(
            ['booking_code' => 'BKG-GUEST-TEOH-20260516'],
            [
                'source' => 'GUEST',
                'customer_id' => null,
                'guest_name' => 'TEOH WAI SHEN',
                'guest_phone' => '0124482125',
                'guest_email' => 'waishendev@gmail.com',
                'staff_id' => $staffId,
                'service_id' => $service->id,
                'start_at' => $startAt,
                'end_at' => $startAt->copy()->addMinutes($duration),
                'buffer_min' => 15,
                'status' => 'COMPLETED',
                'deposit_amount' => $service->deposit_amount,
                'payment_status' => 'PAID',
                'completed_at' => $completedAt,
                'created_by_staff_id' => $staffId,
                'notes' => 'Guest completed booking for feedback email testing (16 May 2026)',
            ]
        );

        if (! BookingLog::query()->where('booking_id', $booking->id)->where('action', 'CREATE_BOOKING')->exists()) {
            BookingLog::query()->create([
                'booking_id' => $booking->id,
                'actor_type' => 'STAFF',
                'actor_id' => $staffId,
                'action' => 'CREATE_BOOKING',
                'meta' => ['status' => 'HOLD'],
                'created_at' => $startAt->copy()->subDay(),
            ]);
        }

        if (! BookingLog::query()->where('booking_id', $booking->id)->where('action', 'UPDATE_STATUS')->exists()) {
            BookingLog::query()->create([
                'booking_id' => $booking->id,
                'actor_type' => 'STAFF',
                'actor_id' => $staffId,
                'action' => 'UPDATE_STATUS',
                'meta' => ['previous_status' => 'HOLD', 'new_status' => 'COMPLETED'],
                'created_at' => $completedAt,
            ]);
        }

        $this->command?->info("Guest completed booking seeded: {$booking->booking_code} (id={$booking->id})");
    }
}
