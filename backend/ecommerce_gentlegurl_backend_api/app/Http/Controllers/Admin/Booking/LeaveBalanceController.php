<?php

namespace App\Http\Controllers\Admin\Booking;

use App\Http\Controllers\Controller;
use App\Models\Booking\BookingLeaveBalance;
use App\Models\Staff;
use App\Services\Booking\BookingLeaveService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class LeaveBalanceController extends Controller
{
    public function __construct(private readonly BookingLeaveService $leaveService)
    {
    }

    public function index(Request $request)
    {
        $staffQuery = Staff::query()->select(['id', 'name'])->orderBy('name');
        if ($request->filled('store_location_id')) {
            $staffQuery->whereHas('storeLocations', fn ($query) => $query->whereKey((int) $request->input('store_location_id')));
        } elseif ($request->boolean('accessible_union')) {
            $ids = app(\App\Services\StoreLocationAccessService::class)->accessibleStoreLocations($request->user(), false)->pluck('store_locations.id');
            $staffQuery->whereHas('storeLocations', fn ($query) => $query->whereIn('store_locations.id', $ids));
        }
        $staffRows = $staffQuery->get();

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
            'leave_type' => ['required', 'in:annual,mc,emergency,unpaid'],
            'entitled_days' => ['required', 'numeric', 'min:0', 'max:366'],
            'remark' => ['nullable', 'string', 'max:1000'],
        ]);

        $row = DB::transaction(function () use ($staffId, $data, $request) {
            $existing = BookingLeaveBalance::query()
                ->where('staff_id', $staffId)
                ->where('leave_type', $data['leave_type'])
                ->first();

            $before = $existing ? [
                'leave_type' => $existing->leave_type,
                'entitled_days' => (float) $existing->entitled_days,
            ] : null;

            $row = BookingLeaveBalance::query()->updateOrCreate(
                [
                    'staff_id' => $staffId,
                    'leave_type' => $data['leave_type'],
                ],
                [
                    'entitled_days' => (float) $data['entitled_days'],
                ]
            );

            $this->leaveService->logAction(
                $staffId,
                null,
                'adjusted',
                $before,
                [
                    'leave_type' => $row->leave_type,
                    'entitled_days' => (float) $row->entitled_days,
                ],
                $data['remark'] ?? null,
                $request->user()?->id
            );

            return $row;
        });

        return $this->respond($row);
    }

    public function adjust(Request $request, int $staffId)
    {
        Staff::query()->findOrFail($staffId);

        $data = $request->validate([
            'leave_type' => ['required', 'in:annual,mc,emergency,unpaid'],
            'delta_days' => ['required', 'numeric', 'min:-366', 'max:366', 'not_in:0'],
            'remark' => ['nullable', 'string', 'max:1000'],
        ]);

        $row = DB::transaction(function () use ($staffId, $data, $request) {
            $existing = BookingLeaveBalance::query()
                ->where('staff_id', $staffId)
                ->where('leave_type', $data['leave_type'])
                ->first();

            $before = $existing ? [
                'leave_type' => $existing->leave_type,
                'entitled_days' => (float) $existing->entitled_days,
            ] : [
                'leave_type' => (string) $data['leave_type'],
                'entitled_days' => 0.0,
            ];

            $current = $existing ? (float) $existing->entitled_days : 0.0;
            $next = $current + (float) $data['delta_days'];
            $next = max(0.0, min(366.0, $next));

            $row = BookingLeaveBalance::query()->updateOrCreate(
                [
                    'staff_id' => $staffId,
                    'leave_type' => $data['leave_type'],
                ],
                [
                    'entitled_days' => $next,
                ]
            );

            $this->leaveService->logAction(
                $staffId,
                null,
                'adjusted',
                $before,
                [
                    'leave_type' => $row->leave_type,
                    'entitled_days' => (float) $row->entitled_days,
                ],
                $data['remark'] ?? null,
                $request->user()?->id
            );

            return $row;
        });

        return $this->respond($row);
    }
}
