<?php

namespace Database\Seeders;

use App\Models\Booking\BookingLeaveBalance;
use App\Models\Booking\BookingLeaveRequest;
use App\Models\Booking\BookingStaffTimeoff;
use App\Models\Staff;
use App\Models\User;
use App\Services\Booking\BookingLeaveService;
use Carbon\Carbon;
use Illuminate\Database\Seeder;

class BookingLeaveTestingSeeder extends Seeder
{
    public function run(): void
    {
        $staffUsers = $this->resolveExistingStaffUsers();
        if ($staffUsers === []) {
            return;
        }

        $this->seedBalances($staffUsers);
        $this->seedLeaveRequests($staffUsers);
    }

    /**
     * @return array<int, array{staff:Staff,user:User|null}>
     */
    private function resolveExistingStaffUsers(): array
    {
        $staffRows = Staff::query()
            ->where('is_active', true)
            ->orderBy('id')
            ->limit(5)
            ->get();

        return $staffRows
            ->map(fn (Staff $staff) => [
                'staff' => $staff,
                'user' => User::query()->where('staff_id', $staff->id)->orderBy('id')->first(),
            ])
            ->values()
            ->all();
    }

    /**
     * @param array<int, array{staff:Staff,user:User|null}> $staffUsers
     */
    private function seedBalances(array $staffUsers): void
    {
        foreach ($staffUsers as $row) {
            $staffId = (int) $row['staff']->id;

            BookingLeaveBalance::query()->updateOrCreate(
                ['staff_id' => $staffId, 'leave_type' => 'annual'],
                ['entitled_days' => 14]
            );

            BookingLeaveBalance::query()->updateOrCreate(
                ['staff_id' => $staffId, 'leave_type' => 'mc'],
                ['entitled_days' => 12]
            );

            BookingLeaveBalance::query()->updateOrCreate(
                ['staff_id' => $staffId, 'leave_type' => 'emergency'],
                ['entitled_days' => 6]
            );

            BookingLeaveBalance::query()->updateOrCreate(
                ['staff_id' => $staffId, 'leave_type' => 'unpaid'],
                ['entitled_days' => 0]
            );
        }
    }

