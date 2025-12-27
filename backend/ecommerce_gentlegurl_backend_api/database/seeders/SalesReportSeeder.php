<?php

namespace Database\Seeders;

use App\Models\Ecommerce\Category;
use App\Models\Ecommerce\Customer;
use App\Models\Ecommerce\Order;
use App\Models\Ecommerce\Product;
use Illuminate\Database\Seeder;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;

class SalesReportSeeder extends Seeder
{
    public function run(): void
    {
        $products = Product::where('is_active', true)->limit(12)->get();

        if ($products->isEmpty()) {
            $products = collect([$this->seedFallbackProduct()]);
        }

        $customers = $this->seedCustomers();
        $baseDate = Carbon::today()->subDays(12);

        $orders = [
            [
                'order_number' => 'REPORT-0001',
                'customer' => $customers[0],
                'status' => 'paid',
                'placed_at' => $baseDate->copy()->addDays(1)->setTime(10, 15),
                'items' => [
                    [$products[0], 1],
                    [$products[1] ?? $products[0], 2],
                ],
            ],
            [
                'order_number' => 'REPORT-0002',
                'customer' => $customers[1],
                'status' => 'packed',
                'placed_at' => $baseDate->copy()->addDays(3)->setTime(15, 45),
                'items' => [
                    [$products[2] ?? $products[0], 1],
                ],
            ],
            [
                'order_number' => 'REPORT-0003',
                'customer' => $customers[2],
                'status' => 'shipped',
                'placed_at' => $baseDate->copy()->addDays(5)->setTime(9, 30),
                'items' => [
                    [$products[3] ?? $products[1] ?? $products[0], 1],
                    [$products[4] ?? $products[0], 1],
                ],
            ],
            [
                'order_number' => 'REPORT-0004',
                'customer' => $customers[0],
                'status' => 'completed',
                'placed_at' => $baseDate->copy()->addDays(7)->setTime(11, 20),
                'items' => [
                    [$products[5] ?? $products[0], 3],
                ],
            ],
            [
                'order_number' => 'REPORT-0005',
                'customer' => $customers[1],
                'status' => 'completed',
                'placed_at' => $baseDate->copy()->addDays(9)->setTime(14, 0),
                'items' => [
                    [$products[6] ?? $products[2] ?? $products[0], 2],
                    [$products[7] ?? $products[0], 1],
                ],
            ],
            [
                'order_number' => 'REPORT-0006',
                'customer' => $customers[2],
                'status' => 'packed',
                'placed_at' => $baseDate->copy()->addDays(10)->setTime(16, 10),
                'items' => [
                    [$products[8] ?? $products[1] ?? $products[0], 2],
                ],
            ],
            [
                'order_number' => 'REPORT-0007',
                'customer' => $customers[0],
                'status' => 'shipped',
                'placed_at' => $baseDate->copy()->addDays(11)->setTime(12, 50),
                'items' => [
                    [$products[9] ?? $products[0], 1],
                ],
            ],
        ];

        foreach ($orders as $orderData) {
            $this->seedOrder($orderData);
        }
    }

    private function seedCustomers(): array
    {
        return [
            Customer::updateOrCreate(
                ['email' => 'report.alex@example.com'],
                [
                    'name' => 'Alex Tan',
                    'phone' => '0123000101',
                    'password' => Hash::make('password'),
                    'tier' => 'silver',
                    'is_active' => true,
                ]
            ),
            Customer::updateOrCreate(
                ['email' => 'report.bella@example.com'],
                [
                    'name' => 'Bella Lim',
                    'phone' => '0123000202',
                    'password' => Hash::make('password'),
                    'tier' => 'gold',
                    'is_active' => true,
                ]
            ),
            Customer::updateOrCreate(
                ['email' => 'report.chan@example.com'],
                [
                    'name' => 'Chan Wei',
                    'phone' => '0123000303',
                    'password' => Hash::make('password'),
                    'tier' => 'bronze',
                    'is_active' => true,
                ]
            ),
        ];
    }

    private function seedFallbackProduct(): Product
    {
        $product = Product::updateOrCreate(
            ['slug' => 'report-demo-product'],
            [
                'name' => 'Report Demo Product',
                'sku' => strtoupper(Str::random(8)),
                'type' => 'simple',
                'price' => 120.00,
                'stock' => 200,
                'track_stock' => true,
                'is_active' => true,
            ]
        );

        $category = Category::orderBy('id')->first();

        if ($category) {
            $product->categories()->syncWithoutDetaching([$category->id]);
        }

        return $product;
    }

    private function seedOrder(array $data): void
    {
        $customer = $data['customer'];
        $placedAt = $data['placed_at'];
        $items = $data['items'];

        $subtotal = 0;
        foreach ($items as [$product, $quantity]) {
            $subtotal += ((float) $product->price) * $quantity;
        }

        $shippingFee = $subtotal >= 200 ? 0 : 12.50;
        $grandTotal = $subtotal + $shippingFee;

        $order = Order::updateOrCreate(
            ['order_number' => $data['order_number']],
            [
                'customer_id' => $customer->id,
                'status' => $data['status'],
                'payment_status' => 'paid',
                'payment_method' => 'manual',
                'payment_provider' => 'seed',
                'subtotal' => $subtotal,
                'discount_total' => 0,
                'shipping_fee' => $shippingFee,
                'grand_total' => $grandTotal,
                'pickup_or_shipping' => 'shipping',
                'shipping_name' => $customer->name,
                'shipping_phone' => $customer->phone,
                'shipping_address_line1' => '88 Seeded Road',
                'shipping_address_line2' => 'Taman Laporan',
                'shipping_city' => 'Kuala Lumpur',
                'shipping_state' => 'Wilayah',
                'shipping_postcode' => '50000',
                'shipping_country' => 'Malaysia',
                'placed_at' => $placedAt,
                'paid_at' => $placedAt->copy()->addHours(2),
                'completed_at' => $data['status'] === 'completed'
                    ? $placedAt->copy()->addDays(3)
                    : null,
                'shipped_at' => $data['status'] === 'shipped'
                    ? $placedAt->copy()->addDays(2)
                    : null,
            ]
        );

        $order->items()->delete();

        foreach ($items as [$product, $quantity]) {
            $order->items()->create([
                'product_id' => $product->id,
                'product_name_snapshot' => $product->name,
                'sku_snapshot' => $product->sku,
                'price_snapshot' => $product->price,
                'quantity' => $quantity,
                'line_total' => ((float) $product->price) * $quantity,
                'is_package' => false,
            ]);
        }
    }
}
