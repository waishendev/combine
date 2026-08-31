<?php

namespace App\Services;

use App\Models\PosPaymentMethod;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class PosPaymentMethodService
{
    public function initializeBranch(int $storeLocationId, bool $overwrite = false): bool
    {
        $hasMethods = DB::table('store_location_pos_payment_methods')->where('store_location_id', $storeLocationId)->exists();
        if ($hasMethods && ! $overwrite) {
            return false;
        }

        DB::transaction(function () use ($storeLocationId, $overwrite): void {
            if ($overwrite) {
                DB::table('store_location_pos_payment_methods')->where('store_location_id', $storeLocationId)->delete();
            }
            foreach (PosPaymentMethod::query()->orderBy('default_sort_order')->get() as $method) {
                DB::table('store_location_pos_payment_methods')->insertOrIgnore([
                    'store_location_id' => $storeLocationId,
                    'pos_payment_method_id' => $method->id,
                    'is_enabled' => true,
                    'sort_order' => $method->default_sort_order,
                    'created_at' => now(),
                    'updated_at' => now(),
                ]);
            }
        });

        return true;
    }

    public function configuration(int $storeLocationId): array
    {
        $rows = PosPaymentMethod::query()
            ->leftJoin('store_location_pos_payment_methods as branch', function ($join) use ($storeLocationId) {
                $join->on('branch.pos_payment_method_id', '=', 'pos_payment_methods.id')
                    ->where('branch.store_location_id', $storeLocationId);
            })
            ->orderByRaw('COALESCE(branch.sort_order, pos_payment_methods.default_sort_order)')
            ->get(['pos_payment_methods.id', 'pos_payment_methods.key', 'pos_payment_methods.name', 'pos_payment_methods.default_sort_order', 'branch.is_enabled', 'branch.sort_order']);
        $configured = $rows->contains(fn ($row) => $row->is_enabled !== null);

        return [
            'store_location_id' => $storeLocationId,
            'is_configured' => $configured,
            'methods' => $rows->map(fn ($row) => [
                'key' => $row->key,
                'name' => $row->name,
                // Safe deterministic fallback for a new/unconfigured Branch.
                'is_enabled' => $row->is_enabled === null ? $row->key === 'cash' : (bool) $row->is_enabled,
                'sort_order' => (int) ($row->sort_order ?? $row->default_sort_order),
            ])->values()->all(),
        ];
    }

    public function normalize(string $method): string
    {
        return in_array($method, ['billplz_credit_card', 'billplz_card'], true) ? 'credit_card' : $method;
    }

    public function assertAllowed(int $storeLocationId, array $paymentRows): void
    {
        $configuration = $this->configuration($storeLocationId);
        $enabled = collect($configuration['methods'])->where('is_enabled', true)->pluck('key');
        foreach ($paymentRows as $row) {
            if (! $enabled->contains($this->normalize((string) ($row['method'] ?? '')))) {
                throw ValidationException::withMessages(['payment_method' => __('The selected POS payment method is disabled for this Branch.')]);
            }
        }
    }
}
