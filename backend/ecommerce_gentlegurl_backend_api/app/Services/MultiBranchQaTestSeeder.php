<?php

namespace App\Services;

use App\Models\Ecommerce\StoreLocation;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;

/**
 * Builds an intentionally conservative, repeatable Branch QA fixture set.
 *
 * Global master records are candidates only: this service never creates or
 * edits Products, Categories, Staff, Booking Services, Customers or benefits.
 */
class MultiBranchQaTestSeeder
{
    /** @return array<string, mixed> */
    public function audit(StoreLocation $branch): array
    {
        $products = DB::table('products')->where('is_active', true)->orderBy('id')->limit(9)->get();
        $assignedProducts = $products->take(max(0, min(8, $products->count() - 1)))->values();
        $inventoryProducts = $assignedProducts->take(6)->values();
        $staff = DB::table('staffs')->where('is_active', true)->orderBy('id')->limit(4)->get();
        $services = DB::table('booking_services')->where('is_active', true)->orderBy('id')->limit(6)->get();
        $userId = DB::table('users')->orderBy('id')->value('id');
        $warnings = collect();

        if (! $branch->is_active) {
            $warnings->push('Target Branch is inactive. Activate it before operational QA.');
        }
        if (! $branch->is_booking_available) {
            $warnings->push('Booking is not enabled; schedules and Bookings must be exercised manually after Branch configuration.');
        }
        if (! $branch->is_pos_available) {
            $warnings->push('POS is not enabled; open a Cash Shift and test checkout manually after Branch configuration.');
        }
        if ($products->count() < 2) {
            $warnings->push('At least two active global Products are required to preserve an unavailable control Product.');
        }
        if (! $userId) {
            $warnings->push('No existing User is available as Expense audit owner; Expense rows will be skipped.');
        }

        $inventory = $this->inventoryCandidates($inventoryProducts);
        // The final available Product intentionally has no balance, exercising
        // Phase 9C missing-row-as-zero behavior when enough Products exist.
        $withBalances = $assignedProducts->count() > 1 ? $inventory->filter(
            fn (array $row) => (int) $row['product_id'] !== (int) $assignedProducts->last()->id
        )->values() : collect();
        $thresholds = $assignedProducts->pluck('low_stock_threshold', 'id');
        $lowBalanceCount = $withBalances->filter(fn (array $row) =>
            (int) ($thresholds[$row['product_id']] ?? 0) > (int) $row['quantity']
        )->count();
        $missingBalanceCount = $assignedProducts->count() > 1 ? 1 : 0;

        return [
            'prefix' => $this->prefix((string) $branch->code),
            'products' => $assignedProducts,
            'inventory' => $withBalances,
            'staff' => $staff,
            'services' => $services,
            'user_id' => $userId ? (int) $userId : null,
            'warnings' => $warnings,
            'planned' => [
                'product_availability' => $assignedProducts->count(),
                'inventory_rows' => $withBalances->count(),
                'staff_assignments' => $staff->count(),
                'service_assignments' => $services->count(),
                'expense_categories' => $userId ? 3 : 0,
                'expenses' => $userId ? 6 : 0,
                'low_stock_fixtures' => $lowBalanceCount + $missingBalanceCount,
            ],
        ];
    }

