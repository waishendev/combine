<?php

namespace Database\Seeders;

use App\Models\Ecommerce\Customer;
use App\Models\Ecommerce\Order;
use App\Models\Ecommerce\OrderItem;
use App\Models\Ecommerce\Product;
use App\Models\Ecommerce\ReturnRequest;
use App\Models\Ecommerce\ReturnRequestItem;
use Carbon\Carbon;
use Illuminate\Database\Seeder;

class ReturnDemoSeeder extends Seeder
{
    public function run(): void
    {
        $product = Product::query()->first();

        if (! $product) {
            return;
        }

        $customer = Customer::firstOrCreate(
            ['email' => 'return.demo@example.com'],
            [
                'name' => 'Return Demo Customer',
                'phone' => '010-0000000',
            ]
        );

        $eligibleOrder = $this->createCompletedOrder($customer->id, $product, 2, Carbon::now()->subDays(2), 'RET-DEMO-1001');
        $expiredOrder = $this->createCompletedOrder($customer->id, $product, 1, Carbon::now()->subDays(14), 'RET-DEMO-1002');

        if ($eligibleOrder && ! ReturnRequest::where('order_id', $eligibleOrder->id)->exists()) {
            $returnRequest = ReturnRequest::create([
                'order_id' => $eligibleOrder->id,
                'customer_id' => $customer->id,
                'request_type' => 'return',
                'status' => 'requested',
                'reason' => 'Damaged item',
                'description' => 'Package arrived damaged.',
                'initial_image_urls' => ['/images/returns/demo-damage-1.jpg'],
            ]);

            $orderItem = $eligibleOrder->items()->first();

            if ($orderItem) {
                ReturnRequestItem::create([
                    'return_request_id' => $returnRequest->id,
                    'order_item_id' => $orderItem->id,
                    'quantity' => 1,
                ]);
            }
        }

        if ($expiredOrder) {
            $this->command?->info('Seeded expired return window order.');
        }
    }

    private function createCompletedOrder(int $customerId, Product $product, int $quantity, Carbon $completedAt, string $orderNumber): ?Order
    {
        $price = (float) ($product->price ?? 10);
        $subtotal = $price * $quantity;

        $order = Order::firstOrCreate(
            ['order_number' => $orderNumber],
            [
                'customer_id' => $customerId,
                'status' => 'completed',
                'payment_status' => 'paid',
                'payment_method' => 'bank_transfer',
                'subtotal' => $subtotal,
                'discount_total' => 0,
                'shipping_fee' => 0,
                'grand_total' => $subtotal,
                'pickup_or_shipping' => 'shipping',
                'shipping_name' => 'Return Demo Customer',
                'shipping_phone' => '010-0000000',
                'shipping_address_line1' => '123 Demo Street',
                'shipping_city' => 'Kuala Lumpur',
                'shipping_state' => 'Kuala Lumpur',
                'shipping_postcode' => '50000',
                'shipping_country' => 'Malaysia',
                'placed_at' => $completedAt->copy()->subDays(2),
                'paid_at' => $completedAt->copy()->subDay(),
                'completed_at' => $completedAt,
            ]
        );

        if (! $order->items()->exists()) {
            OrderItem::create([
                'order_id' => $order->id,
                'product_id' => $product->id,
                'product_name_snapshot' => $product->name,
                'sku_snapshot' => $product->sku,
                'price_snapshot' => $price,
                'quantity' => $quantity,
                'line_total' => $subtotal,
            ]);
        }

        return $order;
    }
}
