<?php

namespace App\Services\Booking;

use App\Models\Booking\Booking;
use App\Models\Booking\BookingBlock;
use App\Models\Booking\BookingCartItem;
use App\Models\Booking\BookingService;
use App\Models\Booking\BookingStaffSchedule;
use App\Models\Booking\BookingStaffTimeoff;
use Carbon\Carbon;
use Carbon\CarbonPeriod;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Facades\Log;

class BookingAvailabilityService
{
    /**
     * @return array<int, array{
     *   start_at:string,
     *   end_at:string,
     *   is_available:bool,
     *   slot_kind?:string,
     *   configured_primary_time?:string|null,
     *   matched_primary_time?:string|null,
     *   is_primary?:bool,
     *   is_fallback?:bool
     * }>
     */
    public function getAvailableSlots(BookingService $service, int $staffId, string $date, int $stepMin = 15, int $extraDurationMin = 0, bool $applyPrimarySlotPolicy = true): array
    {
        $timezone = (string) config('app.timezone', 'Asia/Kuala_Lumpur');
        $day = Carbon::parse($date, $timezone);
        $schedule = BookingStaffSchedule::where('staff_id', $staffId)
            ->where('day_of_week', $day->dayOfWeek)
            ->first();

        if (!$schedule) {
            return [];
        }

        $startWindow = Carbon::parse($day->toDateString() . ' ' . $schedule->start_time, $timezone);
        $endWindow = Carbon::parse($day->toDateString() . ' ' . $schedule->end_time, $timezone);
        $nowInBusinessTz = Carbon::now($timezone);
        $isTodayInBusinessTz = $day->isSameDay($nowInBusinessTz);
        $durationMin = (int) $service->duration_min + max(0, $extraDurationMin);
        $bufferMin = (int) $service->buffer_min;

        if ($durationMin <= 0) {
            return [];
        }

        $slots = [];
        $period = CarbonPeriod::create($startWindow, $stepMin . ' minutes', $endWindow->copy()->subMinutes($durationMin));

        foreach ($period as $candidateStart) {
            if ($isTodayInBusinessTz && $candidateStart->lessThanOrEqualTo($nowInBusinessTz)) {
                continue;
            }

            $candidateEnd = $candidateStart->copy()->addMinutes($durationMin);
            if ($this->hitsBreak($schedule->break_start, $schedule->break_end, $day, $candidateStart, $candidateEnd)) {
                continue;
            }

            if ($this->hasConflict($staffId, $candidateStart, $candidateEnd, $bufferMin)) {
                continue;
            }

            $slots[] = [
                'start_at' => $candidateStart->toIso8601String(),
                'end_at' => $candidateEnd->toIso8601String(),
                'is_available' => true,
            ];
        }

        if ($applyPrimarySlotPolicy) {
            $slots = $this->applyPrimarySlotDisplayPolicy($service, $slots);
        }

        return $slots;
    }

