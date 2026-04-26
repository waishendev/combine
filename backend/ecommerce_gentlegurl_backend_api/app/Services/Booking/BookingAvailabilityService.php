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

    public function hasConflict(int $staffId, Carbon $startAt, Carbon $endAt, int $bufferMin): bool
    {
        $blockEnd = $endAt->copy()->addMinutes($bufferMin);

        $hasBookingConflict = Booking::where('staff_id', $staffId)
            ->whereNotIn('status', ['EXPIRED', 'CANCELLED'])
            ->where(function ($query) use ($startAt, $blockEnd) {
                $query->where('start_at', '<', $blockEnd)
                    ->whereRaw("end_at + (buffer_min * interval '1 minute') > ?", [$startAt->toDateTimeString()]);
            })
            ->exists();

        if ($hasBookingConflict) {
            return true;
        }


        $hasCartItemConflict = BookingCartItem::where('staff_id', $staffId)
            ->where('status', 'active')
            ->where('expires_at', '>', now())
            ->where('start_at', '<', $blockEnd)
            ->whereRaw("end_at > ?", [$startAt->toDateTimeString()])
            ->exists();

        if ($hasCartItemConflict) {
            return true;
        }

        $hasTimeoff = BookingStaffTimeoff::where('staff_id', $staffId)
            ->where('start_at', '<', $blockEnd)
            ->where('end_at', '>', $startAt)
            ->exists();

        if ($hasTimeoff) {
            return true;
        }

        return BookingBlock::where(function ($query) use ($staffId) {
            $query->where('scope', 'STORE')
                ->orWhere(function ($nested) use ($staffId) {
                    $nested->where('scope', 'STAFF')->where('staff_id', $staffId);
                });
        })
            ->where('start_at', '<', $blockEnd)
            ->where('end_at', '>', $startAt)
            ->exists();
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
