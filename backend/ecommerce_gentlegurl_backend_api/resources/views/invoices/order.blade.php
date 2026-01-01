<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <title>Invoice {{ $order->order_number }}</title>
    <style>
        @page {
            margin: 24px;
        }
        body {
            font-family: DejaVu Sans, Arial, sans-serif;
            font-size: 12px;
            color: #1f2937;
            margin: 0;
        }
        h1, h2, h3, p {
            margin: 0;
            padding: 0;
        }
        .muted {
            color: #6b7280;
        }
        .page {
            width: 100%;
        }
        .section {
            margin-bottom: 18px;
        }
        .header-table,
        .info-table,
        .items-table,
        .totals-table {
            width: 100%;
            border-collapse: collapse;
        }
        .header-table td {
            vertical-align: top;
        }
        .company-logo {
            max-width: 140px;
            max-height: 70px;
            margin-bottom: 10px;
        }
        .company-name {
            font-size: 16px;
            font-weight: bold;
            margin-bottom: 4px;
        }
        .invoice-title {
            font-size: 24px;
            font-weight: bold;
            text-align: right;
            letter-spacing: 1px;
        }
        .meta-table {
            width: 100%;
            border-collapse: collapse;
            margin-top: 8px;
        }
        .meta-table td {
            padding: 2px 0;
            font-size: 11px;
        }
        .meta-table td:first-child {
            color: #6b7280;
            padding-right: 12px;
            white-space: nowrap;
        }
        .info-table th {
            text-align: left;
            font-size: 12px;
            padding-bottom: 6px;
        }
        .info-table td {
            padding-right: 20px;
            vertical-align: top;
            width: 50%;
        }
        .items-table th,
        .items-table td {
            border-bottom: 1px solid #e5e7eb;
            padding: 8px 6px;
        }
        .items-table th {
            background: #f9fafb;
            font-size: 11px;
            text-transform: uppercase;
            letter-spacing: 0.04em;
        }
        .items-table .numeric {
            text-align: right;
            white-space: nowrap;
        }
        .sku {
            font-size: 10px;
            color: #6b7280;
            margin-top: 2px;
        }
        .totals-wrapper {
            width: 100%;
        }
        .totals-table {
            width: 260px;
            margin-left: auto;
        }
        .totals-table td {
            padding: 4px 0;
        }
        .totals-table tr:last-child td {
            font-weight: bold;
            font-size: 13px;
        }
        .payment-status {
            font-size: 11px;
            margin-top: 6px;
            text-align: right;
        }
        .footer-note {
            font-size: 10px;
            color: #6b7280;
            text-align: center;
            margin-top: 24px;
        }
    </style>
</head>
<body>
@php
    $profile = $invoiceProfile ?? [];
    $currency = $profile['currency'] ?? 'MYR';
    $billingFields = [
        $order->billing_name,
        $order->billing_phone,
        $order->billing_address_line1,
        $order->billing_address_line2,
        $order->billing_city,
        $order->billing_state,
        $order->billing_postcode,
        $order->billing_country,
    ];
    $useShippingForBilling = !collect($billingFields)->filter()->count();
    $billingName = $useShippingForBilling ? $order->shipping_name : $order->billing_name;
    $billingPhone = $useShippingForBilling ? $order->shipping_phone : $order->billing_phone;
    $billingLine1 = $useShippingForBilling ? $order->shipping_address_line1 : $order->billing_address_line1;
    $billingLine2 = $useShippingForBilling ? $order->shipping_address_line2 : $order->billing_address_line2;
    $billingCity = $useShippingForBilling ? $order->shipping_city : $order->billing_city;
    $billingState = $useShippingForBilling ? $order->shipping_state : $order->billing_state;
    $billingPostcode = $useShippingForBilling ? $order->shipping_postcode : $order->billing_postcode;
    $billingCountry = $useShippingForBilling ? $order->shipping_country : $order->billing_country;
