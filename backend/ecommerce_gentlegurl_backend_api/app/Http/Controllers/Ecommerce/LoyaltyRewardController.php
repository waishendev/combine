<?php

namespace App\Http\Controllers\Ecommerce;

use App\Http\Controllers\Controller;
use App\Models\Ecommerce\LoyaltyReward;
use App\Services\StoreLocationAccessService;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class LoyaltyRewardController extends Controller
{
    public function index(Request $request, StoreLocationAccessService $branchAccess)
    {
        $accessibleBranches = $branchAccess->accessibleStoreLocations($request->user(), false)
            ->get(['id', 'name', 'code']);
        $accessibleIds = $accessibleBranches->pluck('id')->map(fn ($id) => (int) $id)->all();
        $branchId = $request->filled('branch_store_location_id')
            ? (int) $request->integer('branch_store_location_id')
            : null;

        if ($branchId !== null) {
            $branchAccess->authorizeStoreLocation($request->user(), $branchId, false);
        }

        $rewards = LoyaltyReward::query()
            ->with([
                'product' => fn ($products) => $products
                    ->select('id', 'name', 'sku', 'stock')
                    ->with(['storeLocations' => fn ($branches) => $branches
                        ->whereIn('store_locations.id', $accessibleIds)
                        ->where('store_location_product.is_available', true)
                        ->select('store_locations.id', 'name', 'code')]),
                'voucher:id,code,value,min_order_amount,start_at,end_at,is_active',
            ])
            ->when($branchId !== null, fn ($query) => $query
                ->where('type', 'product')
                ->whereHas('product.storeLocations', fn ($branches) => $branches
                    ->whereKey($branchId)
                    ->where('store_location_product.is_available', true)))
            ->when($request->filled('is_active'), fn($q) => $q->where('is_active', $request->boolean('is_active')))
            ->when($request->filled('type'), fn($q) => $q->where('type', $request->string('type')->toString()))
            ->orderBy('sort_order')
            ->orderByDesc('created_at')
            ->paginate($request->integer('per_page', 15));

        $accessibleCount = count($accessibleIds);
        $rewards->getCollection()->each(function (LoyaltyReward $reward) use ($accessibleCount) {
            if ($reward->product) {
                $reward->product->setAttribute(
                    'available_at_all_accessible_branches',
                    $accessibleCount > 0 && $reward->product->storeLocations->count() === $accessibleCount
                );
            }
        });

        return $this->respond($rewards);
    }

    public function store(Request $request)
    {
        $validated = $this->validatePayload($request);

        $reward = LoyaltyReward::create($validated);
        $reward->load([
            'product:id,name,sku,stock',
            'voucher:id,code,value,min_order_amount,start_at,end_at,is_active',
        ]);

        return $this->respond($reward, __('Reward created successfully.'));
    }

    public function show(LoyaltyReward $reward)
    {
        $reward->load([
            'product:id,name,sku,stock',
            'voucher:id,code,value,min_order_amount,start_at,end_at,is_active',
        ]);
        return $this->respond($reward);
    }

    public function update(Request $request, LoyaltyReward $reward)
    {
        $validated = $this->validatePayload($request, $reward);

        $reward->fill($validated);
        $reward->save();
        $reward->load([
            'product:id,name,sku,stock',
            'voucher:id,code,value,min_order_amount,start_at,end_at,is_active',
        ]);

        return $this->respond($reward, __('Reward updated successfully.'));
    }

    public function destroy(LoyaltyReward $reward)
    {
        $reward->delete();

        return $this->respond(null, __('Reward deleted successfully.'));
    }

    protected function validatePayload(Request $request, ?LoyaltyReward $reward = null): array
    {
        $type = $request->string('type')->toString();

        return $request->validate([
            'title' => ['required', 'string', 'max:255'],
            'description' => ['nullable', 'string'],
            'type' => ['required', Rule::in(['product', 'voucher', 'custom'])],
            'points_required' => ['required', 'integer', 'min:1'],
            'product_id' => ['required_if:type,product', 'nullable', 'exists:products,id'],
            'voucher_id' => ['required_if:type,voucher', 'nullable', 'exists:vouchers,id'],
            'quota_total' => ['nullable', 'integer', 'min:0'],
            'quota_used' => ['sometimes', 'integer', 'min:0'],
            'is_active' => ['sometimes', 'boolean'],
            'sort_order' => ['sometimes', 'integer'],
        ]);
    }
}
