<?php

namespace App\Http\Controllers\Admin\Booking;

use App\Http\Controllers\Controller;
use App\Models\Booking\BookingLeaveLog;
use App\Services\StoreLocationAccessService;
use Carbon\Carbon;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\Request;

class LeaveLogController extends Controller
{
    public function __construct(
        private readonly StoreLocationAccessService $access,
    ) {}

    public function index(Request $request)
    {
        $query = $this->scopedLogsQuery($request);

        $actionType = (string) $request->input('action_type', '');
        if ($actionType !== '' && $actionType !== 'generated') {
            $query->where('action_type', $actionType);
        } else {
            $query->where('action_type', '!=', 'generated');
        }

        if ($request->filled('leave_request_id')) {
            $query->where('leave_request_id', (int) $request->input('leave_request_id'));
        }

        $this->applyDateFilters($query, $request);

        $rows = $query
            ->orderByDesc('created_at')
            ->paginate((int) $request->input('per_page', 20));

        return $this->respond($rows);
    }

    public function indexGenerations(Request $request)
    {
        $query = $this->scopedLogsQuery($request)->where('action_type', 'generated');
        $this->applyDateFilters($query, $request);

        $rows = $query
            ->orderByDesc('created_at')
            ->paginate((int) $request->input('per_page', 20));

        return $this->respond($rows);
    }

    private function scopedLogsQuery(Request $request): Builder
    {
        $query = BookingLeaveLog::query()
            ->with([
                'staff:id,name',
                'creator:id,name',
                'storeLocation:id,name',
                'leaveRequest:id,store_location_id',
                'leaveRequest.storeLocation:id,name',
            ]);

        $user = $request->user();
        $branchFilter = $request->input('store_location_id');

        if ($branchFilter !== null && $branchFilter !== '') {
            $branch = $this->access->authorizeStoreLocation($user, (int) $branchFilter);
            $query->where(function ($logs) use ($branch) {
                $logs->where('store_location_id', $branch->id)
                    ->orWhereHas('leaveRequest', fn ($leave) => $leave->where('store_location_id', $branch->id));
            });
        } else {
            $accessible = $this->access->accessibleStoreLocations($user)->pluck('store_locations.id');
            $query->where(function ($logs) use ($accessible) {
                $logs->whereNull('leave_request_id')
                    ->where(function ($scope) use ($accessible) {
                        $scope->whereNull('store_location_id')
                            ->orWhereIn('store_location_id', $accessible);
                    })
                    ->orWhereHas('leaveRequest', function ($leave) use ($accessible) {
                        $leave->whereIn('store_location_id', $accessible)->orWhereNull('store_location_id');
                    });
            });
        }

        if ($request->filled('staff_id')) {
            $query->where('staff_id', (int) $request->input('staff_id'));
        }

        return $query;
    }

    private function applyDateFilters(Builder $query, Request $request): void
    {
        if ($request->filled('from_date')) {
            $query->where('created_at', '>=', Carbon::parse((string) $request->input('from_date'))->startOfDay());
        }

        if ($request->filled('to_date')) {
            $query->where('created_at', '<=', Carbon::parse((string) $request->input('to_date'))->endOfDay());
        }
    }
}
