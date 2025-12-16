<?php

namespace App\Http\Controllers\Ecommerce;

use App\Http\Controllers\Controller;
use App\Models\Ecommerce\LoyaltyRedemption;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class LoyaltyRedemptionAdminController extends Controller
{
    public function index(Request $request)
    {
        $redemptions = LoyaltyRedemption::query()
            ->with(['customer', 'reward'])
            ->when($request->filled('status'), fn($q) => $q->where('status', $request->string('status')->toString()))
            ->when($request->filled('reward_id'), fn($q) => $q->where('reward_id', $request->integer('reward_id')))
            ->when($request->filled('customer_email'), function ($q) use ($request) {
                $q->whereHas('customer', fn($cq) => $cq->where('email', $request->string('customer_email')->toString()));
            })
            ->when($request->filled('customer_phone'), function ($q) use ($request) {
                $q->whereHas('customer', fn($cq) => $cq->where('phone', $request->string('customer_phone')->toString()));
            })
            ->orderByDesc('created_at')
            ->paginate($request->integer('per_page', 15));

        return $this->respond($redemptions);
    }

    public function show(LoyaltyRedemption $redemption)
    {
        $redemption->load(['customer', 'reward']);

        return $this->respond($redemption);
    }

    public function updateStatus(LoyaltyRedemption $redemption, Request $request)
    {
        $validated = $request->validate([
            'status' => ['required', Rule::in(['pending', 'completed', 'cancelled'])],
            'admin_note' => ['nullable', 'string'],
        ]);

        if ($redemption->status !== 'pending' && $validated['status'] !== $redemption->status) {
            return $this->respond(null, __('Only pending redemptions can be updated.'), false, 422);
        }

        $redemption->status = $validated['status'];
        $meta = $redemption->meta ?? [];
        if (!empty($validated['admin_note'])) {
            $meta['admin_note'] = $validated['admin_note'];
        }
        $redemption->meta = $meta;
        $redemption->save();

        return $this->respond($redemption, __('Redemption status updated.'));
    }
}
