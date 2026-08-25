<?php

namespace App\Http\Controllers;

use App\Models\Ecommerce\LoyaltySetting;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;

class LoyaltySettingController extends Controller
{
    public function index()
    {
        // NEW ENHANCEMENT — membership-loyalty-store-query-v1: derive current from history (no 2nd SELECT)
        $settings = LoyaltySetting::orderByDesc('rules_effective_at')
            ->orderByDesc('created_at')
            ->get();

        return $this->respond([
            'current' => $this->resolveActiveFromCollection($settings),
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
            'expiry_months' => ['required', 'integer'],
            'evaluation_cycle_months' => ['required', 'integer'],
            'rules_effective_at' => ['nullable', 'date'],
        ]);
    }

    /**
     * Same rule as getActiveSetting(), applied to an already-ordered collection.
     */
    protected function resolveActiveFromCollection($settings): ?LoyaltySetting
    {
        $today = Carbon::now()->toDateString();

        return $settings->first(function (LoyaltySetting $setting) use ($today) {
            if ($setting->rules_effective_at === null) {
                return true;
            }

            return $setting->rules_effective_at->toDateString() <= $today;
        });
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
