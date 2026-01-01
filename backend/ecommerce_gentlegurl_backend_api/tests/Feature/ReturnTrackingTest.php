<?php

namespace Tests\Feature;

use App\Models\Ecommerce\Customer;
use App\Models\Ecommerce\Order;
use App\Models\Ecommerce\OrderItem;
use App\Models\Ecommerce\Product;
use App\Models\Ecommerce\ReturnRequest;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Tests\TestCase;

class ReturnTrackingTest extends TestCase
{
    use RefreshDatabase;

    public function test_customer_can_submit_tracking_without_shipped_at(): void
    {
        $customer = Customer::create([
            'name' => 'Return Tester',
            'email' => 'return.tester@example.com',
            'phone' => '0123456789',
            'password' => Hash::make('password'),
            'tier' => 'normal',
            'is_active' => true,
        ]);

        $product = Product::create([
            'name' => 'Return Test Product',
            'slug' => 'return-test-product',
            'sku' => 'RT-PROD-1',
            'type' => 'single',
            'price' => 10,
            'stock' => 10,
            'is_active' => true,
        ]);

        $order = Order::create([
            'order_number' => 'RET-TRACK-1001',
            'customer_id' => $customer->id,
            'status' => 'completed',
            'payment_status' => 'paid',
            'payment_method' => 'bank_transfer',
            'subtotal' => 10,
            'discount_total' => 0,
            'shipping_fee' => 0,
            'grand_total' => 10,
            'pickup_or_shipping' => 'shipping',
            'shipping_name' => 'Return Tester',
            'shipping_phone' => '0123456789',
            'shipping_address_line1' => '123 Street',
            'shipping_city' => 'Kuala Lumpur',
            'shipping_state' => 'Kuala Lumpur',
            'shipping_postcode' => '50000',
            'shipping_country' => 'Malaysia',
        ]);

        OrderItem::create([
            'order_id' => $order->id,
            'product_id' => $product->id,
            'product_name_snapshot' => $product->name,
            'sku_snapshot' => $product->sku,
            'price_snapshot' => 10,
            'quantity' => 1,
            'line_total' => 10,
        ]);

        $returnRequest = ReturnRequest::create([
            'order_id' => $order->id,
            'customer_id' => $customer->id,
            'request_type' => 'return',
            'status' => 'approved',
        ]);

        $response = $this->actingAs($customer, 'customer')->postJson(
            "/api/public/shop/returns/{$returnRequest->id}/tracking",
            [
                'return_courier_name' => 'J&T',
                'return_tracking_no' => 'JT123',
            ]
        );

        $response->assertStatus(200);
        $this->assertDatabaseHas('return_requests', [
            'id' => $returnRequest->id,
            'status' => 'in_transit',
            'return_courier_name' => 'J&T',
            'return_tracking_no' => 'JT123',
        ]);
        $this->assertNotNull($returnRequest->fresh()->return_shipped_at);
    }
}
