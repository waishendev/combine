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
        $monthly->is_overridden = (bool) $data['is_overridden'];
        $monthly->override_amount = $monthly->is_overridden
            ? (float) ($data['override_amount'] ?? 0)
            : null;

        $monthly->save();

        $this->staffCommissionService->recalculateMonthly($monthly);

        return $this->respond($monthly->fresh('staff:id,name'));
    }

    public function recalculate(Request $request)
    {
        $data = $request->validate([
            'year' => ['required', 'integer', 'min:2000', 'max:3000'],
            'month' => ['required', 'integer', 'min:1', 'max:12'],
            'staff_id' => ['nullable', 'integer', 'exists:staffs,id'],
            'type' => ['nullable', 'string', 'in:BOOKING,ECOMMERCE,booking,ecommerce'],
        ]);

        $year = (int) $data['year'];
        $month = (int) $data['month'];
        $type = $this->staffCommissionService->normalizeType($data['type'] ?? StaffCommissionService::TYPE_BOOKING);

        if (!empty($data['staff_id'])) {
            $row = $this->staffCommissionService->recalculateForStaffMonth((int) $data['staff_id'], $year, $month, $type);

            return $this->respond([
                'mode' => 'staff',
                'type' => $type,
                'year' => $year,
                'month' => $month,
                'rows' => [$row->fresh('staff:id,name')],
                'count' => 1,
            ]);
        }

        $rows = $this->staffCommissionService->recalculateForMonthAll($year, $month, $type);

        return $this->respond([
            'mode' => 'month_all_staff',
            'type' => $type,
            'year' => $year,
            'month' => $month,
            'rows' => collect($rows)->map(fn (StaffMonthlySale $row) => $row->fresh('staff:id,name'))->values(),
            'count' => count($rows),
        ]);
    }
}
