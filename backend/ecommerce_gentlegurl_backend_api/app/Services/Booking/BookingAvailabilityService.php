<?php

namespace App\Services\Booking;

use App\Models\Booking\Booking;
use App\Models\Booking\BookingBlock;
use App\Models\Booking\BookingCartItem;
use App\Models\Booking\BookingService;
use App\Models\Ecommerce\PosCartServiceItem;
use App\Models\Booking\BookingStaffSchedule;
use App\Models\Booking\BookingStaffTimeoff;
use App\Models\Booking\BookingLeaveRequest;
use Carbon\Carbon;
use Carbon\CarbonPeriod;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Facades\Log;

class BookingAvailabilityService
{
    /**
     * Booking statuses that still reserve staff time. Terminal statuses, including COMPLETED,
     * release the slot regardless of payment_status because payment only affects settlement.
     *
     * @var array<int,string>
     */
    public const BLOCKING_BOOKING_STATUSES = ['HOLD', 'CONFIRMED', 'PENDING', 'IN_PROGRESS', 'CHECKED_IN'];

    /** Customer-facing checks: bookings, CRM POS cart locks, and other customer cart reserves. */
    public const SCOPE_CUSTOMER = 'customer';

    /** CRM/staff checks: bookings and CRM POS cart locks only (customer cart reserves are ignored). */
    public const SCOPE_CRM = 'crm';

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
            ->where('is_active', true)
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