    /**
     * @param array<int, array{start_at:string,end_at:string,is_available:bool}> $slots
     * @return array<int, array{start_at:string,end_at:string,is_available:bool}>
     */
    private function applyPrimarySlotDisplayPolicy(BookingService $service, array $slots): array
    {
        $primaryTimes = $service->primarySlots()
            ->where('is_active', true)
            ->orderBy('sort_order')
            ->orderBy('start_time')
            ->pluck('start_time')
            ->map(fn ($time) => substr((string) $time, 0, 5))
            ->filter()
            ->values();

        if (empty($slots)) {
            return $slots;
        }

        if ($primaryTimes->isEmpty()) {
            return array_map(function (array $slot): array {
                $slot['slot_kind'] = 'standard';
                $slot['configured_primary_time'] = null;
                $slot['matched_primary_time'] = null;
                $slot['is_primary'] = false;
                $slot['is_fallback'] = false;

                return $slot;
            }, $slots);
        }

        $remaining = array_values($slots);
        $visible = [];

        foreach ($primaryTimes as $time) {
            $candidateIndex = null;
            foreach ($remaining as $index => $slot) {
                $slotTime = Carbon::parse($slot['start_at'])->format('H:i');
                if ($slotTime === $time) {
                    $candidateIndex = $index;
                    break;
                }
            }

            if ($candidateIndex === null) {
                foreach ($remaining as $index => $slot) {
                    $slotTime = Carbon::parse($slot['start_at'])->format('H:i');
                    if ($slotTime >= $time) {
                        $candidateIndex = $index;
                        break;
                    }
                }
            }

            if ($candidateIndex !== null) {
                $selected = $remaining[$candidateIndex];
                $selectedTime = Carbon::parse($selected['start_at'])->format('H:i');

                $selected['configured_primary_time'] = $time;
                $selected['matched_primary_time'] = $selectedTime;
                $selected['is_primary'] = $selectedTime === $time;
                $selected['is_fallback'] = $selectedTime !== $time;
                $selected['slot_kind'] = $selectedTime === $time ? 'primary' : 'fallback';

                $visible[] = $selected;
                array_splice($remaining, $candidateIndex, 1);
            }
        }

        return $visible;
    }

    public function hasConflict(int $staffId, Carbon $startAt, Carbon $endAt, int $bufferMin, ?int $ignoreBookingId = null, ?Booking $ignoreBooking = null): bool
    {
        return $this->getConflictDiagnostics($staffId, $startAt, $endAt, $bufferMin, $ignoreBookingId, $ignoreBooking)['has_conflict'];
    }

    protected function businessTimezone(): string
    {
        return (string) config('app.timezone', 'Asia/Kuala_Lumpur');
    }

    protected function normalizeForStorage(Carbon $value): Carbon
    {
        return $value->copy()->setTimezone($this->businessTimezone());
    }

    /** Apply the canonical appointment overlap rule: existing_start < new_end AND existing_end > new_start. */
    protected function whereOverlaps(Builder $query, Carbon $startAt, Carbon $endAt, string $startColumn = 'start_at', string $endColumn = 'end_at'): Builder
    {
        $start = $this->normalizeForStorage($startAt)->toDateTimeString();
        $end = $this->normalizeForStorage($endAt)->toDateTimeString();

        return $query->where($startColumn, '<', $end)
            ->where($endColumn, '>', $start);
    }

