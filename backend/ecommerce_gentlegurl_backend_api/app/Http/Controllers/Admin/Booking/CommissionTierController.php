<?php

namespace App\Http\Controllers\Admin\Booking;

use App\Http\Controllers\Controller;
use App\Models\Booking\StaffCommissionTier;
use App\Models\Booking\StaffMonthlySale;
use App\Services\Booking\StaffCommissionService;
use Illuminate\Http\Request;

class CommissionTierController extends Controller
{
    public function __construct(private readonly StaffCommissionService $staffCommissionService)
    {
    }

    public function index()
    {
        return $this->respond(StaffCommissionTier::query()->orderBy('min_sales')->get());
    }

    public function store(Request $request)
    {
        $data = $request->validate([
            'min_sales' => ['required', 'numeric', 'min:0'],
            'commission_percent' => ['required', 'numeric', 'min:0'],
        ]);

        $tier = StaffCommissionTier::create($data);
        $this->recalculateAllMonthly();

        return $this->respond($tier, 'Created', true, 201);
    }

    public function update(Request $request, int $id)
    {
        $tier = StaffCommissionTier::query()->findOrFail($id);

        $data = $request->validate([
            'min_sales' => ['sometimes', 'numeric', 'min:0'],
            'commission_percent' => ['sometimes', 'numeric', 'min:0'],
        ]);

        $tier->update($data);
        $this->recalculateAllMonthly();

        return $this->respond($tier);
    }

    public function destroy(int $id)
    {
        StaffCommissionTier::query()->findOrFail($id)->delete();
        $this->recalculateAllMonthly();

        return $this->respond(null);
    }

    private function recalculateAllMonthly(): void
    {
        StaffMonthlySale::query()->chunkById(100, function ($rows) {
            foreach ($rows as $row) {
                $this->staffCommissionService->recalculateMonthly($row);
            }
        });
    }
}
