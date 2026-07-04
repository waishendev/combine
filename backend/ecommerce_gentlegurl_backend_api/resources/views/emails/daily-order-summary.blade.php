<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Current Pending Orders Summary</title>
</head>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 700px; margin: 0 auto; padding: 20px;">
    <div style="background-color: #f9f9f9; padding: 30px; border-radius: 8px;">
        <h1 style="color: #333; margin-top: 0;">Current Pending Orders Summary</h1>
        <p style="margin: 0 0 16px; color: #666;">Matches POS Request Center pending tasks (Booking + Ecommerce tabs).</p>
        <p><strong>Date:</strong> {{ $summary['date'] }}</p>
        <p><strong>Total Pending Tasks:</strong> {{ $summary['total_tasks'] }}</p>
        <p><strong>Booking Requests:</strong> {{ $summary['total_booking_requests'] }}</p>
        <p><strong>Ecommerce Orders:</strong> {{ $summary['total_ecommerce_orders'] }}</p>
        <p><strong>Ecommerce Revenue (pending):</strong> {{ number_format((float) $summary['total_revenue'], 2) }}</p>

        <hr style="border: 0; border-top: 1px solid #ddd; margin: 20px 0;">

        @if ($summary['total_tasks'] === 0)
            <p>No pending Request Center tasks need attention right now.</p>
        @else
            @if ($summary['total_booking_requests'] > 0)
                <h2 style="color: #333;">Booking Requests</h2>
                @foreach ($summary['booking_requests'] as $request)
                    <div style="padding: 15px; border: 1px solid #f0d9a8; border-radius: 6px; margin-bottom: 15px; background-color: #fffaf0;">
                        <p style="margin: 0 0 8px;"><strong>Booking:</strong> {{ $request['reference'] }} <span style="color:#666;">({{ $request['request_type'] }})</span></p>
                        <p style="margin: 0 0 8px;"><strong>Status:</strong> {{ strtoupper($request['status']) }}</p>
                        <p style="margin: 0 0 8px;"><strong>Customer:</strong> {{ $request['customer_name'] }}</p>
                        <p style="margin: 0 0 8px;"><strong>Contact:</strong> {{ $request['contact'] }}</p>
                        @if (! empty($request['requested_at']))
                            <p style="margin: 0 0 8px;"><strong>Requested:</strong> {{ $request['requested_at'] }}</p>
                        @endif
                        @if (! empty($request['reason']))
                            <p style="margin: 0;"><strong>Reason:</strong> {{ $request['reason'] }}</p>
                        @endif
                    </div>
                @endforeach
            @endif

            @if ($summary['total_ecommerce_orders'] > 0)
                <h2 style="color: #333;">Ecommerce Orders</h2>
                @foreach ($summary['ecommerce_orders'] as $order)
                    <div style="padding: 15px; border: 1px solid #e0e0e0; border-radius: 6px; margin-bottom: 15px; background-color: #ffffff;">
                        <p style="margin: 0 0 8px;"><strong>Order:</strong> {{ $order['order_number'] }} <span style="color:#666;">({{ $order['order_kind'] ?? 'Shop' }})</span></p>
                        <p style="margin: 0 0 8px;"><strong>Status:</strong> {{ $order['status_label'] ?? ($order['status'] . ' / ' . $order['payment_status']) }}</p>
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
        @endif
    </div>
</body>
</html>
