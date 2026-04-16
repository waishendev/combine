<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

class BookingPriceModeTestingSeeder extends Seeder
{
    public function run(): void
    {
        if (! Schema::hasTable('booking_services')) {
            $this->command?->warn('booking_services table not found, skip BookingPriceModeTestingSeeder.');
            return;
        }

        $now = now();

        $rangeServiceId = $this->findOrCreateService(
            'Range Price QA Service',
            [
                'description' => 'Seeder QA service for testing range pricing in CRM/POS/booking shop.',
                'service_type' => 'premium',
                'duration_min' => 45,
                'buffer_min' => 15,
                'deposit_amount' => 20,
                'service_price' => 30,
                'price' => 30,
                'is_active' => true,
                'is_package_eligible' => true,
                'created_at' => $now,
                'updated_at' => $now,
            ],
        );

        $fixedServiceId = $this->findOrCreateService(
            'Fixed Price QA Service',
            [
                'description' => 'Seeder QA service for testing fixed pricing side-by-side.',
                'service_type' => 'standard',
                'duration_min' => 30,
                'buffer_min' => 15,
                'deposit_amount' => 10,
                'service_price' => 25,
                'price' => 25,
                'is_active' => true,
                'is_package_eligible' => true,
                'created_at' => $now,
                'updated_at' => $now,
            ],
        );

        $this->applyPricingMode($rangeServiceId, 'range', 30, 50);
        $this->applyPricingMode($fixedServiceId, 'fixed', 25, 25);

        $this->command?->info('Booking price-mode QA services seeded: fixed + range.');
    }

    private function findOrCreateService(string $name, array $payload): int
    {
        $existingId = DB::table('booking_services')->where('name', $name)->value('id');
        if ($existingId) {
            return (int) $existingId;
        }

        return (int) DB::table('booking_services')->insertGetId($this->filterExistingColumns([
            'name' => $name,
            ...$payload,
        ]));
    }

    private function applyPricingMode(int $serviceId, string $priceMode, float $rangeMin, float $rangeMax): void
    {
        $service = DB::table('booking_services')->where('id', $serviceId)->first();
        if (! $service) {
            return;
        }

        $existingRules = [];
        if (isset($service->rules_json) && is_string($service->rules_json) && $service->rules_json !== '') {
            $decoded = json_decode($service->rules_json, true);
            if (is_array($decoded)) {
                $existingRules = $decoded;
            }
        }

        $rulesJson = array_merge($existingRules, [
            'price_mode' => $priceMode,
            'range_min' => $rangeMin,
            'range_max' => $rangeMax,
        ]);

        $updatePayload = [
            'service_price' => $rangeMin,
            'price' => $rangeMin,
            'rules_json' => json_encode($rulesJson, JSON_UNESCAPED_UNICODE),
            'updated_at' => now(),
        ];

        if (Schema::hasColumn('booking_services', 'price_mode')) {
            $updatePayload['price_mode'] = $priceMode;
        }
        if (Schema::hasColumn('booking_services', 'range_min')) {
            $updatePayload['range_min'] = $rangeMin;
        }
        if (Schema::hasColumn('booking_services', 'range_max')) {
            $updatePayload['range_max'] = $rangeMax;
        }

        DB::table('booking_services')
            ->where('id', $serviceId)
            ->update($this->filterExistingColumns($updatePayload));
    }

    private function filterExistingColumns(array $payload): array
    {
        return collect($payload)
            ->filter(fn ($_value, $key) => Schema::hasColumn('booking_services', $key))
            ->all();
    }
}
