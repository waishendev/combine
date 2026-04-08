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



    public function storeOffDay(Request $request)
    {
        $data = $request->validate([
            'staff_id' => ['required', 'integer', 'exists:staffs,id'],
            'start_date' => ['required', 'date'],
            'end_date' => ['required', 'date', 'after_or_equal:start_date'],
            'reason' => ['nullable', 'string', 'max:255'],
        ]);

        $startDate = Carbon::parse($data['start_date'])->startOfDay();
        $endDate = Carbon::parse($data['end_date'])->startOfDay();

        if ($this->leaveService->hasOverlappingRequest((int) $data['staff_id'], $startDate, $endDate, 'full_day')) {
            return $this->respondError('There is already an overlapping leave/off-day request.', 422);
        }

        $created = DB::transaction(function () use ($data, $request, $startDate, $endDate) {
            $days = $this->leaveService->calculateRequestedDays($startDate, $endDate, 'full_day');

            $item = BookingLeaveRequest::query()->create([
                'staff_id' => (int) $data['staff_id'],
                'leave_type' => 'off_day',
                'day_type' => 'full_day',
                'start_date' => $data['start_date'],
                'end_date' => $data['end_date'],
                'days' => $days,
                'reason' => $data['reason'] ?? null,
                'status' => 'approved',
                'admin_remark' => 'Off day set by admin',
                'reviewed_by_user_id' => $request->user()?->id,
                'reviewed_at' => now(),
            ]);

            [$startAt, $endAt] = $this->leaveService->resolveTimeoffWindow(
                (int) $item->staff_id,
                $startDate,
                $endDate,
                'full_day'
            );

            $timeoff = BookingStaffTimeoff::create([
                'staff_id' => $item->staff_id,
                'start_at' => $startAt,
                'end_at' => $endAt,
                'reason' => sprintf('Off day #%d', $item->id),
            ]);

            $item->approved_timeoff_id = $timeoff->id;
            $item->save();

            $this->leaveService->logAction(
                (int) $item->staff_id,
                (int) $item->id,
                'approved',
                null,
                [
                    'status' => $item->status,
                    'leave_type' => $item->leave_type,
                    'day_type' => $item->day_type,
                    'total_days' => (float) $item->days,
                    'approved_timeoff_id' => $item->approved_timeoff_id,
                ],
                'Off day created by admin.',
                $request->user()?->id
            );

            return $item;
        });

        return $this->respond($created->fresh(['staff:id,name', 'reviewer:id,name']), null, true, 201);
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
                'day_type' => $item->day_type,
                'total_days' => (float) $item->days,
                'admin_remark' => $item->admin_remark,
                'reviewed_by_user_id' => $item->reviewed_by_user_id,
                'approved_timeoff_id' => $item->approved_timeoff_id,
            ];

            if ($data['status'] === 'approved') {
                [$startAt, $endAt] = $this->leaveService->resolveTimeoffWindow(
                    (int) $item->staff_id,
                    Carbon::parse((string) $item->start_date)->startOfDay(),
                    Carbon::parse((string) $item->end_date)->startOfDay(),
                    (string) ($item->day_type ?: 'full_day')
                );

                $timeoff = BookingStaffTimeoff::create([
                    'staff_id' => $item->staff_id,
                    'start_at' => $startAt,
                    'end_at' => $endAt,
                    'reason' => sprintf('Leave request #%d (%s %s)', $item->id, $item->leave_type, $item->day_type ?: 'full_day'),
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
                    'day_type' => $item->day_type,
                    'total_days' => (float) $item->days,
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
