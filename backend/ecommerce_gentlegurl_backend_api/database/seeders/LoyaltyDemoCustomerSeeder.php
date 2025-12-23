<?php

namespace Database\Seeders;

use App\Models\CustomerAddress;
use App\Models\Ecommerce\Customer;
use App\Models\Ecommerce\Order;
use App\Models\Ecommerce\OrderItem;
use App\Models\Ecommerce\PointsEarnBatch;
use App\Models\Ecommerce\PointsTransaction;
use App\Models\Ecommerce\Product;
use Illuminate\Database\Seeder;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;

class LoyaltyDemoCustomerSeeder extends Seeder
{
    public function run(): void
    {
        $customer = Customer::updateOrCreate(
            ['email' => 'loyalty.tester@example.com'],
            [
                'name' => 'Loyalty Tester',
                'phone' => '0123456789',
                'password' => Hash::make('password'),
                'tier' => 'gold',
                'is_active' => true,
            ]
        );

        $address = $customer->addresses()->firstOrCreate(
            ['type' => 'shipping', 'is_default' => true],
            [
                'label' => 'Demo Shipping',
                'name' => $customer->name,
                'phone' => $customer->phone ?? '0123456789',
                'line1' => '123 Loyalty Street',
                'line2' => 'Taman Seed',
                'city' => 'George Town',
                'state' => 'Penang',
                'postcode' => '11000',
                'country' => 'Malaysia',
            ]
        );

        $product = Product::where('is_active', true)->orderBy('id')->first();

        if (!$product) {
            $product = Product::updateOrCreate(
                ['slug' => 'loyalty-demo-product'],
                [
                    'name' => 'Loyalty Demo Product',
                    'sku' => strtoupper(Str::random(8)),
                    'type' => 'simple',
                    'price' => 99.00,
                    'stock' => 100,
                    'track_stock' => true,
                    'is_active' => true,
                ]
            );
        }

        $placedAt = Carbon::now()->subDays(14);
        $earnAt = Carbon::now()->subDays(13);
        $redeemAt = Carbon::now()->subDays(12);
        $earnPoints = 1500;
        $redeemPoints = 300;
        $grandTotal = $product->price ?? 99.00;

        $order = Order::updateOrCreate(
            ['order_number' => 'LOYALTY-DEMO-0001'],
            [
                'customer_id' => $customer->id,
                'status' => 'completed',
                'payment_status' => 'paid',
                'payment_method' => 'manual',
                'payment_provider' => 'seed',
                'subtotal' => $grandTotal,
                'discount_total' => 0,
                'shipping_fee' => 0,
                'grand_total' => $grandTotal,
                'pickup_or_shipping' => 'shipping',
                'shipping_name' => $address->name,
                'shipping_phone' => $address->phone,
                'shipping_address_line1' => $address->line1,
                'shipping_address_line2' => $address->line2,
                'shipping_city' => $address->city,
                'shipping_state' => $address->state,
                'shipping_postcode' => $address->postcode,
                'shipping_country' => $address->country,
                'placed_at' => $placedAt,
                'paid_at' => $placedAt->copy()->addDay(),
                'completed_at' => $placedAt->copy()->addDays(3),
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

        $batch = PointsEarnBatch::updateOrCreate(
            [
                'customer_id' => $customer->id,
                'source_type' => Order::class,
                'source_id' => $order->id,
            ],
            [
                'points_total' => $earnPoints,
                'points_remaining' => max(0, $earnPoints - $redeemPoints),
                'earned_at' => $earnAt,
                'expires_at' => $earnAt->copy()->addMonths(6),
                'status' => 'active',
            ]
        );

        $batch->forceFill([
            'earned_at' => $earnAt,
            'expires_at' => $earnAt->copy()->addMonths(6),
        ])->save();

        $earnTransaction = PointsTransaction::updateOrCreate(
            [
                'customer_id' => $customer->id,
                'type' => 'earn',
                'source_type' => Order::class,
                'source_id' => $order->id,
            ],
            [
                'points_change' => $earnPoints,
                'meta' => [
                    'order_no' => $order->order_number,
                    'earn_batch_id' => $batch->id,
                ],
            ]
        );
        $earnTransaction->forceFill([
            'created_at' => $earnAt,
            'updated_at' => $earnAt,
        ])->save();

        $redeemTransaction = PointsTransaction::updateOrCreate(
            [
                'customer_id' => $customer->id,
                'type' => 'redeem',
                'source_type' => 'loyalty_reward',
                'source_id' => 0,
            ],
            [
                'points_change' => -1 * $redeemPoints,
                'meta' => [
                    'reward_title' => 'RM10 Discount Voucher',
                    'note' => 'Seeded redemption example',
                ],
            ]
        );
        $redeemTransaction->forceFill([
            'created_at' => $redeemAt,
            'updated_at' => $redeemAt,
        ])->save();
    }
}
