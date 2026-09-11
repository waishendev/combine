<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        DB::transaction(function (): void {
            $setting = DB::table('settings')
                ->where('type', 'ecommerce')
                ->where('key', 'ecommerce.invoice_profile')
                ->lockForUpdate()
                ->first();

            if (! $setting) {
                return;
            }

            $profile = json_decode((string) $setting->value, true);
            $retiredDefault = data_get($profile, 'default_pos_receipt_profile');
            if (! is_array($profile) || ! is_array($retiredDefault)) {
                return;
            }

            $overrides = data_get($profile, 'branch_receipt_overrides', []);
            $overrides = is_array($overrides) ? $overrides : [];

            DB::table('store_locations')->orderBy('id')->pluck('id')->each(function ($branchId) use (&$overrides, $retiredDefault): void {
                $key = (string) (int) $branchId;
                if (! isset($overrides[$key])) {
                    $overrides[$key] = $retiredDefault;
                }
            });

            $profile['branch_receipt_overrides'] = $overrides;
            unset($profile['default_pos_receipt_profile']);

            DB::table('settings')->where('id', $setting->id)->update([
                'value' => json_encode($profile, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES),
                'updated_at' => now(),
            ]);
        });
    }

    public function down(): void
    {
        // Deliberately irreversible: promoted Branch overrides may subsequently diverge.
    }
};