    public function hasConflict(
        int $staffId,
        Carbon $startAt,
        Carbon $endAt,
        int $bufferMin,
        ?int $ignoreBookingId = null,
        ?Booking $ignoreBooking = null,
        string $conflictScope = self::SCOPE_CUSTOMER,
        array $ignoreCartItemIds = [],
        array $ignorePosCartServiceItemIds = [],
    ): bool {
        return $this->getConflictDiagnostics(
            $staffId,
            $startAt,
            $endAt,
            $bufferMin,
            $ignoreBookingId,
            $ignoreBooking,
            $conflictScope,
            $ignoreCartItemIds,
            $ignorePosCartServiceItemIds,
        )['has_conflict'];
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
     *   conflicting_pos_cart_item_ids:array<int,int>,
     *   detected_leave_ids:array<int,int>,
     *   detected_block_ids:array<int,int>
     * }
     */
    public function getConflictDiagnostics(
        int $staffId,
        Carbon $startAt,
        Carbon $endAt,
        int $bufferMin,
        ?int $ignoreBookingId = null,
        ?Booking $ignoreBooking = null,
        string $conflictScope = self::SCOPE_CUSTOMER,
        array $ignoreCartItemIds = [],
        array $ignorePosCartServiceItemIds = [],
    ): array {
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
            ->whereIn('status', self::BLOCKING_BOOKING_STATUSES)
            ->where('start_at', '<', $queryBlockEndAt->toDateTimeString())
            ->get(['id', 'booking_code', 'start_at', 'end_at', 'buffer_min', 'status', 'payment_status'])
            ->filter(function (Booking $candidate) use ($queryStartAt) {
                $candidateBufferedEnd = $candidate->end_at
                    ? $this->normalizeForStorage($candidate->end_at)->addMinutes(max(0, (int) ($candidate->buffer_min ?? 0)))
                    : null;

                return $candidateBufferedEnd !== null && $candidateBufferedEnd->gt($queryStartAt);
            })
            ->values();

        $cartConflicts = [];
        if ($conflictScope === self::SCOPE_CUSTOMER) {
            $ignoredCartItemIds = collect($ignoreCartItemIds)
                ->map(fn ($id) => (int) $id)
                ->filter(fn (int $id) => $id > 0)
                ->unique()
                ->values()
                ->all();

            $cartConflicts = BookingCartItem::where('staff_id', $staffId)
                ->where('status', 'active')
                ->where('expires_at', '>', now())
                ->when(! empty($ignoredCartItemIds), fn ($query) => $query->whereNotIn('id', $ignoredCartItemIds))
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
        }

        $ignoredPosCartServiceItemIds = collect($ignorePosCartServiceItemIds)
            ->map(fn ($id) => (int) $id)
            ->filter(fn (int $id) => $id > 0)
            ->unique()
            ->values()
            ->all();

        $posCartConflicts = PosCartServiceItem::query()
            ->where('assigned_staff_id', $staffId)
            ->whereNotNull('start_at')
            ->whereNotNull('end_at')
            ->when(! empty($ignoredPosCartServiceItemIds), fn ($query) => $query->whereNotIn('id', $ignoredPosCartServiceItemIds))
            ->where(function ($query) use ($queryStartAt, $queryBlockEndAt) {
                $this->whereOverlaps($query, $queryStartAt, $queryBlockEndAt);
            })
            ->get(['id', 'start_at', 'end_at', 'booking_service_id'])
            ->map(fn (PosCartServiceItem $item) => [
                'id' => (int) $item->id,
                'booking_service_id' => (int) ($item->booking_service_id ?? 0),
                'start_at' => optional($item->start_at)?->toDateTimeString(),
                'end_at' => optional($item->end_at)?->toDateTimeString(),
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
                'leave_type' => null,
                'day_type' => null,
            ])
            ->values();

        $requestDates = collect([$queryStartAt->toDateString(), $queryEndAt->toDateString(), $queryBlockEndAt->toDateString()])
            ->unique()
            ->values();
        $fullDayLeaveConflicts = BookingLeaveRequest::query()
            ->where('staff_id', $staffId)
            ->where('status', 'approved')
            ->where(function ($query) use ($requestDates) {
                foreach ($requestDates as $date) {
                    $query->orWhere(function ($nested) use ($date) {
                        $nested->whereDate('start_date', '<=', $date)
                            ->whereDate('end_date', '>=', $date);
                    });
                }
            })
            ->where(function ($query) {
                $query->where('leave_type', 'off_day')
                    ->orWhere('day_type', 'full_day');
            })
            ->get(['id', 'approved_timeoff_id', 'leave_type', 'day_type', 'start_date', 'end_date'])
            ->map(fn (BookingLeaveRequest $leave) => [
                'id' => $leave->approved_timeoff_id ? (int) $leave->approved_timeoff_id : (int) $leave->id,
                'leave_request_id' => (int) $leave->id,
                'start_at' => optional($leave->start_date)?->toDateString(),
                'end_at' => optional($leave->end_date)?->toDateString(),
                'leave_type' => (string) ($leave->leave_type ?? ''),
                'day_type' => (string) ($leave->day_type ?? ''),
            ]);

        $timeoffConflicts = $timeoffConflicts
            ->concat($fullDayLeaveConflicts)
            ->unique(fn (array $item) => ((string) ($item['leave_type'] ?? 'timeoff')) . ':' . ((int) ($item['id'] ?? 0)) . ':' . ((int) ($item['leave_request_id'] ?? 0)))
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
        $conflictingPosCartItemIds = collect($posCartConflicts)->pluck('id')->map(fn ($id) => (int) $id)->values()->all();
        $timeoffIds = collect($timeoffConflicts)->pluck('id')->map(fn ($id) => (int) $id)->values()->all();
        $blockIdList = collect($blockConflicts)->pluck('id')->map(fn ($id) => (int) $id)->values()->all();

        $diagnostics = [
            'has_conflict' => ! empty($conflictingBookingIds)
                || ! empty($cartConflicts)
                || ! empty($posCartConflicts)
                || ! empty($timeoffIds)
                || ! empty($blockIdList),
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
            'conflicting_pos_cart_item_ids' => $conflictingPosCartItemIds,
            'conflicting_pos_cart_items' => $posCartConflicts,
            'detected_leave_ids' => $timeoffIds,
            'detected_leave_types' => collect($timeoffConflicts)->pluck('leave_type')->filter()->unique()->values()->all(),
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

        if (! $schedule->is_active) {
            return [
                'is_available' => false,
                'failure_reason' => 'schedule_inactive',
                'business_timezone' => $timezone,
                'schedule_id' => (int) $schedule->id,
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

    /**
     * POS pooled availability with batched day context (avoids per-slot DB queries).
     *
     * @param  array<int,int>  $staffIds
     * @param  callable(array<string,mixed>, array<string,mixed>): string|null  $conflictReasonResolver
     * @return array<int, array{
     *   start_at:string,
     *   end_at:string,
     *   available_staff_ids:array<int,int>,
     *   scheduled_staff_ids:array<int,int>,
     *   unavailable_staff_reasons:array<string,string>
     * }>
     */
    public function getPosPooledAvailabilitySlots(
        BookingService $service,
        array $staffIds,
        string $date,
        int $extraDurationMin = 0,
        int $stepMin = 15,
        int $visibleStartMinute = 540,
        int $visibleEndMinute = 1440,
        ?callable $conflictReasonResolver = null,
        ?int $ignoreBookingId = null,
        ?Booking $ignoreBooking = null,
        string $conflictScope = self::SCOPE_CRM,
        array $ignoreCartItemIds = [],
        array $ignorePosCartServiceItemIds = [],
        bool $holidayOnlyVerify = false,
    ): array {
        $staffIds = collect($staffIds)->map(fn ($id) => (int) $id)->filter(fn (int $id) => $id > 0)->unique()->values()->all();
        if ($staffIds === []) {
            return [];
        }

        $timezone = $this->businessTimezone();
        $day = Carbon::parse($date, $timezone)->startOfDay();
        $durationMin = max(1, (int) $service->duration_min + max(0, $extraDurationMin));
        $bufferMin = max(0, (int) $service->buffer_min);
        $nowInBusinessTz = Carbon::now($timezone);
        $isTodayInBusinessTz = $day->isSameDay($nowInBusinessTz);
        $ignoreBookingIds = collect([$ignoreBookingId, $ignoreBooking?->id])
            ->filter(fn ($id) => $id !== null && (int) $id > 0)
            ->map(fn ($id) => (int) $id)
            ->unique()
            ->values()
            ->all();

        $context = $this->prefetchPosDayAvailabilityContext($staffIds, $day, $bufferMin, $conflictScope);
        $context['ignore_booking_ids'] = $ignoreBookingIds;
        $context['ignore_booking_code'] = trim((string) ($ignoreBooking?->booking_code ?? ''));
        $context['ignore_booking_start_at'] = $ignoreBooking?->start_at ? $ignoreBooking->start_at->toDateTimeString() : null;
        $context['ignore_booking_service_id'] = (int) ($ignoreBooking?->service_id ?? 0);
        $context['ignore_cart_item_ids'] = collect($ignoreCartItemIds)->map(fn ($id) => (int) $id)->filter(fn (int $id) => $id > 0)->unique()->values()->all();
        $context['ignore_pos_cart_service_item_ids'] = collect($ignorePosCartServiceItemIds)->map(fn ($id) => (int) $id)->filter(fn (int $id) => $id > 0)->unique()->values()->all();

        $visibleStartMinute = max(0, $visibleStartMinute);
        $visibleEndMinute = max($visibleStartMinute, $visibleEndMinute);
        $lastStartMinute = min($visibleEndMinute - $durationMin, (24 * 60) - $durationMin);
        $visible = [];

        for ($minute = $visibleStartMinute; $minute <= $lastStartMinute; $minute += max(1, $stepMin)) {
            $startAt = $day->copy()->setTime(intdiv($minute, 60), $minute % 60, 0);
            if ($isTodayInBusinessTz && $startAt->lessThanOrEqualTo($nowInBusinessTz)) {
                continue;
            }

            $endAt = $startAt->copy()->addMinutes($durationMin);
            $availableStaffIds = [];
            $scheduledStaffIds = [];
            $unavailableStaffReasons = [];

            foreach ($staffIds as $staffId) {
                if ($holidayOnlyVerify) {
                    $conflictDiagnostics = $this->evaluatePrefetchedStaffConflict($context, $staffId, $startAt, $endAt, $bufferMin);
                    if ((bool) ($conflictDiagnostics['has_conflict'] ?? false)) {
                        $reason = $conflictReasonResolver !== null
                            ? (string) $conflictReasonResolver($conflictDiagnostics, ['is_available' => true, 'failure_reason' => null])
                            : 'booking_conflict';
                        if (in_array($reason, ['staff_off_day', 'staff_leave'], true)) {
                            $unavailableStaffReasons[(string) $staffId] = $reason;
                            continue;
                        }
                    }

                    $availableStaffIds[] = $staffId;
                    $scheduleDiagnostics = $this->evaluatePrefetchedStaffSchedule($context, $staffId, $startAt, $endAt);
                    if ((bool) ($scheduleDiagnostics['is_available'] ?? false)) {
                        $scheduledStaffIds[] = $staffId;
                    }

                    continue;
                }

                $scheduleDiagnostics = $this->evaluatePrefetchedStaffSchedule($context, $staffId, $startAt, $endAt);
                if ((bool) ($scheduleDiagnostics['is_available'] ?? false)) {
                    $scheduledStaffIds[] = $staffId;
                } else {
                    $unavailableStaffReasons[(string) $staffId] = (string) ($scheduleDiagnostics['failure_reason'] ?? 'staff_unavailable');
                }

                $conflictDiagnostics = $this->evaluatePrefetchedStaffConflict($context, $staffId, $startAt, $endAt, $bufferMin);
                if ((bool) ($conflictDiagnostics['has_conflict'] ?? false)) {
                    $reason = $conflictReasonResolver !== null
                        ? (string) $conflictReasonResolver($conflictDiagnostics, $scheduleDiagnostics)
                        : 'booking_conflict';
                    $unavailableStaffReasons[(string) $staffId] = $reason;
                    continue;
                }

                if ((bool) ($scheduleDiagnostics['is_available'] ?? false)) {
                    $availableStaffIds[] = $staffId;
                }
            }

            $visible[] = [
                'start_at' => $startAt->format('Y-m-d\TH:i:s'),
                'end_at' => $endAt->format('Y-m-d\TH:i:s'),
                'available_staff_ids' => array_values(array_unique($availableStaffIds)),
                'scheduled_staff_ids' => array_values(array_unique($scheduledStaffIds)),
                'unavailable_staff_reasons' => $unavailableStaffReasons,
            ];
        }

        return $visible;
    }

    /**
     * @param  array<int,int>  $staffIds
     * @return array{
     *   day:Carbon,
     *   timezone:string,
     *   schedules:array<int, BookingStaffSchedule>,
     *   bookings_by_staff:array<int, array<int, array<string,mixed>>>,
     *   cart_by_staff:array<int, array<int, array<string,mixed>>>,
     *   pos_cart_by_staff:array<int, array<int, array<string,mixed>>>,
     *   timeoffs_by_staff:array<int, array<int, array<string,mixed>>>,
     *   leave_by_staff:array<int, array<int, array<string,mixed>>>,
     *   blocks:array<int, array<string,mixed>>
     * }
     */
    protected function prefetchPosDayAvailabilityContext(array $staffIds, Carbon $day, int $bufferMin, string $conflictScope = self::SCOPE_CRM): array
    {
        $timezone = $this->businessTimezone();
        $dayStart = $day->copy()->startOfDay();
        $dayEnd = $day->copy()->endOfDay();
        $queryStart = $this->normalizeForStorage($dayStart)->subMinutes($bufferMin);
        $queryEnd = $this->normalizeForStorage($dayEnd)->addMinutes($bufferMin);
        $requestDates = collect([$dayStart->toDateString()]);

        $schedules = BookingStaffSchedule::query()
            ->whereIn('staff_id', $staffIds)
            ->where('day_of_week', $day->dayOfWeek)
            ->get()
            ->keyBy('staff_id')
            ->all();

        $bookingRows = Booking::query()
            ->whereIn('staff_id', $staffIds)
            ->whereIn('status', self::BLOCKING_BOOKING_STATUSES)
            ->where('start_at', '<', $queryEnd->toDateTimeString())
            ->get(['id', 'staff_id', 'booking_code', 'start_at', 'end_at', 'buffer_min', 'status', 'payment_status']);

        $bookingsByStaff = [];
        foreach ($bookingRows as $booking) {
            $staffId = (int) $booking->staff_id;
            $bufferedEnd = $booking->end_at
                ? $this->normalizeForStorage($booking->end_at)->addMinutes(max(0, (int) ($booking->buffer_min ?? 0)))
                : null;
            if ($bufferedEnd === null || $bufferedEnd->lte($queryStart)) {
                continue;
            }
            $bookingsByStaff[$staffId][] = [
                'id' => (int) $booking->id,
                'booking_code' => (string) ($booking->booking_code ?? ''),
                'start_at' => optional($booking->start_at)?->toDateTimeString(),
                'end_at' => optional($booking->end_at)?->toDateTimeString(),
                'buffer_min' => (int) ($booking->buffer_min ?? 0),
                'buffered_end_at' => $bufferedEnd->toDateTimeString(),
                'status' => (string) ($booking->status ?? ''),
                'payment_status' => (string) ($booking->payment_status ?? ''),
            ];
        }

        $cartByStaff = [];
        if ($conflictScope === self::SCOPE_CUSTOMER) {
            $cartRows = BookingCartItem::query()
                ->whereIn('staff_id', $staffIds)
                ->where('status', 'active')
                ->where('expires_at', '>', now())
                ->where('start_at', '<', $queryEnd->toDateTimeString())
                ->where('end_at', '>', $queryStart->toDateTimeString())
                ->get(['id', 'staff_id', 'start_at', 'end_at', 'service_id', 'status']);

            foreach ($cartRows as $item) {
                $staffId = (int) $item->staff_id;
                $cartByStaff[$staffId][] = [
                    'id' => (int) $item->id,
                    'service_id' => (int) ($item->service_id ?? 0),
                    'start_at' => optional($item->start_at)?->toDateTimeString(),
                    'end_at' => optional($item->end_at)?->toDateTimeString(),
                    'status' => (string) ($item->status ?? ''),
                ];
            }
        }

        $posCartRows = PosCartServiceItem::query()
            ->whereIn('assigned_staff_id', $staffIds)
            ->whereNotNull('start_at')
            ->whereNotNull('end_at')
            ->where('start_at', '<', $queryEnd->toDateTimeString())
            ->where('end_at', '>', $queryStart->toDateTimeString())
            ->get(['id', 'assigned_staff_id', 'start_at', 'end_at', 'booking_service_id']);

        $posCartByStaff = [];
        foreach ($posCartRows as $item) {
            $staffId = (int) $item->assigned_staff_id;
            $posCartByStaff[$staffId][] = [
                'id' => (int) $item->id,
                'booking_service_id' => (int) ($item->booking_service_id ?? 0),
                'start_at' => optional($item->start_at)?->toDateTimeString(),
                'end_at' => optional($item->end_at)?->toDateTimeString(),
            ];
        }

        $timeoffRows = BookingStaffTimeoff::query()
            ->whereIn('staff_id', $staffIds)
            ->where('start_at', '<', $queryEnd->toDateTimeString())
            ->where('end_at', '>', $queryStart->toDateTimeString())
            ->get(['id', 'staff_id', 'start_at', 'end_at']);

        $timeoffsByStaff = [];
        foreach ($timeoffRows as $timeoff) {
            $staffId = (int) $timeoff->staff_id;
            $timeoffsByStaff[$staffId][] = [
                'id' => (int) $timeoff->id,
                'start_at' => optional($timeoff->start_at)?->toDateTimeString(),
                'end_at' => optional($timeoff->end_at)?->toDateTimeString(),
                'leave_type' => null,
                'day_type' => null,
            ];
        }

        $leaveRows = BookingLeaveRequest::query()
            ->whereIn('staff_id', $staffIds)
            ->where('status', 'approved')
            ->where(function ($query) use ($requestDates) {
                foreach ($requestDates as $requestDate) {
                    $query->orWhere(function ($nested) use ($requestDate) {
                        $nested->whereDate('start_date', '<=', $requestDate)
                            ->whereDate('end_date', '>=', $requestDate);
                    });
                }
            })
            ->where(function ($query) {
                $query->where('leave_type', 'off_day')
                    ->orWhere('day_type', 'full_day');
            })
            ->get(['id', 'staff_id', 'approved_timeoff_id', 'leave_type', 'day_type', 'start_date', 'end_date']);

        $leaveByStaff = [];
        foreach ($leaveRows as $leave) {
            $staffId = (int) $leave->staff_id;
            $leaveByStaff[$staffId][] = [
                'id' => $leave->approved_timeoff_id ? (int) $leave->approved_timeoff_id : (int) $leave->id,
                'leave_request_id' => (int) $leave->id,
                'start_at' => optional($leave->start_date)?->toDateString(),
                'end_at' => optional($leave->end_date)?->toDateString(),
                'leave_type' => (string) ($leave->leave_type ?? ''),
                'day_type' => (string) ($leave->day_type ?? ''),
            ];
        }

        $blockRows = BookingBlock::query()
            ->where(function ($query) use ($staffIds) {
                $query->where('scope', 'STORE')
                    ->orWhere(function ($nested) use ($staffIds) {
                        $nested->where('scope', 'STAFF')->whereIn('staff_id', $staffIds);
                    });
            })
            ->where('start_at', '<', $queryEnd->toDateTimeString())
            ->where('end_at', '>', $queryStart->toDateTimeString())
            ->get(['id', 'scope', 'staff_id', 'start_at', 'end_at']);

        $blocks = [];
        foreach ($blockRows as $block) {
            $blocks[] = [
                'id' => (int) $block->id,
                'scope' => (string) ($block->scope ?? ''),
                'staff_id' => $block->staff_id ? (int) $block->staff_id : null,
                'start_at' => optional($block->start_at)?->toDateTimeString(),
                'end_at' => optional($block->end_at)?->toDateTimeString(),
            ];
        }

        return [
            'day' => $day,
            'timezone' => $timezone,
            'schedules' => $schedules,
            'bookings_by_staff' => $bookingsByStaff,
            'cart_by_staff' => $cartByStaff,
            'pos_cart_by_staff' => $posCartByStaff,
            'conflict_scope' => $conflictScope,
            'timeoffs_by_staff' => $timeoffsByStaff,
            'leave_by_staff' => $leaveByStaff,
            'blocks' => $blocks,
        ];
    }

    /**
     * @param  array<string,mixed>  $context
     * @return array<string,mixed>
     */
    protected function evaluatePrefetchedStaffSchedule(array $context, int $staffId, Carbon $startAt, Carbon $endAt): array
    {
        if ($staffId <= 0) {
            return ['is_available' => false, 'failure_reason' => 'invalid_staff_id'];
        }

        if ($endAt->lessThanOrEqualTo($startAt)) {
            return ['is_available' => false, 'failure_reason' => 'end_not_after_start'];
        }

        $timezone = (string) ($context['timezone'] ?? $this->businessTimezone());
        $start = $startAt->copy()->setTimezone($timezone);
        $end = $endAt->copy()->setTimezone($timezone);

        if (! $start->isSameDay($end)) {
            return ['is_available' => false, 'failure_reason' => 'range_crosses_business_day'];
        }

        /** @var BookingStaffSchedule|null $schedule */
        $schedule = $context['schedules'][$staffId] ?? null;
        if (! $schedule) {
            return ['is_available' => false, 'failure_reason' => 'no_staff_schedule'];
        }

        if (! $schedule->is_active) {
            return ['is_available' => false, 'failure_reason' => 'schedule_inactive'];
        }

        $day = $start->copy()->startOfDay();
        $startWindow = Carbon::parse($day->toDateString() . ' ' . $schedule->start_time, $timezone);
        $endWindow = Carbon::parse($day->toDateString() . ' ' . $schedule->end_time, $timezone);

        if ($start->lt($startWindow) || $end->gt($endWindow)) {
            return ['is_available' => false, 'failure_reason' => 'outside_staff_schedule'];
        }

        if ($this->hitsBreak($schedule->break_start, $schedule->break_end, $day, $start, $end)) {
            return ['is_available' => false, 'failure_reason' => 'hits_staff_break'];
        }

        return ['is_available' => true, 'failure_reason' => null];
    }

    /**
     * @param  array<string,mixed>  $context
     * @return array<string,mixed>
     */
    protected function evaluatePrefetchedStaffConflict(array $context, int $staffId, Carbon $startAt, Carbon $endAt, int $bufferMin): array
    {
        $blockEnd = $endAt->copy()->addMinutes($bufferMin);
        $queryStartAt = $this->normalizeForStorage($startAt);
        $queryEndAt = $this->normalizeForStorage($endAt);
        $queryBlockEndAt = $this->normalizeForStorage($blockEnd);

        $conflictingBookingIds = [];
        $conflictingBookingCodes = [];
        $conflictingCartItemIds = [];
        $conflictingPosCartItemIds = [];
        $detectedLeaveIds = [];
        $detectedLeaveTypes = [];
        $detectedBlockIds = [];

        $ignoreBookingIds = array_values(array_filter(array_map('intval', $context['ignore_booking_ids'] ?? [])));
        $ignoreBookingCode = trim((string) ($context['ignore_booking_code'] ?? ''));
        $ignoredCartItemIds = array_values(array_filter(array_map('intval', $context['ignore_cart_item_ids'] ?? [])));
        $ignoredPosCartServiceItemIds = array_values(array_filter(array_map('intval', $context['ignore_pos_cart_service_item_ids'] ?? [])));
        $conflictScope = (string) ($context['conflict_scope'] ?? self::SCOPE_CRM);

        foreach ($context['bookings_by_staff'][$staffId] ?? [] as $booking) {
            $bookingId = (int) ($booking['id'] ?? 0);
            if ($ignoreBookingIds !== [] && in_array($bookingId, $ignoreBookingIds, true)) {
                continue;
            }
            if ($ignoreBookingCode !== '' && trim((string) ($booking['booking_code'] ?? '')) === $ignoreBookingCode) {
                continue;
            }

            $candidateStart = Carbon::parse((string) ($booking['start_at'] ?? ''));
            $bufferedEnd = Carbon::parse((string) ($booking['buffered_end_at'] ?? ''));
            if ($candidateStart->lt($queryBlockEndAt) && $bufferedEnd->gt($queryStartAt)) {
                $conflictingBookingIds[] = (int) ($booking['id'] ?? 0);
                $code = trim((string) ($booking['booking_code'] ?? ''));
                if ($code !== '') {
                    $conflictingBookingCodes[] = $code;
                }
            }
        }

        $ignoreStartAt = $context['ignore_booking_start_at'] ?? null;
        $ignoreServiceId = (int) ($context['ignore_booking_service_id'] ?? 0);

        if ($conflictScope === self::SCOPE_CUSTOMER) {
            foreach ($context['cart_by_staff'][$staffId] ?? [] as $cartItem) {
                $cartItemId = (int) ($cartItem['id'] ?? 0);
                if ($cartItemId > 0 && in_array($cartItemId, $ignoredCartItemIds, true)) {
                    continue;
                }

                if ($ignoreStartAt && $ignoreServiceId > 0) {
                    if ((int) ($cartItem['service_id'] ?? 0) === $ignoreServiceId
                        && (string) ($cartItem['start_at'] ?? '') === $ignoreStartAt) {
                        continue;
                    }
                }

                $cartStart = Carbon::parse((string) ($cartItem['start_at'] ?? ''));
                $cartEnd = Carbon::parse((string) ($cartItem['end_at'] ?? ''));
                if ($cartStart->lt($queryBlockEndAt) && $cartEnd->gt($queryStartAt)) {
                    $conflictingCartItemIds[] = $cartItemId;
                }
            }
        }

        foreach ($context['pos_cart_by_staff'][$staffId] ?? [] as $posCartItem) {
            $posCartItemId = (int) ($posCartItem['id'] ?? 0);
            if ($posCartItemId > 0 && in_array($posCartItemId, $ignoredPosCartServiceItemIds, true)) {
                continue;
            }

            $cartStart = Carbon::parse((string) ($posCartItem['start_at'] ?? ''));
            $cartEnd = Carbon::parse((string) ($posCartItem['end_at'] ?? ''));
            if ($cartStart->lt($queryBlockEndAt) && $cartEnd->gt($queryStartAt)) {
                $conflictingPosCartItemIds[] = $posCartItemId;
            }
        }

        foreach (array_merge($context['timeoffs_by_staff'][$staffId] ?? [], $context['leave_by_staff'][$staffId] ?? []) as $leave) {
            $leaveStart = Carbon::parse((string) ($leave['start_at'] ?? ''))->startOfDay();
            $leaveEnd = Carbon::parse((string) ($leave['end_at'] ?? ''))->endOfDay();
            if ($leaveStart->lt($queryBlockEndAt) && $leaveEnd->gt($queryStartAt)) {
                $detectedLeaveIds[] = (int) ($leave['id'] ?? 0);
                $leaveType = trim((string) ($leave['leave_type'] ?? ''));
                if ($leaveType !== '') {
                    $detectedLeaveTypes[] = $leaveType;
                }
            }
        }

        foreach ($context['blocks'] ?? [] as $block) {
            $scope = (string) ($block['scope'] ?? '');
            $blockStaffId = (int) ($block['staff_id'] ?? 0);
            if ($scope === 'STAFF' && $blockStaffId !== $staffId) {
                continue;
            }
            $blockStart = Carbon::parse((string) ($block['start_at'] ?? ''));
            $blockEndAt = Carbon::parse((string) ($block['end_at'] ?? ''));
            if ($blockStart->lt($queryBlockEndAt) && $blockEndAt->gt($queryStartAt)) {
                $detectedBlockIds[] = (int) ($block['id'] ?? 0);
            }
        }

        $conflictingBookingIds = array_values(array_unique(array_filter($conflictingBookingIds)));
        $conflictingCartItemIds = array_values(array_unique(array_filter($conflictingCartItemIds)));
        $conflictingPosCartItemIds = array_values(array_unique(array_filter($conflictingPosCartItemIds)));
        $detectedLeaveIds = array_values(array_unique(array_filter($detectedLeaveIds)));
        $detectedBlockIds = array_values(array_unique(array_filter($detectedBlockIds)));
        $detectedLeaveTypes = array_values(array_unique($detectedLeaveTypes));

        return [
            'has_conflict' => ! empty($conflictingBookingIds)
                || ! empty($conflictingCartItemIds)
                || ! empty($conflictingPosCartItemIds)
                || ! empty($detectedLeaveIds)
                || ! empty($detectedBlockIds),
            'staff_id' => $staffId,
            'conflicting_booking_ids' => $conflictingBookingIds,
            'conflicting_booking_codes' => array_values(array_unique($conflictingBookingCodes)),
            'conflicting_cart_item_ids' => $conflictingCartItemIds,
            'conflicting_pos_cart_item_ids' => $conflictingPosCartItemIds,
            'detected_leave_ids' => $detectedLeaveIds,
            'detected_leave_types' => $detectedLeaveTypes,
            'detected_block_ids' => $detectedBlockIds,
        ];
    }
}
