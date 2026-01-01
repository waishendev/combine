<?php

namespace Database\Seeders;

use App\Models\Ecommerce\Order;
use App\Models\Ecommerce\Product;
use Illuminate\Database\Seeder;
use Illuminate\Support\Carbon;
use Illuminate\Support\Str;

class GuestCompletedOrderSeeder extends Seeder
{
    public function run(): void
    {
        $product = Product::where('is_active', true)->orderBy('id')->first();

        if (! $product) {
            $product = Product::updateOrCreate(
                ['slug' => 'guest-demo-product'],
                [
                    'name' => 'Guest Demo Product',
                    'sku' => strtoupper(Str::random(8)),
                    'type' => 'simple',
                    'price' => 150.00,
                    'stock' => 80,
                    'track_stock' => true,
                    'is_active' => true,
                ]
            );
        }

        $placedAt = Carbon::now()->subDays(5);
        $grandTotal = $product->price ?? 150.00;

        $order = Order::updateOrCreate(
            ['order_number' => 'GUEST-DEMO-0001'],
            [
                'customer_id' => null,
                'status' => 'completed',
                'payment_status' => 'paid',
                'payment_method' => 'billplz',
                'payment_provider' => 'seed',
                'subtotal' => $grandTotal,
                'discount_total' => 0,
                'shipping_fee' => 0,
                'grand_total' => $grandTotal,
                'pickup_or_shipping' => 'shipping',
                'shipping_name' => 'Guest Shopper',
                'shipping_phone' => '01122334455',
                'shipping_address_line1' => '10 Guest Street',
                'shipping_address_line2' => 'Suite 5',
                'shipping_city' => 'Shah Alam',
                'shipping_state' => 'Selangor',
                'shipping_postcode' => '40000',
                'shipping_country' => 'Malaysia',
                'billing_same_as_shipping' => false,
                'billing_name' => 'Guest Shopper',
                'billing_phone' => '01122334455',
                'billing_address_line1' => '10 Guest Street',
                'billing_address_line2' => 'Suite 5',
                'billing_city' => 'Shah Alam',
                'billing_state' => 'Selangor',
                'billing_postcode' => '40000',
                'billing_country' => 'Malaysia',
                'placed_at' => $placedAt,
                'paid_at' => $placedAt->copy()->addHours(1),
                'completed_at' => $placedAt->copy()->addDays(2),
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
