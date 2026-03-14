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
        $query = StaffMonthlySale::query()->with('staff:id,name');

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
}
