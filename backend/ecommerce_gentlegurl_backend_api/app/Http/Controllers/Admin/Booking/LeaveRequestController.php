<?php

namespace App\Http\Controllers\Admin\Booking;

use App\Http\Controllers\Controller;
use App\Models\Booking\BookingLeaveLog;
use App\Models\Booking\BookingLeaveRequest;
use App\Models\Booking\BookingStaffTimeoff;
use App\Services\Booking\BookingLeaveService;
use App\Services\Booking\LeaveBranchService;
use Carbon\Carbon;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class LeaveRequestController extends Controller
{
    public function __construct(private readonly BookingLeaveService $leaveService, private readonly LeaveBranchService $branches)
    {
    }

    public function index(Request $request)
    {
        $query = BookingLeaveRequest::query()->with([
            'staff:id,name',
            'storeLocation:id,name',
            'reviewer:id,name',
            'creationLog.creator:id,name',
            'sourceLeaveRequest:id,leave_type,start_date,end_date,status,day_type,days,reason',
        ]);
        $this->branches->scopeVisible($query, $request->user(), $request->input('store_location_id'));

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
            'store_location_id' => ['nullable', 'integer'],
        ]);

        $branchId = $this->branches->resolveForCreation($request->user(), (int) $data['staff_id'], $data['store_location_id'] ?? null);

        $startDate = Carbon::parse($data['start_date'])->startOfDay();
        $endDate = Carbon::parse($data['end_date'])->startOfDay();

        if ($this->leaveService->hasOverlappingRequest((int) $data['staff_id'], $startDate, $endDate, 'full_day', null, $branchId)) {
            return $this->respondError('There is already an overlapping leave/off-day request.', 422);
        }

        $created = DB::transaction(function () use ($data, $request, $startDate, $endDate, $branchId) {
            return $this->leaveService->createApprovedOffDay(
                (int) $data['staff_id'],
                $startDate,
                $endDate,
                $data['reason'] ?? null,
                $request->user()?->id,
                'Off day set by admin'
                , $branchId
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
            'store_location_id' => ['nullable', 'integer'],
        ]);

        $staffId = (int) $data['staff_id'];
        $branchId = $this->branches->resolveForCreation($request->user(), $staffId, $data['store_location_id'] ?? null);
        $monthStart = Carbon::createFromFormat('Y-m', $data['target_month'])->startOfMonth();
        $monthEnd = $monthStart->copy()->endOfMonth();
        $targetWeekdays = array_values(array_unique(array_map('intval', $data['days_of_week'])));
        $weekdayLabels = $this->leaveService->weekdayLabels();
        $selectedDayNames = array_map(fn (int $day) => $weekdayLabels[$day] ?? (string) $day, $targetWeekdays);

        [$createdIds, $createdDates, $skippedDates, $generationLogId] = DB::transaction(function () use (
            $staffId,
            $monthStart,
            $monthEnd,
            $targetWeekdays,
            $request,
            $branchId,
            $data,
            $selectedDayNames,
        ) {
            [$createdIds, $createdDates, $skippedDates] = $this->generateOffDaysForWeekdaysInRange(
                $staffId,
                $monthStart,
                $monthEnd,
                $targetWeekdays,
                $request->user()?->id,
                $branchId,
            );

            $generationLog = $this->leaveService->logAction(
                $staffId,
                null,
                'generated',
                null,
                [
                    'scope' => 'month',
                    'target_month' => $data['target_month'],
                    'target_year' => null,
                    'days_of_week' => $targetWeekdays,
                    'weekday_labels' => $selectedDayNames,
                    'store_location_id' => $branchId,
                    'created_ids' => $createdIds,
                    'created_dates' => $createdDates,
                    'created_count' => count($createdIds),
                    'skipped_count' => count($skippedDates),
                    'skipped_dates' => $skippedDates,
                    'reverted_at' => null,
                    'cancelled_ids' => [],
                ],
                sprintf(
                    'Generated %d monthly off day(s) for %s (%s).',
                    count($createdIds),
                    $data['target_month'],
                    implode(', ', $selectedDayNames)
                ),
                $request->user()?->id,
                $branchId,
            );

            return [$createdIds, $createdDates, $skippedDates, (int) $generationLog->id];
        });

        return $this->respond([
            'staff_id' => $staffId,
            'target_month' => $data['target_month'],
            'days_of_week' => $targetWeekdays,
            'weekday_labels' => $selectedDayNames,
            'created_count' => count($createdIds),
            'skipped_count' => count($skippedDates),
            'created_ids' => $createdIds,
            'created_dates' => $createdDates,
            'skipped_dates' => $skippedDates,
            'generation_log_id' => $generationLogId,
        ], 'Monthly off days generated for selected weekday(s).');
    }

    public function generateOffDaysFromWeeklyScheduleByYear(Request $request)
    {
        $data = $request->validate([
            'staff_id' => ['required', 'integer', 'exists:staffs,id'],
            'target_year' => ['required', 'integer', 'min:2000', 'max:2100'],
            'days_of_week' => ['required', 'array', 'min:1'],
            'days_of_week.*' => ['integer', 'between:0,6', 'distinct'],
            'store_location_id' => ['nullable', 'integer'],
        ]);

        $staffId = (int) $data['staff_id'];
        $branchId = $this->branches->resolveForCreation($request->user(), $staffId, $data['store_location_id'] ?? null);
        $yearStart = Carbon::createFromDate((int) $data['target_year'], 1, 1)->startOfDay();
        $yearEnd = $yearStart->copy()->endOfYear()->startOfDay();
        $targetWeekdays = array_values(array_unique(array_map('intval', $data['days_of_week'])));
        $weekdayLabels = $this->leaveService->weekdayLabels();
        $selectedDayNames = array_map(fn (int $day) => $weekdayLabels[$day] ?? (string) $day, $targetWeekdays);

        [$createdIds, $createdDates, $skippedDates, $generationLogId] = DB::transaction(function () use (
            $staffId,
            $yearStart,
            $yearEnd,
            $targetWeekdays,
            $request,
            $branchId,
            $data,
            $selectedDayNames,
        ) {
            [$createdIds, $createdDates, $skippedDates] = $this->generateOffDaysForWeekdaysInRange(
                $staffId,
                $yearStart,
                $yearEnd,
                $targetWeekdays,
                $request->user()?->id,
                $branchId,
            );

            $generationLog = $this->leaveService->logAction(
                $staffId,
                null,
                'generated',
                null,
                [
                    'scope' => 'year',
                    'target_month' => null,
                    'target_year' => (int) $data['target_year'],
                    'days_of_week' => $targetWeekdays,
                    'weekday_labels' => $selectedDayNames,
                    'store_location_id' => $branchId,
                    'created_ids' => $createdIds,
                    'created_dates' => $createdDates,
                    'created_count' => count($createdIds),
                    'skipped_count' => count($skippedDates),
                    'skipped_dates' => $skippedDates,
                    'reverted_at' => null,
                    'cancelled_ids' => [],
                ],
                sprintf(
                    'Generated %d yearly off day(s) for %d (%s).',
                    count($createdIds),
                    (int) $data['target_year'],
                    implode(', ', $selectedDayNames)
                ),
                $request->user()?->id,
                $branchId,
            );

            return [$createdIds, $createdDates, $skippedDates, (int) $generationLog->id];
        });

        return $this->respond([
            'staff_id' => $staffId,
            'target_year' => (int) $data['target_year'],
            'days_of_week' => $targetWeekdays,
            'weekday_labels' => $selectedDayNames,
            'created_count' => count($createdIds),
            'skipped_count' => count($skippedDates),
            'created_ids' => $createdIds,
            'created_dates' => $createdDates,
            'skipped_dates' => $skippedDates,
            'generation_log_id' => $generationLogId,
        ], 'Yearly off days generated for selected weekday(s).');
    }

    /**
     * @return array{0: array<int, int>, 1: array<int, string>, 2: array<int, string>}
     */
    private function generateOffDaysForWeekdaysInRange(
        int $staffId,
        Carbon $rangeStart,
        Carbon $rangeEnd,
        array $targetWeekdays,
        ?int $userId,
        int $branchId,
    ): array {
        $weekdayLabels = $this->leaveService->weekdayLabels();
        $createdIds = [];
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
                , $branchId
            );

            if ($item) {
                $createdIds[] = (int) $item->id;
                $createdDates[] = $dateKey;
            } else {
                $skippedDates[] = $dateKey;
            }
        }

        return [$createdIds, $createdDates, $skippedDates];
    }

    public function cancelGeneratedOffDays(Request $request)
    {
        $data = $request->validate([
            'leave_log_id' => ['nullable', 'integer', 'min:1'],
            'ids' => ['nullable', 'array', 'min:1', 'max:400'],
            'ids.*' => ['integer', 'distinct', 'min:1'],
            'remark' => ['nullable', 'string', 'max:1000'],
        ]);

        $leaveLogId = isset($data['leave_log_id']) ? (int) $data['leave_log_id'] : null;
        $ids = array_values(array_unique(array_map('intval', $data['ids'] ?? [])));
        $remark = $data['remark'] ?? 'Undo off-day generation.';

        if ($leaveLogId) {
            return $this->revertGenerationLogInternal($request, $leaveLogId, $remark);
        }

        if ($ids === []) {
            return $this->respondError('Provide leave_log_id or ids to undo.', 422);
        }

        [$cancelledIds, $skippedIds] = $this->cancelOffDayIds($request, $ids, $remark);

        return $this->respond([
            'cancelled_count' => count($cancelledIds),
            'skipped_count' => count($skippedIds),
            'cancelled_ids' => $cancelledIds,
            'skipped_ids' => $skippedIds,
        ], 'Generated off days undone.');
    }

    public function revertGenerationLog(Request $request, int $id)
    {
        $data = $request->validate([
            'remark' => ['nullable', 'string', 'max:1000'],
        ]);

        return $this->revertGenerationLogInternal(
            $request,
            $id,
            $data['remark'] ?? 'Revert off-day generation from leave logs.',
        );
    }

    private function revertGenerationLogInternal(Request $request, int $leaveLogId, string $remark)
    {
        $log = BookingLeaveLog::query()->findOrFail($leaveLogId);
        if ((string) $log->action_type !== 'generated') {
            return $this->respondError('Only generated off-day batches can be reverted.', 422);
        }

        $after = is_array($log->after_value) ? $log->after_value : [];
        if (! empty($after['reverted_at'])) {
            return $this->respondError('This generation batch was already reverted.', 422);
        }

        $ids = array_values(array_unique(array_map('intval', $after['created_ids'] ?? [])));
        if ($ids === []) {
            return $this->respondError('This generation batch has no off days to revert.', 422);
        }

        if ($log->store_location_id) {
            app(\App\Services\StoreLocationAccessService::class)
                ->authorizeStoreLocation($request->user(), (int) $log->store_location_id);
        }

        [$cancelledIds, $skippedIds] = $this->cancelOffDayIds($request, $ids, $remark);

        $log->after_value = array_merge($after, [
            'reverted_at' => now()->toIso8601String(),
            'reverted_by' => $request->user()?->id,
            'cancelled_ids' => $cancelledIds,
            'skipped_ids' => $skippedIds,
            'cancelled_count' => count($cancelledIds),
            'revert_skipped_count' => count($skippedIds),
        ]);
        $log->remark = trim((string) ($log->remark ?? '')).' [Reverted]';
        $log->save();

        return $this->respond([
            'leave_log_id' => (int) $log->id,
            'cancelled_count' => count($cancelledIds),
            'skipped_count' => count($skippedIds),
            'cancelled_ids' => $cancelledIds,
            'skipped_ids' => $skippedIds,
            'leave_log' => $log->fresh(['staff:id,name', 'creator:id,name', 'storeLocation:id,name']),
        ], 'Generated off days reverted.');
    }

    /**
     * @param  array<int, int>  $ids
     * @return array{0: array<int, int>, 1: array<int, int>}
     */
    private function cancelOffDayIds(Request $request, array $ids, string $remark): array
    {
        $cancelledIds = [];
        $skippedIds = [];

        DB::transaction(function () use ($request, $ids, $remark, &$cancelledIds, &$skippedIds) {
            $items = BookingLeaveRequest::query()
                ->whereIn('id', $ids)
                ->lockForUpdate()
                ->get()
                ->keyBy('id');

            foreach ($ids as $id) {
                $item = $items->get($id);
                if (! $item) {
                    $skippedIds[] = $id;
                    continue;
                }

                $this->branches->authorizeRecord($request->user(), $item);

                if ($item->leave_type !== 'off_day' || $item->status !== 'approved') {
                    $skippedIds[] = $id;
                    continue;
                }

                $ok = $this->leaveService->cancelApprovedOffDay(
                    $item,
                    $request->user()?->id,
                    $remark
                );

                if ($ok) {
                    $cancelledIds[] = $id;
                } else {
                    $skippedIds[] = $id;
                }
            }
        });

        return [$cancelledIds, $skippedIds];
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
        $this->branches->authorizeRecord($request->user(), $item);

        $editableTypes = ['off_day', 'annual', 'mc', 'emergency', 'unpaid'];
        if ($item->status !== 'approved' || ! in_array((string) $item->leave_type, $editableTypes, true)) {
            return $this->respondError('Only approved leave / off days can be updated.', 422);
        }

        $startDate = Carbon::parse($data['start_date'])->startOfDay();
        $endDate = Carbon::parse($data['end_date'])->startOfDay();
        $dayType = (string) ($item->day_type ?: 'full_day');
        $newDays = $this->leaveService->calculateRequestedDays($startDate, $endDate, $dayType);

        // Balance-backed leave: remaining already subtracts this record's days,
        // so available headroom is remaining + current days.
        if (in_array((string) $item->leave_type, ['annual', 'mc', 'emergency'], true)) {
            $remaining = $this->leaveService->getRemainingDaysByType((int) $item->staff_id, (string) $item->leave_type);
            $available = $remaining + (float) $item->days;
            if ($newDays > $available + 0.0001) {
                return $this->respondError(
                    sprintf('Insufficient leave balance. Requested %.1f day(s), available %.1f day(s).', $newDays, $available),
                    422
                );
            }
        }

        $updated = DB::transaction(function () use ($item, $data, $request, $startDate, $endDate) {
            return $this->leaveService->updateApprovedLeaveDates(
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
        $this->branches->authorizeRecord($request->user(), $item);

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
        $this->branches->authorizeRecord($request->user(), $item);

        if ($item->status !== 'pending') {
            return $this->respondError('Only pending requests can be reviewed.', 422);
        }

        if (($item->request_kind ?? 'new') === 'date_change') {
            if ($data['status'] === 'approved') {
                $applied = DB::transaction(function () use ($item, $data, $request) {
                    return $this->leaveService->applyApprovedDateChange(
                        $item,
                        $request->user()?->id,
                        $data['admin_remark'] ?? null,
                    );
                });

                if (! $applied) {
                    return $this->respondError('Unable to approve day change. The original leave may have passed or the new date overlaps.', 422);
                }
            } else {
                $restored = DB::transaction(function () use ($item, $data, $request) {
                    return $this->leaveService->finalizeRejectedOrCancelledDateChange(
                        $item,
                        'rejected',
                        $request->user()?->id,
                        $data['admin_remark'] ?? null,
                    );
                });

                if (! $restored) {
                    return $this->respondError('Unable to reject day change.', 422);
                }
            }

            return $this->respond($item->fresh(['staff:id,name', 'reviewer:id,name', 'creationLog.creator:id,name', 'sourceLeaveRequest']));
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
                    , $item->store_location_id ? (int) $item->store_location_id : null
                );

                $timeoff = BookingStaffTimeoff::create([
                    'staff_id' => $item->staff_id,
                    'store_location_id' => $item->store_location_id,
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
