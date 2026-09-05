<?php

namespace App\Http\Controllers\Admin\Booking;

use App\Http\Controllers\Controller;
use App\Models\Booking\BookingLeaveBalance;
use App\Models\Staff;
use App\Services\Booking\BookingLeaveService;
use App\Services\StoreLocationAccessService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class LeaveBalanceController extends Controller
{
    public function __construct(
        private readonly BookingLeaveService $leaveService,
        private readonly StoreLocationAccessService $storeAccess,
    )
    {
    }

    public function index(Request $request)
    {
        $accessibleBranchIds = $this->storeAccess->accessibleStoreLocations($request->user(), false)
            ->pluck('store_locations.id');

        $staffQuery = Staff::query()
            ->select(['staffs.id', 'staffs.name'])
            ->whereHas('storeLocations', fn ($query) => $query->whereIn('store_locations.id', $accessibleBranchIds))
            ->with(['storeLocations' => fn ($query) => $query
                ->select(['store_locations.id', 'store_locations.name'])
                ->where('store_locations.is_active', true)
                ->whereIn('store_locations.id', $accessibleBranchIds)
                ->orderBy('store_locations.name')])
            ->orderBy('staffs.name');

        if ($request->filled('store_location_id')) {
            $branch = $this->storeAccess->authorizeStoreLocation($request->user(), (int) $request->input('store_location_id'), false);
            $staffQuery->whereHas('storeLocations', fn ($query) => $query->whereKey($branch->id));
        }

        $staffRows = $staffQuery->get();
        $staffIds = $staffRows->pluck('id');
        $entitlements = BookingLeaveBalance::query()->whereIn('staff_id', $staffIds)->get()->groupBy('staff_id');
        $used = \App\Models\Booking\BookingLeaveRequest::query()
            ->whereIn('staff_id', $staffIds)
            ->where('status', 'approved')
            ->whereIn('leave_type', ['annual', 'mc', 'emergency'])
            ->selectRaw('staff_id, leave_type, COALESCE(SUM(days), 0) as used_days')
            ->groupBy('staff_id', 'leave_type')
            ->get()->groupBy('staff_id');

        $data = $staffRows->map(function (Staff $staff) use ($entitlements, $used) {
            $staffEntitlements = $entitlements->get($staff->id, collect())->keyBy('leave_type');
            $staffUsed = $used->get($staff->id, collect())->keyBy('leave_type');
            $balances = collect(['annual', 'mc', 'emergency', 'unpaid'])->map(function (string $type) use ($staffEntitlements, $staffUsed) {
                $entitled = (float) ($staffEntitlements->get($type)?->entitled_days ?? 0);
                $usedDays = (float) ($staffUsed->get($type)?->used_days ?? 0);
                return ['leave_type' => $type, 'entitled_days' => $entitled, 'used_days' => $usedDays, 'remaining_days' => max(0, $entitled - $usedDays)];
            })->all();

            return [
                'staff_id' => $staff->id,
                'staff_name' => $staff->name,
                'store_locations' => $staff->storeLocations->map->only(['id', 'name'])->values(),
                'balances' => $balances,
            ];
        });

        return $this->respond($data);
    }

    public function upsert(Request $request, int $staffId)
    {
        $this->authorizeVisibleStaff($request, $staffId);

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
        $this->authorizeVisibleStaff($request, $staffId);

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

    private function authorizeVisibleStaff(Request $request, int $staffId): Staff
    {
        $accessibleIds = $this->storeAccess->accessibleStoreLocations($request->user(), false)
            ->pluck('store_locations.id');

        $staff = Staff::query()->whereKey($staffId)
            ->whereHas('storeLocations', fn ($query) => $query->whereIn('store_locations.id', $accessibleIds))
            ->first();

        abort_unless($staff, 403, 'You are not allowed to manage this Staff leave balance.');
        return $staff;
    }
}
