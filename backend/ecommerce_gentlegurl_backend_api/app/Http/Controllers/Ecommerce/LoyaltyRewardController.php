<?php

namespace App\Http\Controllers\Ecommerce;

use App\Http\Controllers\Controller;
use App\Models\Ecommerce\LoyaltyReward;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use App\Services\StoreLocationAccessService;
use Illuminate\Support\Facades\DB;

class LoyaltyRewardController extends Controller
{
    public function __construct(private readonly StoreLocationAccessService $storeLocationAccess) {}
    public function index(Request $request)
    {
        $rewards = LoyaltyReward::query()
            ->with([
                'product:id,name,sku,stock',
                'voucher:id,code,value,min_order_amount,start_at,end_at,is_active',
                'storeLocations:id,name,code',
            ])
            ->when($request->filled('is_active'), fn($q) => $q->where('is_active', $request->boolean('is_active')))
            ->when($request->filled('type'), fn($q) => $q->where('type', $request->string('type')->toString()))
            ->orderBy('sort_order')
            ->orderByDesc('created_at')
            ->paginate($request->integer('per_page', 15));

        return $this->respond($rewards);
    }

    public function store(Request $request)
    {
        $validated = $this->validatePayload($request);

        $reward = DB::transaction(function () use ($validated) {
            $reward = LoyaltyReward::create($validated);
            $reward->storeLocations()->sync($validated['store_location_ids'] ?? []);
            return $reward;
        });
        $reward->load([
            'product:id,name,sku,stock',
            'voucher:id,code,value,min_order_amount,start_at,end_at,is_active',
            'storeLocations:id,name,code',
        ]);

        return $this->respond($reward, __('Reward created successfully.'));
    }

    public function show(LoyaltyReward $reward)
    {
        $reward->load([
            'product:id,name,sku,stock',
            'voucher:id,code,value,min_order_amount,start_at,end_at,is_active',
            'storeLocations:id,name,code',
        ]);
        return $this->respond($reward);
    }

    public function update(Request $request, LoyaltyReward $reward)
    {
        $validated = $this->validatePayload($request, $reward);

        DB::transaction(function () use ($reward, $validated) {
            $reward->fill($validated);
            $reward->save();
            if (array_key_exists('store_location_ids', $validated)) {
                $reward->storeLocations()->sync($validated['store_location_ids']);
            }
        });
        $reward->load([
            'product:id,name,sku,stock',
            'voucher:id,code,value,min_order_amount,start_at,end_at,is_active',
            'storeLocations:id,name,code',
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

        $validated = $request->validate([
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
            'store_location_ids' => [$type === 'voucher' ? 'required' : 'prohibited', 'array', 'min:1'],
            'store_location_ids.*' => ['integer', 'distinct', 'exists:store_locations,id'],
        ]);

        if ($type === 'voucher') {
            $validated['store_location_ids'] = $this->storeLocationAccess->assertCanAssign($request->user(), $validated['store_location_ids'], false);
            $voucherBranchIds = \App\Models\Ecommerce\Voucher::query()
                ->findOrFail($validated['voucher_id'])
                ->storeLocations()
                ->pluck('store_locations.id')
                ->map(fn ($id) => (int) $id)
                ->all();
            if (array_diff($validated['store_location_ids'], $voucherBranchIds)) {
                throw \Illuminate\Validation\ValidationException::withMessages([
                    'store_location_ids' => __('Redeem Voucher Branches must be a subset of the generated Voucher applicability.'),
                ]);
            }
        }

        return $validated;
    }
}
