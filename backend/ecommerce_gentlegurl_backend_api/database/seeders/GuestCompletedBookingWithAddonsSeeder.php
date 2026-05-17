<?php

namespace Database\Seeders;

use App\Models\Booking\Booking;
use App\Models\Booking\BookingLog;
use App\Models\Booking\BookingService;
use App\Models\Booking\BookingServiceQuestionOption;
use Illuminate\Database\Seeder;
use Illuminate\Support\Carbon;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;

class GuestCompletedBookingWithAddonsSeeder extends Seeder
{
    private const BOOKING_CODE = 'BKG-GUEST-TEOH-ADDONS-20260516';

    public function run(): void
    {
        date_default_timezone_set('Asia/Kuala_Lumpur');

        $staffId = (int) DB::table('staffs')->orderBy('id')->value('id');
        if (! $staffId) {
            $this->command?->warn('No staff found. Run staff seeders first.');

            return;
        }

        $mainService = BookingService::query()
            ->where('name', 'Coloring')
            ->first()
            ?? BookingService::query()->orderBy('id')->first();

        if (! $mainService) {
            $this->command?->warn('No booking service found. Run BookingTestingSeeder first.');

            return;
        }

        $questionOptions = $this->resolveQuestionOptions($mainService);
        $addonItemsJson = $questionOptions
            ->map(fn (BookingServiceQuestionOption $option) => $this->mapOptionToAddonRow($option))
            ->values()
            ->all();

        $addonDurationMin = $this->sumAddonDuration($addonItemsJson);
        $addonPrice = $this->sumAddonPrice($addonItemsJson);
        $totalDurationMin = max(0, (int) $mainService->duration_min) + $addonDurationMin;

        $startAt = Carbon::parse('2026-05-16 14:00:00', 'Asia/Kuala_Lumpur');
        $completedAt = $startAt->copy()->addMinutes($totalDurationMin);
        $endAt = $startAt->copy()->addMinutes($totalDurationMin);

        $booking = Booking::query()->updateOrCreate(
            ['booking_code' => self::BOOKING_CODE],
            [
                'source' => 'GUEST',
                'customer_id' => null,
                'guest_name' => 'TEOH WAI SHEN',
                'guest_phone' => '0124482125',
                'guest_email' => 'waishendev@gmail.com',
                'staff_id' => $staffId,
                'service_id' => $mainService->id,
                'start_at' => $startAt,
                'end_at' => $endAt,
                'buffer_min' => (int) ($mainService->buffer_min ?? 15),
                'addon_duration_min' => $addonDurationMin,
                'addon_price' => $addonPrice,
                'addon_items_json' => $addonItemsJson,
                'status' => 'COMPLETED',
                'deposit_amount' => $mainService->deposit_amount,
                'payment_status' => 'PAID',
                'completed_at' => $completedAt,
                'created_by_staff_id' => $staffId,
                'notes' => 'Guest completed booking with add-ons (16 May 2026)',
            ]
        );

        $this->seedBookingLogs($booking, $staffId, $startAt, $completedAt);

        $this->command?->info(sprintf(
            'Guest completed booking (with add-ons) seeded: %s (id=%d, %d add-on(s), %d min total)',
            $booking->booking_code,
            $booking->id,
            count($addonItemsJson),
            $totalDurationMin
        ));
    }

    private function resolveQuestionOptions(BookingService $mainService): Collection
    {
        $options = BookingServiceQuestionOption::query()
            ->whereHas('question', function ($query) use ($mainService) {
                $query->where('booking_service_id', $mainService->id)
                    ->where('is_active', true);
            })
            ->with('linkedBookingService')
            ->where('is_active', true)
            ->orderBy('sort_order')
            ->orderBy('id')
            ->get();

        if ($options->isNotEmpty()) {
            return $options
                ->unique(fn (BookingServiceQuestionOption $option) => (int) ($option->linked_booking_service_id ?? $option->id))
                ->values();
        }

        return BookingService::query()
            ->whereIn('name', ['Treatment', 'Haircut'])
            ->where('id', '!=', $mainService->id)
            ->orderBy('id')
            ->get()
            ->map(function (BookingService $service, int $index) {
                $option = new BookingServiceQuestionOption([
                    'id' => 9000 + $index,
                    'label' => (string) $service->name,
                    'cn_label' => $service->cn_name,
                    'linked_booking_service_id' => (int) $service->id,
                    'extra_duration_min' => (int) $service->duration_min,
                    'extra_price' => (float) ($service->service_price ?? 0),
                    'is_active' => true,
                ]);
                $option->setRelation('linkedBookingService', $service);

                return $option;
            });
    }

    private function mapOptionToAddonRow(BookingServiceQuestionOption $option): array
    {
        $linked = $option->linkedBookingService;

        return [
            'id' => (int) $option->id,
            'name' => (string) ($option->label ?: $linked?->name ?: 'Add-on'),
            'cn_name' => trim((string) ($option->cn_label ?? '')) !== ''
                ? (string) $option->cn_label
                : $linked?->cn_name,
            'extra_duration_min' => $linked
                ? max(0, (int) ($linked->duration_min ?? 0))
                : max(0, (int) ($option->extra_duration_min ?? 0)),
            'extra_price' => $linked
                ? round(max(0, (float) ($linked->service_price ?? 0)), 2)
                : round(max(0, (float) ($option->extra_price ?? 0)), 2),
            'linked_booking_service_id' => $linked ? (int) $linked->id : null,
            'linked_cn_name' => $linked?->cn_name,
        ];
    }

    private function sumAddonDuration(array $addonItemsJson): int
    {
        return (int) collect($addonItemsJson)
            ->sum(fn (array $item) => max(0, (int) ($item['extra_duration_min'] ?? 0)));
    }

    private function sumAddonPrice(array $addonItemsJson): float
    {
        return round((float) collect($addonItemsJson)
            ->sum(fn (array $item) => max(0, (float) ($item['extra_price'] ?? 0))), 2);
    }

    private function seedBookingLogs(Booking $booking, int $staffId, Carbon $startAt, Carbon $completedAt): void
    {
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
    }
}
