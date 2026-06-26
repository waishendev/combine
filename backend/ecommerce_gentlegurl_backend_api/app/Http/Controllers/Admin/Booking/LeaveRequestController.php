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
        $query = BookingLeaveRequest::query()->with([
            'staff:id,name',
            'reviewer:id,name',
            'creationLog.creator:id,name',
        ]);

        if ($request->filled('status')) {
            $query->where('status', (string) $request->input('status'));
        }

        if ($request->filled('staff_id')) {
            $query->where('staff_id', (int) $request->input('staff_id'));
        }

        if ($request->filled('leave_type')) {
            $query->where('leave_type', (string) $request->input('leave_type'));
        }

        if ($request->filled('from_date')) {
            $query->whereDate('end_date', '>=', (string) $request->input('from_date'));
        }

        if ($request->filled('to_date')) {
            $query->whereDate('start_date', '<=', (string) $request->input('to_date'));
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
            return $this->leaveService->createApprovedOffDay(
                (int) $data['staff_id'],
                $startDate,
                $endDate,
                $data['reason'] ?? null,
                $request->user()?->id,
                'Off day set by admin'
            );
        });

        if (! $created) {
            return $this->respondError('There is already an overlapping leave/off-day request.', 422);
        }

        return $this->respond($created->fresh(['staff:id,name', 'reviewer:id,name', 'creationLog.creator:id,name']), null, true, 201);
    }

    public function generateOffDaysFromWeeklySchedule(Request $request)
    {
        $data = $request->validate([
            'staff_id' => ['required', 'integer', 'exists:staffs,id'],
            'target_month' => ['required', 'date_format:Y-m'],
            'days_of_week' => ['required', 'array', 'min:1'],
            'days_of_week.*' => ['integer', 'between:0,6', 'distinct'],
        ]);

        $staffId = (int) $data['staff_id'];
        $monthStart = Carbon::createFromFormat('Y-m', $data['target_month'])->startOfMonth();
        $monthEnd = $monthStart->copy()->endOfMonth();
        $targetWeekdays = array_values(array_unique(array_map('intval', $data['days_of_week'])));
        $weekdayLabels = $this->leaveService->weekdayLabels();
        $selectedDayNames = array_map(fn (int $day) => $weekdayLabels[$day] ?? (string) $day, $targetWeekdays);

        [$createdDates, $skippedDates] = DB::transaction(fn () => $this->generateOffDaysForWeekdaysInRange(
            $staffId,
            $monthStart,
            $monthEnd,
            $targetWeekdays,
            $request->user()?->id,
        ));

        return $this->respond([
            'staff_id' => $staffId,
            'target_month' => $data['target_month'],
            'days_of_week' => $targetWeekdays,
            'weekday_labels' => $selectedDayNames,
            'created_count' => count($createdDates),
            'skipped_count' => count($skippedDates),
            'created_dates' => $createdDates,
            'skipped_dates' => $skippedDates,
        ], 'Monthly off days generated for selected weekday(s).');
    }

    public function generateOffDaysFromWeeklyScheduleByYear(Request $request)
    {
        $data = $request->validate([
            'staff_id' => ['required', 'integer', 'exists:staffs,id'],
            'target_year' => ['required', 'integer', 'min:2000', 'max:2100'],
            'days_of_week' => ['required', 'array', 'min:1'],
            'days_of_week.*' => ['integer', 'between:0,6', 'distinct'],
        ]);

        $staffId = (int) $data['staff_id'];
        $yearStart = Carbon::createFromDate((int) $data['target_year'], 1, 1)->startOfDay();
        $yearEnd = $yearStart->copy()->endOfYear()->startOfDay();
        $targetWeekdays = array_values(array_unique(array_map('intval', $data['days_of_week'])));
        $weekdayLabels = $this->leaveService->weekdayLabels();
        $selectedDayNames = array_map(fn (int $day) => $weekdayLabels[$day] ?? (string) $day, $targetWeekdays);

        [$createdDates, $skippedDates] = DB::transaction(fn () => $this->generateOffDaysForWeekdaysInRange(
            $staffId,
            $yearStart,
            $yearEnd,
            $targetWeekdays,
            $request->user()?->id,
        ));

        return $this->respond([
            'staff_id' => $staffId,
            'target_year' => (int) $data['target_year'],
            'days_of_week' => $targetWeekdays,
            'weekday_labels' => $selectedDayNames,
            'created_count' => count($createdDates),
            'skipped_count' => count($skippedDates),
            'created_dates' => $createdDates,
            'skipped_dates' => $skippedDates,
        ], 'Yearly off days generated for selected weekday(s).');
    }

    /**
     * @return array{0: array<int, string>, 1: array<int, string>}
     */
    private function generateOffDaysForWeekdaysInRange(
        int $staffId,
        Carbon $rangeStart,
        Carbon $rangeEnd,
        array $targetWeekdays,
        ?int $userId,
    ): array {
        $weekdayLabels = $this->leaveService->weekdayLabels();
        $createdDates = [];
        $skippedDates = [];

        for ($cursor = $rangeStart->copy(); $cursor->lte($rangeEnd); $cursor->addDay()) {
            if (! in_array($cursor->dayOfWeek, $targetWeekdays, true)) {
                continue;
            }

            $dateKey = $cursor->toDateString();
            $weekdayLabel = $weekdayLabels[$cursor->dayOfWeek] ?? (string) $cursor->dayOfWeek;
            $reason = sprintf(
                'Auto-generated off day (%s, %s)',
                $weekdayLabel,
                $cursor->format('F Y')
            );

            $item = $this->leaveService->createApprovedOffDay(
                $staffId,
                $cursor->copy()->startOfDay(),
                $cursor->copy()->startOfDay(),
                $reason,
                $userId,
                'Off day generated for selected weekday(s)'
            );

            if ($item) {
                $createdDates[] = $dateKey;
            } else {
                $skippedDates[] = $dateKey;
            }
        }

        return [$createdDates, $skippedDates];
    }

    public function updateOffDay(Request $request, int $id)
    {
        $data = $request->validate([
            'start_date' => ['required', 'date'],
            'end_date' => ['required', 'date', 'after_or_equal:start_date'],
            'reason' => ['nullable', 'string', 'max:255'],
            'remark' => ['nullable', 'string', 'max:1000'],
        ]);

        $item = BookingLeaveRequest::query()->findOrFail($id);

        if ($item->leave_type !== 'off_day' || $item->status !== 'approved') {
            return $this->respondError('Only approved off days can be updated.', 422);
        }

        $startDate = Carbon::parse($data['start_date'])->startOfDay();
        $endDate = Carbon::parse($data['end_date'])->startOfDay();

        $updated = DB::transaction(function () use ($item, $data, $request, $startDate, $endDate) {
            return $this->leaveService->updateApprovedOffDay(
                $item,
                $startDate,
                $endDate,
                array_key_exists('reason', $data) ? ($data['reason'] ?? null) : $item->reason,
                $request->user()?->id,
                $data['remark'] ?? null
            );
        });

        if (! $updated) {
            return $this->respondError('There is already an overlapping leave/off-day request for the new date range.', 422);
        }

        return $this->respond($updated);
    }

    public function cancelOffDay(Request $request, int $id)
    {
        $data = $request->validate([
            'remark' => ['nullable', 'string', 'max:1000'],
        ]);

        $item = BookingLeaveRequest::query()->findOrFail($id);

        if ($item->leave_type !== 'off_day' || $item->status !== 'approved') {
            return $this->respondError('Only approved off days can be cancelled.', 422);
        }

        DB::transaction(function () use ($item, $data, $request) {
            $this->leaveService->cancelApprovedOffDay(
                $item,
                $request->user()?->id,
                $data['remark'] ?? null
            );
        });

        return $this->respond($item->fresh(['staff:id,name', 'reviewer:id,name', 'creationLog.creator:id,name']));
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

        return $this->respond($item->fresh(['staff:id,name', 'reviewer:id,name', 'creationLog.creator:id,name']));
    }
}
