<?php

namespace App\Http\Controllers\Ecommerce;

use App\Http\Controllers\Controller;
use App\Models\Ecommerce\LoyaltyReward;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class LoyaltyRewardController extends Controller
{
    public function index(Request $request)
    {
        $rewards = LoyaltyReward::query()
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

        $reward = LoyaltyReward::create($validated);

        return $this->respond($reward, __('Reward created successfully.'));
    }

    public function show(LoyaltyReward $reward)
    {
        return $this->respond($reward);
    }

    public function update(Request $request, LoyaltyReward $reward)
    {
        $validated = $this->validatePayload($request, $reward);

        $reward->fill($validated);
        $reward->save();

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
