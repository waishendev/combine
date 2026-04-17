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

    public function index(Request $request)
    {
        $type = $this->staffCommissionService->normalizeType($request->query('type', StaffCommissionService::TYPE_BOOKING));

        return $this->respond(
            StaffCommissionTier::query()
                ->where('type', $type)
                ->orderBy('min_sales')
                ->paginate($request->integer('per_page', 50))
        );
    }

    public function store(Request $request)
    {
        $data = $request->validate([
            'type' => ['nullable', 'string', 'in:BOOKING,ECOMMERCE,booking,ecommerce'],
            'min_sales' => ['required', 'numeric', 'min:0'],
            'commission_percent' => ['required', 'numeric', 'min:0'],
        ]);

        $data['type'] = $this->staffCommissionService->normalizeType($data['type'] ?? StaffCommissionService::TYPE_BOOKING);
        $tier = StaffCommissionTier::create($data);
        $this->recalculateAllMonthly($data['type']);

        return $this->respond($tier, 'Created', true, 201);
    }

    public function update(Request $request, int $id)
    {
        $tier = StaffCommissionTier::query()->findOrFail($id);

        $data = $request->validate([
            'type' => ['sometimes', 'string', 'in:BOOKING,ECOMMERCE,booking,ecommerce'],
            'min_sales' => ['sometimes', 'numeric', 'min:0'],
            'commission_percent' => ['sometimes', 'numeric', 'min:0'],
        ]);

        if (array_key_exists('type', $data)) {
            $data['type'] = $this->staffCommissionService->normalizeType($data['type']);
        }

        $recalculateType = $data['type'] ?? (string) $tier->type;

        $tier->update($data);
        $this->recalculateAllMonthly($recalculateType);

        return $this->respond($tier);
    }

    public function destroy(int $id)
    {
        $tier = StaffCommissionTier::query()->findOrFail($id);
        $type = (string) $tier->type;

        $tier->delete();
        $this->recalculateAllMonthly($type);

        return $this->respond(null);
    }

    private function recalculateAllMonthly(string $type): void
    {
        $resolvedType = $this->staffCommissionService->normalizeType($type);

        StaffMonthlySale::query()
            ->where('type', $resolvedType)
            ->chunkById(100, function ($rows) {
                foreach ($rows as $row) {
                    $this->staffCommissionService->recalculateMonthly($row);
                }
            });
    }
}