    /** @param array<string, mixed> $audit
     *  @return array<string, mixed>
     */
    public function seed(StoreLocation $branch, array $audit): array
    {
        $result = ['created' => 0, 'existing' => 0, 'updated' => 0, 'skipped' => 0, 'sections' => []];

        return DB::transaction(function () use ($branch, $audit, $result): array {
            foreach ([
                'products' => ['table' => 'store_location_product', 'items' => $audit['products'], 'key' => 'product_id', 'extra' => ['is_available' => true]],
                'staff' => ['table' => 'staff_store_location', 'items' => $audit['staff'], 'key' => 'staff_id', 'extra' => []],
                'services' => ['table' => 'booking_service_store_location', 'items' => $audit['services'], 'key' => 'booking_service_id', 'extra' => []],
            ] as $section => $spec) {
                $sectionCount = 0;
                foreach ($spec['items'] as $item) {
                    $keys = ['store_location_id' => $branch->id, $spec['key'] => $item->id];
                    if (DB::table($spec['table'])->where($keys)->exists()) {
                        $result['existing']++;
                        continue;
                    }
                    DB::table($spec['table'])->insert($keys + $spec['extra'] + ['created_at' => now(), 'updated_at' => now()]);
                    $result['created']++;
                    $sectionCount++;
                }
                $result['sections'][$section] = $sectionCount;
            }

            $inventoryCreated = 0;
            foreach ($audit['inventory'] as $row) {
                $query = DB::table('store_location_product_inventories')
                    ->where('store_location_id', $branch->id)->where('product_id', $row['product_id']);
                $row['product_variant_id'] === null
                    ? $query->whereNull('product_variant_id')
                    : $query->where('product_variant_id', $row['product_variant_id']);
                if ($query->exists()) {
                    // Never overwrite a real physical count. Existing QA rows are
                    // stable, making replay safe without ownership ambiguity.
                    $result['existing']++;
                    continue;
                }
                DB::table('store_location_product_inventories')->insert($row + [
                    'store_location_id' => $branch->id, 'created_at' => now(), 'updated_at' => now(),
                ]);
                $result['created']++;
                $inventoryCreated++;
            }
            $result['sections']['inventory'] = $inventoryCreated;

            if ($audit['user_id']) {
                $expenseResult = $this->seedExpenses($branch, $audit['prefix'], $audit['user_id']);
                $result['created'] += $expenseResult['created'];
                $result['existing'] += $expenseResult['existing'];
                $result['sections'] += $expenseResult['sections'];
            } else {
                $result['skipped'] += 9;
            }

            return $result;
        }, 3);
    }

    private function inventoryCandidates(Collection $products): Collection
    {
        $quantities = [2, 20, 0, 5, 12, 7];

        return $products->values()->map(function ($product, int $index) use ($quantities): array {
            $variantId = DB::table('product_variants')->where('product_id', $product->id)
                ->where('is_active', true)->orderBy('id')->value('id');

            return ['product_id' => (int) $product->id, 'product_variant_id' => $variantId ? (int) $variantId : null,
                'quantity' => $quantities[$index] ?? 5];
        });
    }

    /** @return array<string, mixed> */
    private function seedExpenses(StoreLocation $branch, string $prefix, int $userId): array
    {
        $created = $existing = 0;
        $categoryIds = [];
        foreach (['Rent', 'Utilities', 'Supplies'] as $index => $label) {
            $name = substr("QA-{$branch->code} {$label}", 0, 100);
            $category = DB::table('expense_categories')->where(['store_location_id' => $branch->id, 'name' => $name])->first();
            if (! $category) {
                $id = DB::table('expense_categories')->insertGetId(['store_location_id' => $branch->id, 'name' => $name,
                    'description' => "{$prefix}owned fixture", 'sort_order' => 900 + $index, 'is_active' => true,
                    'created_at' => now(), 'updated_at' => now()]);
                $created++;
            } else {
                $id = $category->id;
                $existing++;
            }
            $categoryIds[] = $id;
        }

        foreach ([125.50, 240.00, 39.90, 88.80, 510.25, 64.40] as $index => $amount) {
            $number = substr($prefix.'EXP-'.sprintf('%03d', $index + 1), 0, 32);
            if (DB::table('expenses')->where('expense_no', $number)->exists()) {
                $existing++;
                continue;
            }
            DB::table('expenses')->insert(['store_location_id' => $branch->id, 'expense_no' => $number,
                'expense_category_id' => $categoryIds[$index % 3], 'expense_date' => now()->subDays($index)->toDateString(),
                'title' => $prefix.'Expense '.sprintf('%03d', $index + 1), 'amount' => $amount,
                'remark' => $prefix.'deterministic Profit/Loss fixture', 'created_by' => $userId, 'updated_by' => $userId,
                'created_at' => now(), 'updated_at' => now()]);
            $created++;
        }

        return compact('created', 'existing') + ['sections' => ['expense_categories' => 3, 'expenses' => 6]];
    }

    private function prefix(string $code): string
    {
        $safe = trim(preg_replace('/[^A-Za-z0-9_-]+/', '-', strtoupper($code)), '-');

        return 'MBQA-'.substr($safe, 0, 10).'-'.substr(sha1($code), 0, 6).'-';
    }
}
