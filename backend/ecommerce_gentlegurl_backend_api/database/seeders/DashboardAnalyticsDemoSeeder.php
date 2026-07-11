<?php

namespace Database\Seeders;

use App\Models\Ecommerce\Category;
use App\Models\Ecommerce\Customer;
use App\Models\Ecommerce\Order;
use App\Models\Ecommerce\OrderItem;
use App\Models\Ecommerce\Product;
use App\Models\Ecommerce\ProductVariant;
use Carbon\Carbon;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Schema;
use RuntimeException;

class DashboardAnalyticsDemoSeeder extends Seeder
{
    public const PREFIX = 'ANALYTICS-DEMO';

    public function run(): void
    {
        $this->assertSafeEnvironment();
        $this->seedDemoData();
        $this->command?->info('Dashboard analytics demo data created/updated.');
    }

    public function seedDemoData(): void
    {
        $this->assertSafeEnvironment();

        DB::transaction(function () {
            $category = Category::updateOrCreate(
                ['slug' => 'analytics-demo-hair-care'],
                ['name' => self::PREFIX.' Hair Care', 'description' => 'Demo category for dashboard analytics testing.', 'is_active' => true]
            );

            $products = [
                ['slug' => 'analytics-demo-shampoo', 'name' => self::PREFIX.' Shampoo', 'sku' => self::PREFIX.'-SHAMPOO', 'price' => 25, 'cost_price' => 10, 'stock' => 20, 'low_stock_threshold' => 5, 'is_active' => true],
                ['slug' => 'analytics-demo-hair-serum', 'name' => self::PREFIX.' Hair Serum', 'sku' => self::PREFIX.'-SERUM', 'price' => 50, 'cost_price' => 20, 'stock' => 3, 'low_stock_threshold' => 5, 'is_active' => true],
                ['slug' => 'analytics-demo-hair-mask', 'name' => self::PREFIX.' Hair Mask', 'sku' => self::PREFIX.'-MASK', 'price' => 40, 'cost_price' => 15, 'stock' => 0, 'low_stock_threshold' => 2, 'is_active' => true],
                ['slug' => 'analytics-demo-missing-cost', 'name' => self::PREFIX.' Missing Cost Product', 'sku' => self::PREFIX.'-MISSING-COST', 'price' => 30, 'cost_price' => null, 'stock' => 5, 'low_stock_threshold' => 2, 'is_active' => true],
                ['slug' => 'analytics-demo-inactive', 'name' => self::PREFIX.' Inactive Product', 'sku' => self::PREFIX.'-INACTIVE', 'price' => 60, 'cost_price' => 30, 'stock' => 12, 'low_stock_threshold' => 2, 'is_active' => false],
            ];

            $createdProducts = [];
            foreach ($products as $data) {
                $product = Product::updateOrCreate(
                    ['sku' => $data['sku']],
                    array_merge($data, ['type' => 'single', 'description' => 'Demo product for dashboard analytics testing.'])
                );
                $product->categories()->syncWithoutDetaching([$category->id]);
                $createdProducts[$data['sku']] = $product;
            }

            $variantProduct = Product::updateOrCreate(
                ['sku' => self::PREFIX.'-COLOR'],
                [
                    'slug' => 'analytics-demo-color-treatment',
                    'name' => self::PREFIX.' Color Treatment',
                    'type' => 'variable',
                    'description' => 'Demo multi-variant product for dashboard analytics testing.',
                    'price' => 80,
                    'cost_price' => 35,
                    'stock' => 0,
                    'low_stock_threshold' => 0,
                    'is_active' => true,
                ]
            );
            $variantProduct->categories()->syncWithoutDetaching([$category->id]);
            $createdProducts[self::PREFIX.'-COLOR'] = $variantProduct;

            foreach ([
                ['sku' => self::PREFIX.'-COLOR-ASH', 'title' => 'Ash Brown', 'price' => 88, 'cost_price' => 32, 'stock' => 7, 'low_stock_threshold' => 3],
                ['sku' => self::PREFIX.'-COLOR-COPPER', 'title' => 'Copper Red', 'price' => 92, 'cost_price' => 36, 'stock' => 2, 'low_stock_threshold' => 3],
                ['sku' => self::PREFIX.'-COLOR-BLACK', 'title' => 'Soft Black', 'price' => 78, 'cost_price' => 28, 'stock' => 11, 'low_stock_threshold' => 3],
            ] as $variant) {
                ProductVariant::updateOrCreate(
                    ['sku' => $variant['sku']],
                    array_merge($variant, ['product_id' => $variantProduct->id, 'track_stock' => true, 'is_active' => true])
                );
            }

            $customer = Customer::updateOrCreate(
                ['email' => 'analytics-demo-customer@example.test'],
                [
                    'name' => self::PREFIX.' Customer',
                    'phone' => '019'.str_pad((string) 4242424, 7, '0', STR_PAD_LEFT),
                    'password' => Hash::make('password'),
                    'is_active' => true,
                    'email_verified_at' => now(),
                ]
            );

            $this->upsertOrder($customer, $createdProducts[self::PREFIX.'-SHAMPOO'], self::PREFIX.'-ORDER-CASH', 'completed', 'paid', 'cash', 2, 25, 0, Carbon::today());
            $this->upsertOrder($customer, $createdProducts[self::PREFIX.'-SERUM'], self::PREFIX.'-ORDER-QRPAY', 'completed', 'paid', 'qrpay', 1, 50, 0, Carbon::yesterday());
            $this->upsertOrder($customer, $createdProducts[self::PREFIX.'-COLOR'], self::PREFIX.'-ORDER-BANK', 'completed', 'paid', 'manual_bank_transfer', 1, 88, 0, Carbon::now()->startOfMonth()->addDays(2));
            $this->upsertOrder($customer, $createdProducts[self::PREFIX.'-MASK'], self::PREFIX.'-ORDER-ONLINE', 'completed', 'paid', 'online', 3, 40, 0, Carbon::now()->startOfMonth()->addDays(4));
            $this->upsertOrder($customer, $createdProducts[self::PREFIX.'-MISSING-COST'], self::PREFIX.'-ORDER-CANCELLED', 'cancelled', 'paid', 'cash', 1, 30, 0, Carbon::today());
            $this->upsertOrder($customer, $createdProducts[self::PREFIX.'-MISSING-COST'], self::PREFIX.'-ORDER-UNPAID', 'pending', 'unpaid', 'cash', 1, 30, 0, Carbon::today());
            $this->upsertOrder($customer, $createdProducts[self::PREFIX.'-SHAMPOO'], self::PREFIX.'-ORDER-VOIDED', 'voided', 'paid', 'cash', 1, 25, 0, Carbon::today());
            $this->upsertOrder($customer, $createdProducts[self::PREFIX.'-SERUM'], self::PREFIX.'-ORDER-REFUNDED', 'completed', 'refunded', 'qrpay', 1, 50, 50, Carbon::yesterday());
            $this->upsertOrder($customer, $createdProducts[self::PREFIX.'-COLOR'], self::PREFIX.'-ORDER-PARTIAL-REFUND', 'completed', 'partially_refunded', 'manual_bank_transfer', 2, 88, 40, Carbon::now()->startOfMonth()->addDays(6));
        });
    }

