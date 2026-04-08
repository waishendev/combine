<?php

namespace App\Http\Controllers\Booking;

use App\Http\Controllers\Controller;
use App\Models\Booking\BookingLeaveRequest;
use App\Services\Booking\BookingLeaveService;
use Carbon\Carbon;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class MyLeaveController extends Controller
{
    public function __construct(private readonly BookingLeaveService $leaveService)
    {
    }

    public function indexBalances(Request $request)
    {
        $staffId = (int) ($request->user()?->staff_id ?? 0);
        if ($staffId <= 0) {
            return $this->respondError('This account is not linked to a staff profile.', 403);
        }

        return $this->respond($this->leaveService->getBalanceSummaryForStaff($staffId));
    }

    public function indexRequests(Request $request)
    {
        $staffId = (int) ($request->user()?->staff_id ?? 0);
        if ($staffId <= 0) {
            return $this->respondError('This account is not linked to a staff profile.', 403);
        }

        $rows = BookingLeaveRequest::query()
            ->where('staff_id', $staffId)
            ->orderByDesc('created_at')
            ->paginate((int) $request->input('per_page', 20));

        return $this->respond($rows);
    }

    public function store(Request $request)
    {
        $staffId = (int) ($request->user()?->staff_id ?? 0);
        if ($staffId <= 0) {
            return $this->respondError('This account is not linked to a staff profile.', 403);
        }

        $data = $request->validate([
            'leave_type' => ['required', 'in:annual,mc,emergency,unpaid'],
            'day_type' => ['required', 'in:full_day,half_day_am,half_day_pm'],
            'start_date' => ['required', 'date'],
            'end_date' => ['required', 'date', 'after_or_equal:start_date'],
            'reason' => ['nullable', 'string', 'max:255'],
        ]);

        $startDate = Carbon::parse($data['start_date'])->startOfDay();
        $endDate = Carbon::parse($data['end_date'])->startOfDay();

        if (! $startDate->isSameDay($endDate) && $data['day_type'] !== 'full_day') {
            return $this->respondError('Multi-day leave currently supports full day only.', 422);
        }


        if ($data['leave_type'] !== 'emergency' && $data['day_type'] !== 'full_day') {
            return $this->respondError('Only Emergency Leave supports half-day requests.', 422);
        }

        $days = $this->leaveService->calculateRequestedDays($startDate, $endDate, (string) $data['day_type']);

        if (in_array($data['leave_type'], ['annual', 'mc', 'emergency'], true)) {
            $remaining = $this->leaveService->getRemainingDaysByType($staffId, (string) $data['leave_type']);
            if ($days > $remaining) {
                return $this->respondError('Leave exceeds remaining balance.', 422, [
                    'requested_days' => $days,
                    'remaining_days' => $remaining,
                    'leave_type' => $data['leave_type'],
                ]);
            }
        }

        if ($this->leaveService->hasOverlappingRequest($staffId, $startDate, $endDate, (string) $data['day_type'])) {
            return $this->respondError('There is already an overlapping leave request.', 422);
        }

        $created = DB::transaction(function () use ($staffId, $data, $days, $request) {
            $created = BookingLeaveRequest::create([
                'staff_id' => $staffId,
                'leave_type' => $data['leave_type'],
                'day_type' => $data['day_type'],
                'start_date' => $data['start_date'],
                'end_date' => $data['end_date'],
                'days' => $days,
                'reason' => $data['reason'] ?? null,
                'status' => 'pending',
            ]);

            $this->leaveService->logAction(
                $staffId,
                (int) $created->id,
                'created',
                null,
                [
                    'status' => $created->status,
                    'leave_type' => $created->leave_type,
                    'day_type' => $created->day_type,
                    'start_date' => (string) $created->start_date,
                    'end_date' => (string) $created->end_date,
                    'total_days' => (float) $created->days,
                ],
                $created->reason,
                $request->user()?->id
            );

            return $created;
        });

        return $this->respond($created, null, true, 201);
    }

    public function cancel(Request $request, int $id)
    {
        $staffId = (int) ($request->user()?->staff_id ?? 0);
        if ($staffId <= 0) {
            return $this->respondError('This account is not linked to a staff profile.', 403);
        }

        $item = BookingLeaveRequest::query()
            ->where('staff_id', $staffId)
            ->findOrFail($id);

        if (! in_array($item->status, ['pending', 'approved'], true)) {
            return $this->respondError('Only pending or approved leave can be cancelled.', 422);
        }

        DB::transaction(function () use ($item, $request) {
            $before = [
                'status' => $item->status,
                'approved_timeoff_id' => $item->approved_timeoff_id,
                'day_type' => $item->day_type,
                'total_days' => (float) $item->days,
            ];

            if ($item->approvedTimeoff) {
                $item->approvedTimeoff->delete();
                $item->approved_timeoff_id = null;
            }

            $item->status = 'cancelled';
            $item->save();

            $this->leaveService->logAction(
                (int) $item->staff_id,
                (int) $item->id,
                'cancelled',
                $before,
                [
                    'status' => $item->status,
                    'approved_timeoff_id' => $item->approved_timeoff_id,
                    'day_type' => $item->day_type,
                    'total_days' => (float) $item->days,
                ],
                'Cancelled by staff.',
                $request->user()?->id
            );
        });

        return $this->respond($item->fresh());
    }
}