    /**
     * @param array<int, array{staff:Staff,user:User|null}> $staffUsers
     */
    private function seedLeaveRequests(array $staffUsers): void
    {
        $leaveService = app(BookingLeaveService::class);
        $today = Carbon::today();
        $fallbackUserId = User::query()->orderBy('id')->value('id');

        foreach ($staffUsers as $index => $row) {
            $staffId = (int) $row['staff']->id;
            $userId = $row['user']?->id ?? $fallbackUserId;

            $approvedStart = $today->copy()->subDays(14 + $index * 2)->toDateString();
            $approvedEnd = $today->copy()->subDays(13 + $index * 2)->toDateString();

            $approved = BookingLeaveRequest::query()->updateOrCreate(
                [
                    'staff_id' => $staffId,
                    'leave_type' => 'annual',
                    'start_date' => $approvedStart,
                    'end_date' => $approvedEnd,
                ],
                [
                    'day_type' => 'full_day',
                    'days' => 2,
                    'reason' => 'Family event (seeded)',
                    'status' => 'approved',
                    'admin_remark' => 'Approved for seeded demo record.',
                    'reviewed_by_user_id' => $userId,
                    'reviewed_at' => $today->copy()->subDays(16 + $index),
                ]
            );

            $timeoff = BookingStaffTimeoff::query()->updateOrCreate(
                ['reason' => sprintf('Leave request #%d (%s)', $approved->id, $approved->leave_type)],
                [
                    'staff_id' => $staffId,
                    'start_at' => Carbon::parse($approvedStart)->startOfDay(),
                    'end_at' => Carbon::parse($approvedEnd)->endOfDay(),
                ]
            );
            if ((int) $approved->approved_timeoff_id !== (int) $timeoff->id) {
                $approved->approved_timeoff_id = $timeoff->id;
                $approved->save();
            }

            $leaveService->logAction(
                $staffId,
                (int) $approved->id,
                'approved',
                ['status' => 'pending'],
                ['status' => 'approved', 'day_type' => 'full_day', 'total_days' => (float) $approved->days],
                'Seeded approved leave request.',
                $userId
            );


            $calendarEmergencyDate = $today->copy()->addDays($index + 1)->toDateString();
            $calendarEmergency = BookingLeaveRequest::query()->updateOrCreate(
                [
                    'staff_id' => $staffId,
                    'leave_type' => 'emergency',
                    'start_date' => $calendarEmergencyDate,
                    'end_date' => $calendarEmergencyDate,
                ],
                [
                    'day_type' => 'half_day_am',
                    'days' => 0.5,
                    'reason' => 'Seeded approved emergency half-day for calendar.',
                    'status' => 'approved',
                    'admin_remark' => 'Approved seeded half-day emergency leave.',
                    'reviewed_by_user_id' => $userId,
                    'reviewed_at' => now(),
                ]
            );

            $calendarOffDayDate = $today->copy()->addDays(7 + $index)->toDateString();
            $calendarOffDay = BookingLeaveRequest::query()->updateOrCreate(
                [
                    'staff_id' => $staffId,
                    'leave_type' => 'off_day',
                    'start_date' => $calendarOffDayDate,
                    'end_date' => $calendarOffDayDate,
                ],
                [
                    'day_type' => 'full_day',
                    'days' => 1,
                    'reason' => 'Seeded off day for calendar visibility.',
                    'status' => 'approved',
                    'admin_remark' => 'Admin off day (seeded).',
                    'reviewed_by_user_id' => $userId,
                    'reviewed_at' => now(),
                ]
            );

            foreach ([$calendarEmergency, $calendarOffDay] as $calendarItem) {
                [$calendarStartAt, $calendarEndAt] = $leaveService->resolveTimeoffWindow(
                    $staffId,
                    Carbon::parse((string) $calendarItem->start_date)->startOfDay(),
                    Carbon::parse((string) $calendarItem->end_date)->startOfDay(),
                    (string) $calendarItem->day_type
                );

                $calendarTimeoff = BookingStaffTimeoff::query()->updateOrCreate(
                    ['reason' => sprintf('Leave request #%d (%s %s)', $calendarItem->id, $calendarItem->leave_type, $calendarItem->day_type)],
                    [
                        'staff_id' => $staffId,
                        'start_at' => $calendarStartAt,
                        'end_at' => $calendarEndAt,
                    ]
                );

                if ((int) $calendarItem->approved_timeoff_id !== (int) $calendarTimeoff->id) {
                    $calendarItem->approved_timeoff_id = $calendarTimeoff->id;
                    $calendarItem->save();
                }
            }

            $pending = BookingLeaveRequest::query()->updateOrCreate(
                [
                    'staff_id' => $staffId,
                    'leave_type' => 'mc',
                    'start_date' => $today->copy()->addDays(3 + $index)->toDateString(),
                    'end_date' => $today->copy()->addDays(3 + $index)->toDateString(),
                ],
                [
                    'day_type' => 'full_day',
                    'days' => 1,
                    'reason' => 'Clinic follow-up (seeded pending)',
                    'status' => 'pending',
                    'admin_remark' => null,
                    'reviewed_by_user_id' => null,
                    'reviewed_at' => null,
                    'approved_timeoff_id' => null,
                ]
            );

            $leaveService->logAction(
                $staffId,
                (int) $pending->id,
                'created',
                null,
                ['status' => 'pending', 'day_type' => 'full_day', 'total_days' => (float) $pending->days],
                'Seeded pending leave request.',
                $userId
            );

            $rejected = BookingLeaveRequest::query()->updateOrCreate(
                [
                    'staff_id' => $staffId,
                    'leave_type' => 'emergency',
                    'start_date' => $today->copy()->subDays(4 + $index)->toDateString(),
                    'end_date' => $today->copy()->subDays(4 + $index)->toDateString(),
                ],
                [
                    'day_type' => 'half_day_pm',
                    'days' => 0.5,
                    'reason' => 'Personal errand (seeded rejected emergency half-day)',
                    'status' => 'rejected',
                    'admin_remark' => 'Rejected due to full roster coverage.',
                    'reviewed_by_user_id' => $userId,
                    'reviewed_at' => $today->copy()->subDays(5 + $index),
                    'approved_timeoff_id' => null,
                ]
            );

            $leaveService->logAction(
                $staffId,
                (int) $rejected->id,
                'rejected',
                ['status' => 'pending'],
                ['status' => 'rejected', 'day_type' => 'half_day_pm', 'total_days' => (float) $rejected->days],
                $rejected->admin_remark,
                $userId
            );
        }
    }
}
