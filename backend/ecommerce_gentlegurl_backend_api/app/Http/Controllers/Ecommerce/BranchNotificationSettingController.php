<?php

namespace App\Http\Controllers\Ecommerce;

use App\Http\Controllers\Controller;
use App\Models\Ecommerce\BranchNotificationSetting;
use App\Services\StoreLocationAccessService;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

class BranchNotificationSettingController extends Controller
{
    public function __construct(private readonly StoreLocationAccessService $access) {}

    public function show(Request $request)
    {
        $branch = $this->branch($request);
        return $this->respond($branch->notificationSettings?->toArray(), $branch->notificationSettings ? null : 'Email settings have not been initialized for this Branch.');
    }

    public function update(Request $request)
    {
        $branch = $this->branch($request);
        $data = $request->validate([
            'booking_reminder_enabled' => ['required', 'boolean'],
            'booking_reminder_send_at' => ['required', 'date_format:H:i'],
            'booking_feedback_enabled' => ['required', 'boolean'],
            'booking_feedback_send_at' => ['required', 'date_format:H:i'],
            'booking_payment_proof_enabled' => ['required', 'boolean'],
            'booking_payment_proof_recipients' => ['required', 'array'],
            'booking_payment_proof_recipients.*' => ['email', 'max:255'],
            'daily_order_summary_enabled' => ['required', 'boolean'],
            'daily_order_summary_send_at' => ['required', 'date_format:H:i'],
            'daily_order_summary_recipients' => ['required', 'array'],
            'daily_order_summary_recipients.*' => ['email', 'max:255'],
            'daily_low_stock_enabled' => ['required', 'boolean'],
            'daily_low_stock_send_at' => ['required', 'date_format:H:i'],
            'daily_low_stock_recipients' => ['required', 'array'],
            'daily_low_stock_recipients.*' => ['email', 'max:255'],
        ]);
        foreach (['booking_payment_proof_recipients', 'daily_order_summary_recipients', 'daily_low_stock_recipients'] as $key) {
            $data[$key] = array_values(array_unique(array_map(fn ($email) => strtolower(trim($email)), $data[$key])));
        }
        $settings = BranchNotificationSetting::query()->updateOrCreate(['store_location_id' => $branch->id], $data);
        return $this->respond($settings, 'Branch email and notification settings updated.');
    }

    private function branch(Request $request)
    {
        $id = (int) $request->input('store_location_id', $request->query('store_location_id', 0));
        if ($id <= 0) throw ValidationException::withMessages(['store_location_id' => ['Select a concrete Branch. All Branches cannot own settings.']]);
        return $this->access->authorizeStoreLocation($request->user(), $id, true)->load('notificationSettings');
    }
}
