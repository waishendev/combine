<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <title>Invoice {{ $order->order_number }}</title>
    <style>
        body {
            font-family: DejaVu Sans, Arial, sans-serif;
            font-size: 12px;
            color: #1f2937;
        }
        h1, h2 {
            margin: 0 0 8px 0;
        }
        .muted {
            color: #6b7280;
        }
        .section {
            margin-bottom: 18px;
        }
        .row {
            display: flex;
            justify-content: space-between;
        }
        table {
            width: 100%;
            border-collapse: collapse;
        }
        th, td {
            border-bottom: 1px solid #e5e7eb;
            padding: 8px 6px;
            text-align: left;
        }
        th {
            background: #f9fafb;
            font-size: 11px;
            text-transform: uppercase;
            letter-spacing: 0.04em;
        }
        .totals td {
            border: none;
            padding: 4px 6px;
        }
        .totals tr:last-child td {
            font-weight: bold;
            font-size: 13px;
        }
    </style>
</head>
<body>
    <div class="section">
        <h1>Invoice</h1>
        <div class="row">
            <div>
                <div class="muted">Invoice No</div>
                <div>{{ $order->order_number }}</div>
            </div>
            <div>
                <div class="muted">Placed Date</div>
                <div>{{ optional($order->placed_at)->toDateTimeString() ?? '-' }}</div>
                <div class="muted" style="margin-top: 6px;">Completed Date</div>
                <div>{{ optional($order->completed_at)->toDateTimeString() ?? '-' }}</div>
            </div>
        </div>
    </div>

    <div class="section">
        <h2>Billing Address</h2>
        <div>{{ $order->billing_name ?? '-' }}</div>
        @if($order->billing_phone)
            <div>Phone: {{ $order->billing_phone }}</div>
        @endif
        @if($order->billing_address_line1)
            <div>{{ $order->billing_address_line1 }}</div>
        @endif
        @if($order->billing_address_line2)
            <div>{{ $order->billing_address_line2 }}</div>
        @endif
        <div>
            {{ trim(collect([$order->billing_postcode, $order->billing_city, $order->billing_state])->filter()->implode(' ')) }}
        </div>
        <div>{{ $order->billing_country ?? '-' }}</div>
    </div>

    <div class="section">
        <h2>Shipping / Pickup</h2>
        @if($order->pickup_or_shipping === 'pickup')
            <div>Pickup Contact: {{ $order->shipping_name ?? '-' }}</div>
            @if($order->shipping_phone)
                <div>Phone: {{ $order->shipping_phone }}</div>
            @endif
            @if($order->pickupStore)
                <div style="margin-top: 6px;"><strong>{{ $order->pickupStore->name }}</strong></div>
                <div>{{ $order->pickupStore->address_line1 }}</div>
                @if($order->pickupStore->address_line2)
                    <div>{{ $order->pickupStore->address_line2 }}</div>
                @endif
                <div>
                    {{ trim(collect([$order->pickupStore->postcode, $order->pickupStore->city, $order->pickupStore->state])->filter()->implode(' ')) }}
                </div>
                <div>{{ $order->pickupStore->country }}</div>
            @endif
        @else
            <div>{{ $order->shipping_name ?? '-' }}</div>
            @if($order->shipping_phone)
                <div>Phone: {{ $order->shipping_phone }}</div>
            @endif
            @if($order->shipping_address_line1)
                <div>{{ $order->shipping_address_line1 }}</div>
            @endif
            @if($order->shipping_address_line2)
                <div>{{ $order->shipping_address_line2 }}</div>
            @endif
            <div>
                {{ trim(collect([$order->shipping_postcode, $order->shipping_city, $order->shipping_state])->filter()->implode(' ')) }}
            </div>
            <div>{{ $order->shipping_country ?? '-' }}</div>
        @endif
    </div>

    <div class="section">
        <h2>Items</h2>
        <table>
            <thead>
                <tr>
                    <th>Item</th>
                    <th style="text-align:right;">Qty</th>
                    <th style="text-align:right;">Unit</th>
                    <th style="text-align:right;">Total</th>
                </tr>
            </thead>
            <tbody>
                @foreach($order->items as $item)
                    <tr>
                        <td>{{ $item->product_name_snapshot }}</td>
                        <td style="text-align:right;">{{ $item->quantity }}</td>
                        <td style="text-align:right;">RM {{ number_format((float) $item->price_snapshot, 2) }}</td>
                        <td style="text-align:right;">RM {{ number_format((float) $item->line_total, 2) }}</td>
                    </tr>
                @endforeach
            </tbody>
        </table>
    </div>

    <div class="section">
        <table class="totals">
            <tr>
                <td class="muted">Subtotal</td>
                <td style="text-align:right;">RM {{ number_format((float) $order->subtotal, 2) }}</td>
            </tr>
            <tr>
                <td class="muted">Discount</td>
                <td style="text-align:right;">RM {{ number_format((float) $order->discount_total, 2) }}</td>
            </tr>
            <tr>
                <td class="muted">Shipping</td>
                <td style="text-align:right;">RM {{ number_format((float) $order->shipping_fee, 2) }}</td>
            </tr>
            <tr>
                <td>Grand Total</td>
                <td style="text-align:right;">RM {{ number_format((float) $order->grand_total, 2) }}</td>
            </tr>
            <tr>
                <td class="muted">Payment Method</td>
                <td style="text-align:right;">{{ $order->payment_method ?? '-' }}</td>
            </tr>
        </table>
    </div>
</body>
</html>
