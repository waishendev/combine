<?php

namespace App\Http\Controllers\Admin\Booking;

use App\Http\Controllers\Controller;
use App\Models\Booking\BookingLeaveBalance;
use App\Models\Staff;
use App\Services\Booking\BookingLeaveService;
use Illuminate\Http\Request;

class LeaveBalanceController extends Controller
{
    public function __construct(private readonly BookingLeaveService $leaveService)
    {
    }

    public function index()
    {
        $staffRows = Staff::query()->select(['id', 'name'])->orderBy('name')->get();

        $data = $staffRows->map(function (Staff $staff) {
            return [
                'staff_id' => $staff->id,
                'staff_name' => $staff->name,
                'balances' => $this->leaveService->getBalanceSummaryForStaff((int) $staff->id),
            ];
        });

        return $this->respond($data);
    }

    public function upsert(Request $request, int $staffId)
    {
        Staff::query()->findOrFail($staffId);

        $data = $request->validate([
            'leave_type' => ['required', 'in:annual,mc,off_day'],
            'entitled_days' => ['required', 'numeric', 'min:0', 'max:366'],
        ]);

        $row = BookingLeaveBalance::query()->updateOrCreate(
            [
                'staff_id' => $staffId,
                'leave_type' => $data['leave_type'],
            ],
            [
                'entitled_days' => (float) $data['entitled_days'],
            ]
        );

        return $this->respond($row);
    }
}