    /**
     * Return exact conflict sources for appointment availability checks.
     *
     * The optional ignored booking is the booking currently being edited/rescheduled. Its own row,
     * same-code sibling rows, and matching stale cart holds are ignored; every other overlapping
     * booking/cart/time-off/block still blocks.
     *
     * @return array{
     *   has_conflict:bool,
     *   current_booking_id:int|null,
     *   current_appointment_id:int|null,
     *   staff_id:int,
     *   requested_start:string,
     *   requested_end:string,
     *   block_end:string,
     *   ignored_booking_ids:array<int,int>,
     *   ignored_booking_code:string|null,
     *   conflicting_appointment_ids:array<int,int>,
     *   conflicting_booking_ids:array<int,int>,
     *   conflicting_booking_codes:array<int,string>,
     *   conflicting_cart_item_ids:array<int,int>,
     *   detected_leave_ids:array<int,int>,
     *   detected_block_ids:array<int,int>
     * }
     */
    public function getConflictDiagnostics(int $staffId, Carbon $startAt, Carbon $endAt, int $bufferMin, ?int $ignoreBookingId = null, ?Booking $ignoreBooking = null): array
    {
        $blockEnd = $endAt->copy()->addMinutes($bufferMin);
        $queryStartAt = $this->normalizeForStorage($startAt);
        $queryEndAt = $this->normalizeForStorage($endAt);
        $queryBlockEndAt = $this->normalizeForStorage($blockEnd);
        $ignoreBookingIds = collect([$ignoreBookingId, $ignoreBooking?->id])
            ->filter(fn ($id) => $id !== null && (int) $id > 0)
            ->map(fn ($id) => (int) $id)
            ->unique()
            ->values()
            ->all();
        $ignoreBookingCode = trim((string) ($ignoreBooking?->booking_code ?? ''));
        $ignoreStartAt = $ignoreBooking?->start_at ? $ignoreBooking->start_at->toDateTimeString() : null;
        $ignoreServiceId = (int) ($ignoreBooking?->service_id ?? 0);

        $bookingConflicts = Booking::where('staff_id', $staffId)
            ->when(! empty($ignoreBookingIds), fn ($query) => $query->whereNotIn('id', $ignoreBookingIds))
            ->when($ignoreBookingCode !== '', function ($query) use ($ignoreBookingCode) {
                $query->where(function ($nested) use ($ignoreBookingCode) {
                    $nested->whereNull('booking_code')
                        ->orWhere('booking_code', '')
                        ->orWhere('booking_code', '!=', $ignoreBookingCode);
                });
            })
            ->where(function ($query) {
                $query->whereIn('status', ['HOLD', 'CONFIRMED', 'PENDING'])
                    ->orWhere(function ($completed) {
                        $completed->where('status', 'COMPLETED')
                            ->where(function ($payment) {
                                $payment->whereNull('payment_status')
                                    ->orWhere('payment_status', '!=', 'PAID');
                            });
                    });
            })
            ->where('start_at', '<', $queryBlockEndAt->toDateTimeString())
            ->get(['id', 'booking_code', 'start_at', 'end_at', 'buffer_min', 'status', 'payment_status'])
            ->filter(function (Booking $candidate) use ($queryStartAt) {
                $candidateBufferedEnd = $candidate->end_at
                    ? $this->normalizeForStorage($candidate->end_at)->addMinutes(max(0, (int) ($candidate->buffer_min ?? 0)))
                    : null;

                return $candidateBufferedEnd !== null && $candidateBufferedEnd->gt($queryStartAt);
            })
            ->values();

        $cartConflicts = BookingCartItem::where('staff_id', $staffId)
            ->where('status', 'active')
            ->where('expires_at', '>', now())
            ->when($ignoreBooking !== null && $ignoreStartAt && $ignoreServiceId > 0, function ($query) use ($ignoreStartAt, $ignoreServiceId) {
                // Stale active cart holds from the original booking flow can keep the old range.
                // Exclude only the hold that matches this same booking's staff/service/start;
                // different starts/services remain real conflicts.
                $query->where(function ($nested) use ($ignoreStartAt, $ignoreServiceId) {
                    $nested->where('service_id', '!=', $ignoreServiceId)
                        ->orWhere('start_at', '!=', $ignoreStartAt);
                });
            })
            ->where(function ($query) use ($queryStartAt, $queryBlockEndAt) {
                $this->whereOverlaps($query, $queryStartAt, $queryBlockEndAt);
            })
            ->get(['id', 'start_at', 'end_at', 'service_id', 'status'])
            ->map(fn (BookingCartItem $item) => [
                'id' => (int) $item->id,
                'service_id' => (int) ($item->service_id ?? 0),
                'start_at' => optional($item->start_at)?->toDateTimeString(),
                'end_at' => optional($item->end_at)?->toDateTimeString(),
                'status' => (string) ($item->status ?? ''),
            ])
            ->values()
            ->all();

        $timeoffConflicts = BookingStaffTimeoff::where('staff_id', $staffId)
            ->where(function ($query) use ($queryStartAt, $queryBlockEndAt) {
                $this->whereOverlaps($query, $queryStartAt, $queryBlockEndAt);
            })
            ->get(['id', 'start_at', 'end_at'])
            ->map(fn (BookingStaffTimeoff $timeoff) => [
                'id' => (int) $timeoff->id,
                'start_at' => optional($timeoff->start_at)?->toDateTimeString(),
                'end_at' => optional($timeoff->end_at)?->toDateTimeString(),
            ])
            ->values()
            ->all();

        $blockConflicts = BookingBlock::where(function ($query) use ($staffId) {
            $query->where('scope', 'STORE')
                ->orWhere(function ($nested) use ($staffId) {
                    $nested->where('scope', 'STAFF')->where('staff_id', $staffId);
                });
        })
            ->where(function ($query) use ($queryStartAt, $queryBlockEndAt) {
                $this->whereOverlaps($query, $queryStartAt, $queryBlockEndAt);
            })
            ->get(['id', 'scope', 'staff_id', 'start_at', 'end_at'])
            ->map(fn (BookingBlock $block) => [
                'id' => (int) $block->id,
                'scope' => (string) ($block->scope ?? ''),
                'staff_id' => $block->staff_id ? (int) $block->staff_id : null,
                'start_at' => optional($block->start_at)?->toDateTimeString(),
                'end_at' => optional($block->end_at)?->toDateTimeString(),
            ])
            ->values()
            ->all();

        $conflictingBookingRows = $bookingConflicts->map(fn (Booking $conflict) => [
            'id' => (int) $conflict->id,
            'booking_code' => (string) ($conflict->booking_code ?? ''),
            'start_at' => optional($conflict->start_at)?->toDateTimeString(),
            'end_at' => optional($conflict->end_at)?->toDateTimeString(),
            'buffer_min' => (int) ($conflict->buffer_min ?? 0),
            'buffered_end_at' => $conflict->end_at
                ? $this->normalizeForStorage($conflict->end_at)->addMinutes(max(0, (int) ($conflict->buffer_min ?? 0)))->toDateTimeString()
                : null,
            'status' => (string) ($conflict->status ?? ''),
            'payment_status' => (string) ($conflict->payment_status ?? ''),
            'blocks_time' => true,
        ])->values()->all();
        $conflictingBookingIds = collect($conflictingBookingRows)->pluck('id')->map(fn ($id) => (int) $id)->values()->all();
        $conflictingCartItemIds = collect($cartConflicts)->pluck('id')->map(fn ($id) => (int) $id)->values()->all();
        $timeoffIds = collect($timeoffConflicts)->pluck('id')->map(fn ($id) => (int) $id)->values()->all();
        $blockIdList = collect($blockConflicts)->pluck('id')->map(fn ($id) => (int) $id)->values()->all();

        $diagnostics = [
            'has_conflict' => ! empty($conflictingBookingIds) || ! empty($cartConflicts) || ! empty($timeoffIds) || ! empty($blockIdList),
            'current_booking_id' => $ignoreBooking?->id ? (int) $ignoreBooking->id : ($ignoreBookingId ? (int) $ignoreBookingId : null),
            'current_appointment_id' => $ignoreBooking?->id ? (int) $ignoreBooking->id : ($ignoreBookingId ? (int) $ignoreBookingId : null),
            'staff_id' => $staffId,
            'requested_start' => $queryStartAt->toDateTimeString(),
            'requested_end' => $queryEndAt->toDateTimeString(),
            'requested_start_original_timezone' => $startAt->toIso8601String(),
            'requested_end_original_timezone' => $endAt->toIso8601String(),
            'block_end' => $queryBlockEndAt->toDateTimeString(),
            'business_timezone' => $this->businessTimezone(),
            'ignored_booking_ids' => $ignoreBookingIds,
            'ignored_booking_code' => $ignoreBookingCode !== '' ? $ignoreBookingCode : null,
            'conflicting_appointment_ids' => $conflictingBookingIds,
            'conflicting_booking_ids' => $conflictingBookingIds,
            'conflicting_booking_codes' => collect($conflictingBookingRows)->pluck('booking_code')->filter()->values()->all(),
            'conflicting_appointments' => $conflictingBookingRows,
            'conflicting_cart_item_ids' => $conflictingCartItemIds,
            'conflicting_cart_items' => $cartConflicts,
            'detected_leave_ids' => $timeoffIds,
            'detected_leaves' => $timeoffConflicts,
            'detected_block_ids' => $blockIdList,
            'detected_blocks' => $blockConflicts,
        ];

        if ((bool) ($diagnostics['has_conflict'] ?? false)) {
            Log::debug('Booking availability overlap conflict detected', $diagnostics);
        }

        return $diagnostics;
    }

