<?php

namespace App\Http\Controllers\Admin\Booking;

use App\Http\Controllers\Controller;
use App\Models\Booking\StaffCommissionTier;
use App\Models\Booking\StaffMonthlySale;
use App\Services\Booking\StaffCommissionService;
use App\Services\ExpenseBranchScope;
use App\Services\StoreLocationAccessService;
use Illuminate\Http\Request;

class CommissionTierController extends Controller
{
    public function __construct(private readonly StaffCommissionService $staffCommissionService, private readonly StoreLocationAccessService $branchAccess)
    {
    }

    public function index(Request $request)
    {
        $type = $this->staffCommissionService->normalizeType($request->query('type', StaffCommissionService::TYPE_BOOKING));
        $scope = ExpenseBranchScope::fromRequest($request, $this->branchAccess);
        $query = StaffCommissionTier::query()->with('storeLocation')->where('type', $type);
        $scope->apply($query);

        return $this->respond(
            $query
                ->orderBy('min_sales')
                ->paginate($request->integer('per_page', 50))
        );
    }

    public function store(Request $request)
    {
        $branchId = $this->writeBranch($request);
        $data = $request->validate([
            'type' => ['nullable', 'string', 'in:BOOKING,ECOMMERCE,booking,ecommerce'],
            'min_sales' => ['required', 'numeric', 'min:0'],
            'commission_percent' => ['required', 'numeric', 'min:0'],
            'store_location_id' => ['nullable', 'integer', 'exists:store_locations,id'],
        ]);

        $data['type'] = $this->staffCommissionService->normalizeType($data['type'] ?? StaffCommissionService::TYPE_BOOKING);
        $data['store_location_id'] = $branchId;
        $this->assertNoDuplicateThreshold($branchId, $data['type'], (float) $data['min_sales']);
        $tier = StaffCommissionTier::create($data);
        $this->recalculateAllMonthly($data['type'], $branchId);

        return $this->respond($tier, 'Created', true, 201);
    }

    public function update(Request $request, int $id)
    {
        $tier = StaffCommissionTier::query()->findOrFail($id);
        $this->authorizeTier($request, $tier);

        $data = $request->validate([
            'type' => ['sometimes', 'string', 'in:BOOKING,ECOMMERCE,booking,ecommerce'],
            'min_sales' => ['sometimes', 'numeric', 'min:0'],
            'commission_percent' => ['sometimes', 'numeric', 'min:0'],
        ]);

        if (array_key_exists('type', $data)) {
            $data['type'] = $this->staffCommissionService->normalizeType($data['type']);
        }
        $this->assertNoDuplicateThreshold((int) $tier->store_location_id, $data['type'] ?? $tier->type, (float) ($data['min_sales'] ?? $tier->min_sales), $tier->id);

        $recalculateType = $data['type'] ?? (string) $tier->type;

        $tier->update($data);
        $this->recalculateAllMonthly($recalculateType, (int) $tier->store_location_id);

        return $this->respond($tier);
    }

    public function destroy(Request $request, int $id)
    {
        $tier = StaffCommissionTier::query()->findOrFail($id);
        $this->authorizeTier($request, $tier);
        $type = (string) $tier->type;
        $branchId = (int) $tier->store_location_id;
        abort_if(StaffMonthlySale::query()->where('store_location_id', $branchId)->where('type', $type)->exists()
            && ! StaffCommissionTier::query()->where('store_location_id', $branchId)->where('type', $type)->whereKeyNot($tier->id)->exists(),
            422, 'The final tier cannot be deleted while Branch monthly snapshots exist.');

        $tier->delete();
        $this->recalculateAllMonthly($type, $branchId);

        return $this->respond(null);
    }

    private function writeBranch(Request $request): int
    {
        $id = $request->input('store_location_id', $request->query('branch_store_location_id'));
        abort_if($id === null || $id === '', 422, 'A Branch is required.');
        return (int) $this->branchAccess->authorizeStoreLocation($request->user(), (int) $id)->id;
    }

    private function authorizeTier(Request $request, StaffCommissionTier $tier): void
    {
        abort_if($tier->store_location_id === null, 409, 'Legacy global tier must be explicitly reconciled before modification.');
        $this->branchAccess->authorizeStoreLocation($request->user(), (int) $tier->store_location_id);
        $selected = $request->query('branch_store_location_id');
        abort_if($selected !== null && (int) $selected !== (int) $tier->store_location_id, 404);
    }

    private function assertNoDuplicateThreshold(int $branchId, string $type, float $minSales, ?int $ignore = null): void
    {
        $exists = StaffCommissionTier::query()->where('store_location_id', $branchId)->where('type', $type)
            ->where('min_sales', $minSales)->when($ignore, fn ($q) => $q->whereKeyNot($ignore))->exists();
        abort_if($exists, 422, 'A tier with this minimum sales threshold already exists for the Branch and commission type.');
    }

    private function recalculateAllMonthly(string $type, int $branchId): void
    {
        $resolvedType = $this->staffCommissionService->normalizeType($type);

        $tiers = StaffCommissionTier::query()
            ->where('type', $resolvedType)
            ->where('store_location_id', $branchId)
            ->orderByDesc('min_sales')
            ->get();

        StaffMonthlySale::query()
            ->where('type', $resolvedType)
            ->where('store_location_id', $branchId)
            ->chunkById(100, function ($rows) use ($tiers) {
                foreach ($rows as $row) {
                    $this->staffCommissionService->recalculateMonthly($row, false, $tiers);
                }
            });
    }
}
