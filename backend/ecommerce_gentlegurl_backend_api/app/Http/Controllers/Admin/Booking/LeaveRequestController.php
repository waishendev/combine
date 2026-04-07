<?php

namespace App\Http\Controllers\Admin\Booking;

use App\Http\Controllers\Controller;
use App\Models\Booking\BookingLeaveRequest;
use App\Models\Booking\BookingStaffTimeoff;
use App\Services\Booking\BookingLeaveService;
use Carbon\Carbon;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class LeaveRequestController extends Controller
{
    public function __construct(private readonly BookingLeaveService $leaveService)
    {
    }

    public function index(Request $request)
    {
        $query = BookingLeaveRequest::query()->with(['staff:id,name', 'reviewer:id,name']);

        if ($request->filled('status')) {
            $query->where('status', (string) $request->input('status'));
        }

        if ($request->filled('staff_id')) {
            $query->where('staff_id', (int) $request->input('staff_id'));
        }

        return $this->respond($query->orderByDesc('created_at')->paginate((int) $request->input('per_page', 30)));
    }

    public function decide(Request $request, int $id)
    {
        $data = $request->validate([
            'status' => ['required', 'in:approved,rejected'],
            'admin_remark' => ['nullable', 'string', 'max:1000'],
        ]);

        $item = BookingLeaveRequest::query()->findOrFail($id);

        if ($item->status !== 'pending') {
            return $this->respondError('Only pending requests can be reviewed.', 422);
        }

        DB::transaction(function () use ($item, $data, $request) {
            $before = [
                'status' => $item->status,
                'admin_remark' => $item->admin_remark,
                'reviewed_by_user_id' => $item->reviewed_by_user_id,
                'approved_timeoff_id' => $item->approved_timeoff_id,
            ];

            if ($data['status'] === 'approved') {
                $startAt = Carbon::parse($item->start_date)->startOfDay();
                $endAt = Carbon::parse($item->end_date)->endOfDay();

                $timeoff = BookingStaffTimeoff::create([
                    'staff_id' => $item->staff_id,
                    'start_at' => $startAt,
                    'end_at' => $endAt,
                    'reason' => sprintf('Leave request #%d (%s)', $item->id, $item->leave_type),
                ]);

                $item->approved_timeoff_id = $timeoff->id;
            }

            $item->status = $data['status'];
            $item->admin_remark = $data['admin_remark'] ?? null;
            $item->reviewed_by_user_id = $request->user()?->id;
            $item->reviewed_at = now();
            $item->save();

            $this->leaveService->logAction(
                (int) $item->staff_id,
                (int) $item->id,
                $data['status'] === 'approved' ? 'approved' : 'rejected',
                $before,
                [
                    'status' => $item->status,
                    'admin_remark' => $item->admin_remark,
                    'reviewed_by_user_id' => $item->reviewed_by_user_id,
                    'approved_timeoff_id' => $item->approved_timeoff_id,
                ],
                $item->admin_remark,
                $request->user()?->id
            );
        });

        return $this->respond($item->fresh(['staff:id,name', 'reviewer:id,name']));
    }
}
