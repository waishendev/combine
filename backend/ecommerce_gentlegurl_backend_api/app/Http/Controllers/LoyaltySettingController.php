<?php

namespace App\Http\Controllers;

use App\Models\Ecommerce\LoyaltySetting;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;

class LoyaltySettingController extends Controller
{
    public function index()
    {
        $settings = LoyaltySetting::orderByDesc('rules_effective_at')
            ->orderByDesc('created_at')
            ->get();

        return $this->respond([
            'current' => $this->getActiveSetting(),
            'history' => $settings,
        ]);
    }

    public function store(Request $request)
    {
        $validated = $this->validatePayload($request);

        $setting = LoyaltySetting::create($validated);

        return $this->respond($setting, __('Loyalty settings created successfully.'));
    }

    public function show(LoyaltySetting $loyaltySetting)
    {
        return $this->respond($loyaltySetting);
    }

    public function update(Request $request, LoyaltySetting $loyaltySetting)
    {
        $validated = $this->validatePayload($request);

        $loyaltySetting->update($validated);

        return $this->respond($loyaltySetting, __('Loyalty settings updated successfully.'));
    }

    public function destroy(LoyaltySetting $loyaltySetting)
    {
        $loyaltySetting->delete();

        return $this->respond(null, __('Loyalty settings deleted successfully.'));
    }

    protected function validatePayload(Request $request): array
    {
        return $request->validate([
            'base_multiplier' => ['required', 'numeric'],
            'ecommerce_earning_rate' => ['nullable', 'numeric', 'min:0'],
            'ecommerce_redemption_enabled' => ['required', 'boolean'],
            'ecommerce_point_value_sen' => ['required', 'integer', 'min:1'],
            'ecommerce_max_redemption_percent' => ['required', 'numeric', 'between:0,100'],
            'booking_earning_rate' => ['nullable', 'numeric', 'min:0'],
            'booking_redemption_enabled' => ['required', 'boolean'],
            'booking_point_value_sen' => ['required', 'integer', 'min:1'],
            'booking_max_redemption_percent' => ['required', 'numeric', 'between:0,100'],
            'expiry_months' => ['required', 'integer'],
            'evaluation_cycle_months' => ['required', 'integer'],
            'rules_effective_at' => ['nullable', 'date'],
        ]);
    }

    protected function getActiveSetting(): ?LoyaltySetting
    {
        return LoyaltySetting::where(function ($query) {
            $query->whereNull('rules_effective_at')
                ->orWhere('rules_effective_at', '<=', Carbon::now()->toDateString());
        })
            ->orderByDesc('rules_effective_at')
            ->orderByDesc('created_at')
            ->first();
    }
}
