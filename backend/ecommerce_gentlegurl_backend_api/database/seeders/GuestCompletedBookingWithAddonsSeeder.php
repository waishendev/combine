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
        $extraMainServices = BookingService::query()
            ->whereIn('name', ['Treatment', 'Haircut'])
            ->where('id', '!=', $mainService->id)
            ->orderBy('id')
            ->get();

        $addonItemsJson = $this->buildAddonItemsJson($mainService, $questionOptions, $extraMainServices);
        $addonDurationMin = $this->sumTopLevelAddonDuration($addonItemsJson);
        $addonPrice = $this->sumTopLevelAddonPrice($addonItemsJson);
        $totalDurationMin = $this->calculateTotalDurationMin($mainService, $addonItemsJson);

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
                'notes' => 'Guest completed booking with add-ons and extra services (16 May 2026)',
            ]
        );

        $this->seedBookingLogs($booking, $staffId, $startAt, $completedAt);

        $addonCount = collect($addonItemsJson)
            ->filter(fn (array $item) => strtolower((string) ($item['item_kind'] ?? 'addon')) !== 'main_service')
            ->count();

        $this->command?->info(sprintf(
            'Guest completed booking (with add-ons) seeded: %s (id=%d, %d add-on rows, %d min total)',
            $booking->booking_code,
            $booking->id,
            $addonCount,
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

    private function buildAddonItemsJson(
        BookingService $mainService,
        Collection $questionOptions,
        Collection $extraMainServices
    ): array {
        $primaryAddons = $questionOptions
            ->map(fn (BookingServiceQuestionOption $option) => $this->mapOptionToAddonRow($option))
            ->values()
            ->all();

        $rows = [[
            'item_kind' => 'main_service',
            'id' => 'main_service_1',
            'name' => (string) $mainService->name,
            'cn_name' => $mainService->cn_name,
            'extra_duration_min' => max(0, (int) $mainService->duration_min),
            'extra_price' => round(max(0, (float) ($mainService->service_price ?? 0)), 2),
            'linked_booking_service_id' => (int) $mainService->id,
            'is_original' => true,
            'addon_items' => array_slice($primaryAddons, 0, 2),
        ]];

        foreach (array_slice($primaryAddons, 0, 2) as $addonRow) {
            $rows[] = $addonRow;
        }

        foreach (array_slice($primaryAddons, 2) as $addonRow) {
            $rows[] = $addonRow;
        }

        foreach ($extraMainServices as $index => $service) {
            $rows[] = [
                'item_kind' => 'main_service',
                'id' => 'main_service_' . ($index + 2),
                'name' => (string) $service->name,
                'cn_name' => $service->cn_name,
                'extra_duration_min' => max(0, (int) $service->duration_min),
                'extra_price' => round(max(0, (float) ($service->service_price ?? 0)), 2),
                'linked_booking_service_id' => (int) $service->id,
                'is_original' => false,
                'addon_items' => [],
            ];
        }

        return array_values($rows);
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
            'linked_service_type' => $linked ? (string) $linked->service_type : null,
            'linked_deposit_amount' => $linked
                ? round(max(0, (float) ($linked->deposit_amount ?? 0)), 2)
                : null,
        ];
    }

    private function sumTopLevelAddonDuration(array $addonItemsJson): int
    {
        return (int) collect($addonItemsJson)
            ->filter(fn (array $item) => strtolower((string) ($item['item_kind'] ?? 'addon')) !== 'main_service')
            ->sum(fn (array $item) => max(0, (int) ($item['extra_duration_min'] ?? 0)));
    }

    private function sumTopLevelAddonPrice(array $addonItemsJson): float
    {
        return round((float) collect($addonItemsJson)
            ->filter(fn (array $item) => strtolower((string) ($item['item_kind'] ?? 'addon')) !== 'main_service')
            ->sum(fn (array $item) => max(0, (float) ($item['extra_price'] ?? 0))), 2);
    }

    private function calculateTotalDurationMin(BookingService $mainService, array $addonItemsJson): int
    {
        $items = collect($addonItemsJson);
        $baseDurationMin = max(0, (int) $mainService->duration_min);

        $extraMainDurationMin = (int) $items
            ->filter(fn (array $item) => strtolower((string) ($item['item_kind'] ?? '')) === 'main_service')
            ->filter(fn (array $item) => ! (bool) ($item['is_original'] ?? false))
            ->filter(fn (array $item) => (int) ($item['linked_booking_service_id'] ?? 0) !== (int) $mainService->id)
            ->sum(fn (array $item) => max(0, (int) ($item['extra_duration_min'] ?? 0)));

        $topLevelAddonDurationMin = (int) $items
            ->filter(fn (array $item) => strtolower((string) ($item['item_kind'] ?? 'addon')) !== 'main_service')
            ->sum(fn (array $item) => max(0, (int) ($item['extra_duration_min'] ?? 0)));

        $nestedAddonDurationMin = (int) $items
            ->filter(fn (array $item) => strtolower((string) ($item['item_kind'] ?? '')) === 'main_service')
            ->filter(fn (array $item) => ! (bool) ($item['is_original'] ?? false))
            ->filter(fn (array $item) => (int) ($item['linked_booking_service_id'] ?? 0) !== (int) $mainService->id)
            ->sum(fn (array $item) => collect($item['addon_items'] ?? [])
                ->sum(fn ($addon) => max(0, (int) (is_array($addon) ? ($addon['extra_duration_min'] ?? 0) : 0))));

        return $baseDurationMin + $extraMainDurationMin + $topLevelAddonDurationMin + $nestedAddonDurationMin;
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
