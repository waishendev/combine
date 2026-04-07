<?php

namespace App\Http\Controllers\Booking;

use App\Http\Controllers\Controller;
use App\Models\Booking\BookingLeaveRequest;
use App\Services\Booking\BookingLeaveService;
use Carbon\Carbon;
use Illuminate\Http\Request;

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
            'leave_type' => ['required', 'in:annual,mc,off_day'],
            'start_date' => ['required', 'date'],
            'end_date' => ['required', 'date', 'after_or_equal:start_date'],
            'reason' => ['nullable', 'string', 'max:255'],
        ]);

        $start = Carbon::parse($data['start_date'])->startOfDay();
        $end = Carbon::parse($data['end_date'])->endOfDay();
        $days = (float) $start->diffInDays($end) + 1;

        if ($data['leave_type'] === 'annual') {
            $remaining = $this->leaveService->getRemainingAnnualDays($staffId);
            if ($days > $remaining) {
                return $this->respondError('Annual leave exceeds remaining balance.', 422, [
                    'requested_days' => $days,
                    'remaining_days' => $remaining,
                ]);
            }
        }

        $overlapExists = BookingLeaveRequest::query()
            ->where('staff_id', $staffId)
            ->whereIn('status', ['pending', 'approved'])
            ->whereDate('start_date', '<=', $data['end_date'])
            ->whereDate('end_date', '>=', $data['start_date'])
            ->exists();

        if ($overlapExists) {
            return $this->respondError('There is already an overlapping leave request.', 422);
        }

        $created = BookingLeaveRequest::create([
            'staff_id' => $staffId,
            'leave_type' => $data['leave_type'],
            'start_date' => $data['start_date'],
            'end_date' => $data['end_date'],
            'days' => $days,
            'reason' => $data['reason'] ?? null,
            'status' => 'pending',
        ]);

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

        if ($item->approvedTimeoff) {
            $item->approvedTimeoff->delete();
            $item->approved_timeoff_id = null;
        }

        $item->status = 'cancelled';
        $item->save();

        return $this->respond($item);
    }
}
