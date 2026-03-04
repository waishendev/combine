<?php

namespace App\Http\Controllers\Admin\Booking;

use App\Http\Controllers\Controller;
use App\Models\Setting;
use Illuminate\Http\Request;

class SettingController extends Controller
{
    public function show()
    {
        $value = Setting::where('type', 'booking')->where('key', 'BOOKING_NOTIFIED_CANCELLATION_VOUCHER')->value('value');

        return $this->respond($value ?? [
            'enabled' => false,
            'reward_type' => 'PERCENT',
            'reward_value' => 10,
            'base_amount_source' => 'DEPOSIT',
            'expiry_days' => 45,
            'non_combinable' => true,
            'min_spend' => null,
            'usage_limit' => 1,
        ]);
    }

    public function update(Request $request)
    {
        $validated = $request->validate([
            'enabled' => ['required', 'boolean'],
            'reward_type' => ['required', 'in:PERCENT,FIXED'],
            'reward_value' => ['required', 'numeric', 'min:0'],
            'base_amount_source' => ['required', 'in:DEPOSIT,SERVICE_PRICE'],
            'expiry_days' => ['required', 'integer', 'min:1'],
            'non_combinable' => ['required', 'boolean'],
            'min_spend' => ['nullable', 'numeric', 'min:0'],
            'usage_limit' => ['nullable', 'integer', 'min:1'],
        ]);

        Setting::updateOrCreate(
            ['type' => 'booking', 'key' => 'BOOKING_NOTIFIED_CANCELLATION_VOUCHER'],
            ['value' => $validated]
        );

        return $this->respond($validated, 'Booking voucher setting updated.');
    }
}
