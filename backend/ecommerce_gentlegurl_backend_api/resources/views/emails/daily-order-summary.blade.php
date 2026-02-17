<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Daily Pending Orders Summary</title>
</head>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 700px; margin: 0 auto; padding: 20px;">
    <div style="background-color: #f9f9f9; padding: 30px; border-radius: 8px;">
        <h1 style="color: #333; margin-top: 0;">Daily Pending Orders Summary</h1>
        <p><strong>Date:</strong> {{ $summary['date'] }}</p>
        <p><strong>Total Orders:</strong> {{ $summary['total_orders'] }}</p>
        <p><strong>Total Revenue:</strong> {{ number_format((float) $summary['total_revenue'], 2) }}</p>

        <hr style="border: 0; border-top: 1px solid #ddd; margin: 20px 0;">

        @if ($summary['total_orders'] === 0)
            <p>No pending orders matched the criteria today.</p>
        @else
            <h2 style="color: #333;">Orders</h2>
            @foreach ($summary['orders'] as $order)
                <div style="padding: 15px; border: 1px solid #e0e0e0; border-radius: 6px; margin-bottom: 15px; background-color: #ffffff;">
                    <p style="margin: 0 0 8px;"><strong>Order:</strong> {{ $order['order_number'] }}</p>
                    <p style="margin: 0 0 8px;"><strong>Status:</strong> {{ $order['status'] }} / {{ $order['payment_status'] }}</p>
                    <p style="margin: 0 0 8px;"><strong>Customer:</strong> {{ $order['customer_name'] }}</p>
                    <p style="margin: 0 0 8px;"><strong>Total Amount:</strong> {{ number_format((float) $order['total_amount'], 2) }}</p>
                    <p style="margin: 0;"><strong>Products:</strong>
                        @if (! empty($order['product_names']))
                            {{ implode(', ', $order['product_names']) }}
                        @else
                            N/A
                        @endif
                    </p>
                </div>
            @endforeach
        @endif
    </div>
</body>
</html>
