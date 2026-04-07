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
use Illuminate\Support\Facades\Hash;

class BookingLeaveTestingSeeder extends Seeder
{
    public function run(): void
    {
        $staffUsers = $this->seedStaffUsers();
        $this->seedBalances($staffUsers);
        $this->seedLeaveRequests($staffUsers);
    }

    /**
     * @return array<int, array{staff:Staff,user:User}>
     */
    private function seedStaffUsers(): array
    {
        $profiles = [
            ['code' => 'LM-STF-001', 'name' => 'Alicia Tan', 'email' => 'alicia.tan.leave@example.com', 'phone' => '60111234001', 'position' => 'Senior Stylist'],
            ['code' => 'LM-STF-002', 'name' => 'Brandon Lee', 'email' => 'brandon.lee.leave@example.com', 'phone' => '60111234002', 'position' => 'Stylist'],
            ['code' => 'LM-STF-003', 'name' => 'Carmen Lim', 'email' => 'carmen.lim.leave@example.com', 'phone' => '60111234003', 'position' => 'Nail Artist'],
            ['code' => 'LM-STF-004', 'name' => 'Daniel Wong', 'email' => 'daniel.wong.leave@example.com', 'phone' => '60111234004', 'position' => 'Therapist'],
        ];

        $rows = [];
        foreach ($profiles as $profile) {
            $staff = Staff::query()->updateOrCreate(
                ['code' => $profile['code']],
                [
                    'name' => $profile['name'],
                    'email' => $profile['email'],
                    'phone' => $profile['phone'],
                    'position' => $profile['position'],
                    'commission_rate' => 0,
                    'service_commission_rate' => 0,
                    'is_active' => true,
                ]
            );

            $baseUsername = strtolower(str_replace(' ', '.', $profile['name']));
            $user = User::query()->updateOrCreate(
                ['email' => $profile['email']],
                [
                    'name' => $profile['name'],
                    'username' => $baseUsername,
                    'password' => Hash::make('Password123!'),
                    'is_active' => true,
                    'staff_id' => $staff->id,
                ]
            );

            $rows[] = ['staff' => $staff, 'user' => $user];
        }

        return $rows;
    }

    /**
     * @param array<int, array{staff:Staff,user:User}> $staffUsers
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
                ['staff_id' => $staffId, 'leave_type' => 'off_day'],
                ['entitled_days' => 8]
            );
        }
    }

    /**
     * @param array<int, array{staff:Staff,user:User}> $staffUsers
     */
    private function seedLeaveRequests(array $staffUsers): void
    {
        $leaveService = app(BookingLeaveService::class);
        $today = Carbon::today();

        foreach ($staffUsers as $index => $row) {
            $staffId = (int) $row['staff']->id;
            $userId = (int) $row['user']->id;

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
                ['status' => 'approved', 'days' => (float) $approved->days],
                'Seeded approved leave request.',
                $userId
            );

            $pending = BookingLeaveRequest::query()->updateOrCreate(
                [
                    'staff_id' => $staffId,
                    'leave_type' => 'mc',
                    'start_date' => $today->copy()->addDays(3 + $index)->toDateString(),
                    'end_date' => $today->copy()->addDays(3 + $index)->toDateString(),
                ],
                [
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
                ['status' => 'pending', 'days' => (float) $pending->days],
                'Seeded pending leave request.',
                $userId
            );

            $rejected = BookingLeaveRequest::query()->updateOrCreate(
                [
                    'staff_id' => $staffId,
                    'leave_type' => 'off_day',
                    'start_date' => $today->copy()->subDays(4 + $index)->toDateString(),
                    'end_date' => $today->copy()->subDays(4 + $index)->toDateString(),
                ],
                [
                    'days' => 1,
                    'reason' => 'Personal errand (seeded rejected)',
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
                ['status' => 'rejected', 'days' => (float) $rejected->days],
                $rejected->admin_remark,
                $userId
            );
        }
    }
}
