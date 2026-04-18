<?php

namespace App\Http\Controllers\Admin\Booking;

use App\Http\Controllers\Controller;
use App\Models\Booking\StaffMonthlySale;
use App\Services\Booking\StaffCommissionService;
use Illuminate\Http\Request;

class CommissionController extends Controller
{
    public function __construct(private readonly StaffCommissionService $staffCommissionService)
    {
    }

    public function index(Request $request)
    {
        $type = $this->staffCommissionService->normalizeType($request->query('type', StaffCommissionService::TYPE_BOOKING));

        $query = StaffMonthlySale::query()
            ->with('staff:id,name')
            ->where('type', $type);

        if ($request->filled('year')) {
            $query->where('year', (int) $request->query('year'));
        }

        if ($request->filled('month')) {
            $query->where('month', (int) $request->query('month'));
        }

        if ($request->filled('staff_id')) {
            $query->where('staff_id', (int) $request->query('staff_id'));
        }

        return $this->respond($query->orderByDesc('year')->orderByDesc('month')->paginate($request->integer('per_page', 20)));
    }

    public function override(Request $request, int $id)
    {
        $data = $request->validate([
            'is_overridden' => ['required', 'boolean'],
            'override_amount' => ['nullable', 'numeric', 'min:0'],
        ]);

        $monthly = StaffMonthlySale::query()->findOrFail($id);
        if ($this->staffCommissionService->isFrozen($monthly)) {
            return $this->respondError('Frozen month cannot be overridden. Please reopen first.', 422);
        }

        $before = $monthly->only([
            'is_overridden', 'override_amount', 'commission_amount', 'tier_percent', 'tier_percent_snapshot',
        ]);
        $monthly->is_overridden = (bool) $data['is_overridden'];
        $monthly->override_amount = $monthly->is_overridden
            ? (float) ($data['override_amount'] ?? 0)
            : null;

        $monthly->save();

        $this->staffCommissionService->recalculateMonthly($monthly);
        $monthly = $monthly->fresh('staff:id,name');

        $this->staffCommissionService->logAction(
            'OVERRIDE',
            $monthly,
            $before,
            $monthly->only([
                'is_overridden', 'override_amount', 'commission_amount', 'tier_percent', 'tier_percent_snapshot',
            ]),
            optional($request->user())->id
        );

        return $this->respond($monthly);
    }

    public function recalculate(Request $request)
    {
        $data = $request->validate([
            'year' => ['required', 'integer', 'min:2000', 'max:3000'],
            'month' => ['required', 'integer', 'min:1', 'max:12'],
            'staff_id' => ['nullable', 'integer', 'exists:staffs,id'],
            'type' => ['nullable', 'string', 'in:BOOKING,ECOMMERCE,booking,ecommerce'],
            'force' => ['nullable', 'boolean'],
        ]);

        $year = (int) $data['year'];
        $month = (int) $data['month'];
        $type = $this->staffCommissionService->normalizeType($data['type'] ?? StaffCommissionService::TYPE_BOOKING);
        $force = (bool) ($data['force'] ?? false);

        if (!empty($data['staff_id'])) {
            $row = $this->staffCommissionService->recalculateForStaffMonth((int) $data['staff_id'], $year, $month, $type, $force);
            $row = $row->fresh('staff:id,name');
            $this->staffCommissionService->logAction(
                'RECALCULATE',
                $row,
                null,
                $row->only(['total_sales', 'booking_count', 'commission_amount', 'tier_percent_snapshot', 'status']),
                optional($request->user())->id,
                sprintf('Manual API recalculate%s', $force ? ' (force)' : '')
            );

            return $this->respond([
                'mode' => 'staff',
                'type' => $type,
                'year' => $year,
                'month' => $month,
                'rows' => [$row],
                'count' => 1,
            ]);
        }

        $rows = $this->staffCommissionService->recalculateForMonthAll($year, $month, $type, $force);
        $rowsCollection = collect($rows)->map(fn (StaffMonthlySale $row) => $row->fresh('staff:id,name'))->values();
        foreach ($rowsCollection as $row) {
            $this->staffCommissionService->logAction(
                'RECALCULATE',
                $row,
                null,
                $row->only(['total_sales', 'booking_count', 'commission_amount', 'tier_percent_snapshot', 'status']),
                optional($request->user())->id,
                sprintf('Manual API recalculate%s', $force ? ' (force)' : '')
            );
        }

        return $this->respond([
            'mode' => 'month_all_staff',
            'type' => $type,
            'year' => $year,
            'month' => $month,
            'rows' => $rowsCollection,
            'count' => count($rows),
        ]);
    }

    public function freeze(Request $request, int $id)
    {
        $monthly = StaffMonthlySale::query()->findOrFail($id);
        $before = $monthly->only(['status', 'frozen_at', 'frozen_by']);
        $monthly = $this->staffCommissionService->freezeMonthly($monthly, optional($request->user())->id);

        $this->staffCommissionService->logAction(
            'FREEZE',
            $monthly,
            $before,
            $monthly->only(['status', 'frozen_at', 'frozen_by']),
            optional($request->user())->id
        );

        return $this->respond($monthly->fresh('staff:id,name'));
    }

    public function reopen(Request $request, int $id)
    {
        $monthly = StaffMonthlySale::query()->findOrFail($id);
        $before = $monthly->only(['status', 'reopened_at', 'reopened_by']);
        $monthly = $this->staffCommissionService->reopenMonthly($monthly, optional($request->user())->id);

        $this->staffCommissionService->logAction(
            'REOPEN',
            $monthly,
            $before,
            $monthly->only(['status', 'reopened_at', 'reopened_by']),
            optional($request->user())->id
        );

        return $this->respond($monthly->fresh('staff:id,name'));
    }
}