@endphp
    <div class="page">
        <div class="section">
            <table class="header-table">
                <tr>
                    <td>
                        @if(!empty($profile['company_logo_url']))
                            <img class="company-logo" src="{{ $profile['company_logo_url'] }}" alt="Company Logo">
                        @endif
                        <div class="company-name">{{ $profile['company_name'] ?? 'Company Name' }}</div>
                        @if(!empty($profile['company_address']))
                            <div>{!! nl2br(e($profile['company_address'])) !!}</div>
                        @endif
                        @if(!empty($profile['company_phone']))
                            <div>Phone: {{ $profile['company_phone'] }}</div>
                        @endif
                        @if(!empty($profile['company_email']))
                            <div>Email: {{ $profile['company_email'] }}</div>
                        @endif
                    </td>
                    <td style="text-align: right;">
                        <div class="invoice-title">INVOICE</div>
                        <table class="meta-table">
                            <tr>
                                <td>Invoice No</td>
                                <td>{{ $order->order_number }}</td>
                            </tr>
                            <tr>
                                <td>Placed Date</td>
                                <td>{{ optional($order->placed_at)->format('Y-m-d H:i') ?? '-' }}</td>
                            </tr>
                            <tr>
                                <td>Paid Date</td>
                                <td>{{ optional($order->paid_at)->format('Y-m-d H:i') ?? '-' }}</td>
                            </tr>
                            <tr>
                                <td>Completed Date</td>
                                <td>{{ optional($order->completed_at)->format('Y-m-d H:i') ?? '-' }}</td>
                            </tr>
                            <tr>
                                <td>Payment Method</td>
                                <td>{{ $order->payment_method ?? '-' }}</td>
                            </tr>
                        </table>
                    </td>
                </tr>
            </table>
        </div>

        <div class="section">
            <table class="info-table">
                <tr>
                    <th>Bill To</th>
                    <th>Ship To / Pickup</th>
                </tr>
                <tr>
                    <td>
                        <div>{{ $billingName ?? '-' }}</div>
                        @if($billingPhone)
                            <div>Phone: {{ $billingPhone }}</div>
                        @endif
                        @if($billingLine1)
                            <div>{{ $billingLine1 }}</div>
                        @endif
                        @if($billingLine2)
                            <div>{{ $billingLine2 }}</div>
                        @endif
                        <div>{{ trim(collect([$billingPostcode, $billingCity, $billingState])->filter()->implode(' ')) }}</div>
                        <div>{{ $billingCountry ?? '-' }}</div>
                    </td>
                    <td>
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
                    </td>
                </tr>
            </table>
        </div>

        <div class="section">
            <table class="items-table">
                <thead>
                    <tr>
                        <th>Item</th>
                        <th class="numeric">Qty</th>
                        <th class="numeric">Unit</th>
                        <th class="numeric">Total</th>
                    </tr>
                </thead>
                <tbody>
                    @foreach($order->items as $item)
                        <tr>
                            <td>
                                <div>{{ $item->product_name_snapshot }}</div>
                                @if($item->sku_snapshot)
                                    <div class="sku">SKU: {{ $item->sku_snapshot }}</div>
                                @endif
                            </td>
                            <td class="numeric">{{ $item->quantity }}</td>
                            <td class="numeric">{{ $currency }} {{ number_format((float) $item->price_snapshot, 2) }}</td>
                            <td class="numeric">{{ $currency }} {{ number_format((float) $item->line_total, 2) }}</td>
                        </tr>
                    @endforeach
                </tbody>
            </table>
        </div>

        <div class="section totals-wrapper">
            <table class="totals-table">
                <tr>
                    <td class="muted">Subtotal</td>
                    <td class="numeric">{{ $currency }} {{ number_format((float) $order->subtotal, 2) }}</td>
                </tr>
                <tr>
                    <td class="muted">Discount</td>
                    <td class="numeric">{{ $currency }} {{ number_format((float) $order->discount_total, 2) }}</td>
                </tr>
                <tr>
                    <td class="muted">Shipping</td>
                    <td class="numeric">{{ $currency }} {{ number_format((float) $order->shipping_fee, 2) }}</td>
                </tr>
                <tr>
                    <td>Grand Total</td>
                    <td class="numeric">{{ $currency }} {{ number_format((float) $order->grand_total, 2) }}</td>
                </tr>
            </table>
            <div class="payment-status muted">
                Payment Status: {{ $order->paid_at ? 'Paid' : 'Unpaid' }}
            </div>
        </div>

        @if(!empty($profile['footer_note']))
            <div class="footer-note">{{ $profile['footer_note'] }}</div>
        @endif
    </div>
</body>
</html>
