<?php

namespace App\Services\Booking;

use App\Models\Booking\Booking;
use App\Models\Booking\BookingBlock;
use App\Models\Booking\BookingService;
use App\Models\Booking\BookingStaffSchedule;
use App\Models\Booking\BookingStaffTimeoff;
use Carbon\Carbon;
use Carbon\CarbonPeriod;

class BookingAvailabilityService
{
    /** @return array<int, array{start_at:string,end_at:string}> */
    public function getAvailableSlots(BookingService $service, int $staffId, string $date, int $stepMin = 15): array
    {
        $day = Carbon::parse($date);
        $schedule = BookingStaffSchedule::where('staff_id', $staffId)
            ->where('day_of_week', $day->dayOfWeek)
            ->first();

        if (!$schedule) {
            return [];
        }

        $startWindow = Carbon::parse($day->toDateString() . ' ' . $schedule->start_time);
        $endWindow = Carbon::parse($day->toDateString() . ' ' . $schedule->end_time);
        $durationMin = (int) $service->duration_min;
        $bufferMin = (int) $service->buffer_min;

        $slots = [];
        $period = CarbonPeriod::create($startWindow, $stepMin . ' minutes', $endWindow->copy()->subMinutes($durationMin));

        foreach ($period as $candidateStart) {
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
            ];
        }

        return $slots;
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
