<?php

namespace Database\Seeders;

use App\Models\Ecommerce\Customer;
use App\Models\Ecommerce\Order;
use App\Models\Ecommerce\OrderItem;
use App\Models\Ecommerce\Product;
use App\Models\Ecommerce\ReturnRequest;
use App\Models\Ecommerce\ReturnRequestItem;
use Illuminate\Database\Seeder;
use Illuminate\Support\Carbon;

class ReturnRequestSeeder extends Seeder
{
    public function run(): void
    {
        // Get or create customers
        $customers = Customer::where('is_active', true)->take(3)->get();
        
        if ($customers->isEmpty()) {
            $customers = collect([
                Customer::firstOrCreate(
                    ['email' => 'return.customer1@example.com'],
                    [
                        'name' => 'Return Customer 1',
                        'phone' => '0123456781',
                        'password' => bcrypt('password'),
                        'is_active' => true,
                    ]
                ),
                Customer::firstOrCreate(
                    ['email' => 'return.customer2@example.com'],
                    [
                        'name' => 'Return Customer 2',
                        'phone' => '0123456782',
                        'password' => bcrypt('password'),
                        'is_active' => true,
                    ]
                ),
                Customer::firstOrCreate(
                    ['email' => 'return.customer3@example.com'],
                    [
                        'name' => 'Return Customer 3',
                        'phone' => '0123456783',
                        'password' => bcrypt('password'),
                        'is_active' => true,
                    ]
                ),
            ]);
        }

        // Get or create products
        $products = Product::where('is_active', true)->take(5)->get();
        
        if ($products->isEmpty()) {
            $this->command->warn('No products found. Please run FrontendTestDataSeeder first.');
            return;
        }

        // Create orders with items for return requests
        $orders = [];
        foreach ($customers as $index => $customer) {
            $orderNumber = 'RET-' . str_pad($index + 1, 4, '0', STR_PAD_LEFT);
            
            $order = Order::firstOrCreate(
                ['order_number' => $orderNumber],
                [
                    'customer_id' => $customer->id,
                    'status' => 'completed',
                    'payment_status' => 'paid',
                    'payment_method' => 'manual',
                    'subtotal' => 500.00,
                    'discount_total' => 0,
                    'shipping_fee' => 10.00,
                    'grand_total' => 510.00,
                    'pickup_or_shipping' => 'shipping',
                    'shipping_name' => $customer->name,
                    'shipping_phone' => $customer->phone,
                    'shipping_address_line1' => '123 Return Street',
                    'shipping_city' => 'Kuala Lumpur',
                    'shipping_state' => 'Wilayah Persekutuan',
                    'shipping_postcode' => '50000',
                    'shipping_country' => 'Malaysia',
                    'placed_at' => Carbon::now()->subDays(30),
                    'paid_at' => Carbon::now()->subDays(29),
                    'completed_at' => Carbon::now()->subDays(25),
                ]
            );

            // Create order items if they don't exist
            if ($order->items()->count() === 0) {
                $product = $products->get($index % $products->count());
                $quantity = 2;
                $price = $product->price ?? 100.00;
                
                OrderItem::create([
                    'order_id' => $order->id,
                    'product_id' => $product->id,
                    'product_name_snapshot' => $product->name,
                    'sku_snapshot' => $product->sku ?? 'SKU-' . $product->id,
                    'price_snapshot' => $price,
                    'quantity' => $quantity,
                    'line_total' => $price * $quantity,
                    'is_package' => false,
                ]);
            }

            $orders[] = $order;
        }

        // Create return requests with different statuses
        $this->createReturnRequest(
            $orders[0],
            $customers->get(0),
            'return',
            'pending',
            '产品有瑕疵',
            '收到的产品有划痕，希望退货',
            null,
            null,
            null,
            null,
            null,
            null,
            null
        );

        $this->createReturnRequest(
            $orders[0],
            $customers->get(0),
            'exchange',
            'reviewed',
            '尺寸不合适',
            '购买的尺寸太小，希望换大一号',
            ['/images/returns/size-issue-1.jpg'],
            '已审核，同意换货',
            null,
            null,
            Carbon::now()->subDays(5),
            null,
            null
        );

        if (isset($orders[1])) {
            $this->createReturnRequest(
                $orders[1],
                $customers->get(1),
                'return',
                'received',
                '质量问题',
                '产品使用一周后出现故障',
                ['/images/returns/defect-1.jpg', '/images/returns/defect-2.jpg'],
                '已收到退货商品，正在检查',
                'J&T Express',
                'JT1234567890',
                Carbon::now()->subDays(10),
                Carbon::now()->subDays(3),
                Carbon::now()->subDays(2)
            );
        }

        if (isset($orders[2])) {
            $this->createReturnRequest(
                $orders[2],
                $customers->get(2),
                'return',
                'completed',
                '不满意',
                '产品与描述不符，要求退款',
                ['/images/returns/mismatch-1.jpg'],
                '退款已完成',
                'Pos Laju',
                'PL9876543210',
                Carbon::now()->subDays(15),
                Carbon::now()->subDays(12),
                Carbon::now()->subDays(10),
                Carbon::now()->subDays(8)
            );
        }

        // Create additional return requests with various statuses
        if (count($orders) > 0) {
            $order = $orders[0];
            $customer = $customers->get(0);
            
            // Another pending return
            $this->createReturnRequest(
                $order,
                $customer,
                'return',
                'pending',
                '颜色不对',
                '收到的颜色与订单不符',
                null,
                null,
                null,
                null,
                null,
                null,
                null
            );

            // Return with tracking submitted
            $this->createReturnRequest(
                $order,
                $customer,
                'return',
                'reviewed',
                '损坏',
                '包装破损，产品损坏',
                ['/images/returns/damaged-1.jpg'],
                '已审核，请寄回商品',
                null,
                null,
                Carbon::now()->subDays(2),
                null,
                null
            );
        }

        $this->command->info('Return requests seeded successfully!');
    }

    private function createReturnRequest(
        Order $order,
        Customer $customer,
        string $requestType,
        string $status,
        ?string $reason,
        ?string $description,
        ?array $initialImageUrls,
        ?string $adminNote,
        ?string $returnCourierName,
        ?string $returnTrackingNo,
        ?Carbon $reviewedAt,
        ?Carbon $receivedAt,
        ?Carbon $completedAt
    ): void {
        $returnRequest = ReturnRequest::create([
            'order_id' => $order->id,
            'customer_id' => $customer->id,
            'request_type' => $requestType,
            'status' => $status,
            'reason' => $reason,
            'description' => $description,
            'initial_image_urls' => $initialImageUrls,
            'admin_note' => $adminNote,
            'return_courier_name' => $returnCourierName,
            'return_tracking_no' => $returnTrackingNo,
            'return_shipped_at' => $returnTrackingNo ? Carbon::now()->subDays(5) : null,
            'reviewed_at' => $reviewedAt,
            'received_at' => $receivedAt,
            'completed_at' => $completedAt,
        ]);

        // Create return request items
        $orderItems = $order->items;
        if ($orderItems->count() > 0) {
            $orderItem = $orderItems->first();
            $returnQuantity = min(1, $orderItem->quantity); // Return at least 1 item
            
            ReturnRequestItem::create([
                'return_request_id' => $returnRequest->id,
                'order_item_id' => $orderItem->id,
                'quantity' => $returnQuantity,
            ]);
        }
    }
}

