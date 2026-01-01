<?php

namespace Database\Seeders;

use App\Models\Ecommerce\Customer;
use App\Models\Ecommerce\Order;
use App\Models\Ecommerce\Product;
use App\Models\Ecommerce\StoreLocation;
use Illuminate\Database\Seeder;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;

class SelfPickupCompletedOrderSeeder extends Seeder
{
    public function run(): void
    {
        $customer = Customer::updateOrCreate(
            ['email' => 'pickup.tester@example.com'],
            [
                'name' => 'Pickup Tester',
                'phone' => '0123455559',
                'password' => Hash::make('password'),
                'tier' => 'bronze',
                'is_active' => true,
            ]
        );

        $store = StoreLocation::updateOrCreate(
            ['code' => 'PICKUP-DEMO'],
            [
                'name' => 'Gentlegurl Pickup Hub',
                'address_line1' => '88 Pickup Avenue',
                'address_line2' => 'Level 2',
                'city' => 'Petaling Jaya',
                'state' => 'Selangor',
                'postcode' => '46000',
                'country' => 'Malaysia',
                'phone' => '03-1234 5678',
                'is_active' => true,
            ]
        );

        $product = Product::where('is_active', true)->orderBy('id')->first();

        if (! $product) {
            $product = Product::updateOrCreate(
                ['slug' => 'pickup-demo-product'],
                [
                    'name' => 'Pickup Demo Product',
                    'sku' => strtoupper(Str::random(8)),
                    'type' => 'simple',
                    'price' => 120.00,
                    'stock' => 50,
                    'track_stock' => true,
                    'is_active' => true,
                ]
            );
        }

        $placedAt = Carbon::now()->subDays(3);
        $grandTotal = $product->price ?? 120.00;

        $order = Order::updateOrCreate(
            ['order_number' => 'PICKUP-DEMO-0001'],
            [
                'customer_id' => $customer->id,
                'status' => 'completed',
                'payment_status' => 'paid',
                'payment_method' => 'manual_transfer',
                'payment_provider' => 'seed',
                'subtotal' => $grandTotal,
                'discount_total' => 0,
                'shipping_fee' => 0,
                'grand_total' => $grandTotal,
                'pickup_or_shipping' => 'pickup',
                'pickup_store_id' => $store->id,
                'shipping_name' => $customer->name,
                'shipping_phone' => $customer->phone,
                'billing_same_as_shipping' => true,
                'placed_at' => $placedAt,
                'paid_at' => $placedAt->copy()->addHours(2),
                'completed_at' => $placedAt->copy()->addDay(),
            ]
        );

        $order->items()->delete();
        $order->items()->create([
            'product_id' => $product->id,
            'product_name_snapshot' => $product->name,
            'sku_snapshot' => $product->sku,
            'price_snapshot' => $product->price,
            'quantity' => 1,
            'line_total' => $grandTotal,
            'is_package' => false,
        ]);
    }
}