    public function resetDemoData(): array
    {
        $this->assertSafeEnvironment();

        return DB::transaction(function () {
            $orderIds = Order::where('order_number', 'like', self::PREFIX.'%')->pluck('id');
            $deletedItems = OrderItem::whereIn('order_id', $orderIds)->delete();
            $deletedOrders = Order::whereIn('id', $orderIds)->delete();

            $productIds = Product::where('sku', 'like', self::PREFIX.'%')->pluck('id');
            DB::table('product_categories')->whereIn('product_id', $productIds)->delete();
            $deletedVariants = ProductVariant::where('sku', 'like', self::PREFIX.'%')->delete();
            $deletedProducts = Product::whereIn('id', $productIds)->delete();
            $deletedCustomers = Customer::where('email', 'analytics-demo-customer@example.test')->delete();
            $deletedCategories = Category::where('slug', 'analytics-demo-hair-care')->delete();

            return compact('deletedItems', 'deletedOrders', 'deletedVariants', 'deletedProducts', 'deletedCustomers', 'deletedCategories');
        });
    }

    public function dryRunSummary(): array
    {
        return [
            'blocked_in_production' => app()->environment('production'),
            'products_to_create_or_update' => 6,
            'variants_to_create_or_update' => 3,
            'orders_to_create_or_update' => 9,
            'customer' => 'analytics-demo-customer@example.test',
            'prefix' => self::PREFIX,
        ];
    }

    private function upsertOrder(Customer $customer, Product $product, string $number, string $status, string $paymentStatus, string $method, int $quantity, float $unitPrice, float $refundTotal, Carbon $date): void
    {
        $orderData = [
            'customer_id' => $customer->id,
            'status' => $status,
            'payment_status' => $paymentStatus,
            'payment_method' => $method,
            'subtotal' => $quantity * $unitPrice,
            'discount_total' => 0,
            'shipping_fee' => 0,
            'grand_total' => $quantity * $unitPrice,
            'pickup_or_shipping' => 'pickup',
            'shipping_country' => 'Malaysia',
            'placed_at' => $date,
            'paid_at' => in_array($paymentStatus, ['paid', 'refunded', 'partially_refunded'], true) ? $date : null,
            'completed_at' => $status === 'completed' ? $date : null,
            'notes' => self::PREFIX.' analytics demo order.',
        ];

        if (Schema::hasColumn('orders', 'refund_total')) {
            $orderData['refund_total'] = $refundTotal;
        }
        if (Schema::hasColumn('orders', 'refunded_at')) {
            $orderData['refunded_at'] = $refundTotal > 0 ? $date : null;
        }

        $order = Order::updateOrCreate(
            ['order_number' => $number],
            $orderData
        );

        OrderItem::updateOrCreate(
            ['order_id' => $order->id, 'product_id' => $product->id, 'sku_snapshot' => $product->sku],
            [
                'product_name_snapshot' => $product->name,
                'display_name_snapshot' => $product->name,
                'price_snapshot' => $unitPrice,
                'unit_price_snapshot' => $unitPrice,
                'quantity' => $quantity,
                'line_total' => $quantity * $unitPrice,
                'line_total_snapshot' => $quantity * $unitPrice,
                'effective_unit_price' => $unitPrice,
                'effective_line_total' => $quantity * $unitPrice,
                'cost_price_snapshot' => $product->cost_price,
                'cost_amount_snapshot' => $product->cost_price === null ? null : $quantity * (float) $product->cost_price,
                'is_package' => false,
            ]
        );
    }

    private function assertSafeEnvironment(): void
    {
        if (app()->environment('production')) {
            throw new RuntimeException('DashboardAnalyticsDemoSeeder cannot run in production.');
        }

        if (app()->environment('staging') && ! filter_var(env('ALLOW_ANALYTICS_DEMO_SEED', false), FILTER_VALIDATE_BOOLEAN)) {
            throw new RuntimeException('Set ALLOW_ANALYTICS_DEMO_SEED=true to run DashboardAnalyticsDemoSeeder in staging.');
        }
    }
}