    public function getStaffAvailabilityDiagnostics(int $staffId, Carbon $startAt, Carbon $endAt): array
    {
        if ($staffId <= 0) {
            return ['is_available' => false, 'failure_reason' => 'invalid_staff_id'];
        }

        if ($endAt->lessThanOrEqualTo($startAt)) {
            return ['is_available' => false, 'failure_reason' => 'end_not_after_start'];
        }

        $timezone = (string) config('app.timezone', 'Asia/Kuala_Lumpur');
        $start = $startAt->copy()->setTimezone($timezone);
        $end = $endAt->copy()->setTimezone($timezone);

        if (! $start->isSameDay($end)) {
            return [
                'is_available' => false,
                'failure_reason' => 'range_crosses_business_day',
                'business_timezone' => $timezone,
                'localized_start' => $start->toDateTimeString(),
                'localized_end' => $end->toDateTimeString(),
            ];
        }

        $schedule = BookingStaffSchedule::where('staff_id', $staffId)
            ->where('day_of_week', $start->dayOfWeek)
            ->first();

        if (! $schedule) {
            return [
                'is_available' => false,
                'failure_reason' => 'no_staff_schedule',
                'business_timezone' => $timezone,
                'day_of_week' => $start->dayOfWeek,
                'localized_start' => $start->toDateTimeString(),
                'localized_end' => $end->toDateTimeString(),
            ];
        }

        $day = $start->copy()->startOfDay();
        $startWindow = Carbon::parse($day->toDateString() . ' ' . $schedule->start_time, $timezone);
        $endWindow = Carbon::parse($day->toDateString() . ' ' . $schedule->end_time, $timezone);

        if ($start->lt($startWindow) || $end->gt($endWindow)) {
            return [
                'is_available' => false,
                'failure_reason' => 'outside_staff_schedule',
                'business_timezone' => $timezone,
                'schedule_id' => (int) $schedule->id,
                'schedule_start' => $startWindow->toDateTimeString(),
                'schedule_end' => $endWindow->toDateTimeString(),
                'localized_start' => $start->toDateTimeString(),
                'localized_end' => $end->toDateTimeString(),
            ];
        }

        if ($this->hitsBreak($schedule->break_start, $schedule->break_end, $day, $start, $end)) {
            return [
                'is_available' => false,
                'failure_reason' => 'hits_staff_break',
                'business_timezone' => $timezone,
                'schedule_id' => (int) $schedule->id,
                'break_start' => $schedule->break_start,
                'break_end' => $schedule->break_end,
                'localized_start' => $start->toDateTimeString(),
                'localized_end' => $end->toDateTimeString(),
            ];
        }

        return [
            'is_available' => true,
            'failure_reason' => null,
            'business_timezone' => $timezone,
            'schedule_id' => (int) $schedule->id,
            'schedule_start' => $startWindow->toDateTimeString(),
            'schedule_end' => $endWindow->toDateTimeString(),
            'localized_start' => $start->toDateTimeString(),
            'localized_end' => $end->toDateTimeString(),
        ];
    }

    public function isWithinStaffAvailability(int $staffId, Carbon $startAt, Carbon $endAt): bool
    {
        return (bool) ($this->getStaffAvailabilityDiagnostics($staffId, $startAt, $endAt)['is_available'] ?? false);
    }

    private function hitsBreak(?string $breakStart, ?string $breakEnd, Carbon $day, Carbon $candidateStart, Carbon $candidateEnd): bool
    {
        if (!$breakStart || !$breakEnd) {
            return false;
        }

        $breakStartAt = Carbon::parse($day->toDateString() . ' ' . $breakStart);
        $breakEndAt = Carbon::parse($day->toDateString() . ' ' . $breakEnd);

        return $candidateStart < $breakEndAt && $candidateEnd > $breakStartAt;
    }
}
