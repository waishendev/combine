<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>Invoice {{ $order->order_number }}</title>

  @php
    $cjkFontCandidates = [
      public_path('fonts/NotoSansSC-Regular.otf'),
      storage_path('fonts/NotoSansSC-Regular.otf'),
    ];
    $cjkFontFile = collect($cjkFontCandidates)->first(fn ($path) => file_exists($path));
  @endphp

  <style>
    @if($cjkFontFile)
    @font-face {
      font-family: "Noto Sans SC";
      font-style: normal;
      font-weight: 400;
      src: url("{{ 'file://' . $cjkFontFile }}") format("opentype");
    }
    @endif

    @page { margin: 24px; }

    body{
      font-family:"Noto Sans CJK SC","Noto Sans SC","Microsoft YaHei","PingFang SC","Heiti SC","SimHei","WenQuanYi Micro Hei",DejaVu Sans,Arial,sans-serif;
      font-size: 12px;
      color:#111827;
      margin:0;
      line-height:1.35;
    }
    h1,h2,h3,p{ margin:0; padding:0; }

    .muted{ color:#6b7280; }
    .small{ font-size:10px; }
    .page{ width:100%; }

    .section{ margin-bottom:18px; }
    .divider{ height:1px; background:#e5e7eb; margin:14px 0; }

    table{ border-collapse:collapse; width:100%; }

    /* Header */
    .header-table td{ vertical-align:top; }
    .company-block{ padding-bottom:10px; }
    .company-logo{
      max-width:140px;
      height:34px;
      object-fit:contain;
      display:block;
    }
    .company-name{
      font-size:16px;
      font-weight:700;
      margin-bottom:2px;
      color:#111827;
    }
    .company-meta div{ margin-top:2px; }

    /* Document title + status */
    .doc-title{
      font-size:26px;
      font-weight:800;
      text-align:right;
      letter-spacing:0.08em;
    }
    .doc-subtitle{
      font-size:10px;
      text-transform:uppercase;
      letter-spacing:0.14em;
      text-align:right;
      margin-top:2px;
      color:#6b7280;
    }
    .status-badge{
      display:inline-block;
      padding:4px 10px;
      border-radius:999px;
      font-size:10px;
      font-weight:700;
      letter-spacing:0.06em;
      text-transform:uppercase;
      margin-top:10px;
    }
    .status-paid{
      background:#ecfdf5;
      color:#065f46;
      border:1px solid #a7f3d0;
    }
    .status-unpaid{
      background:#fffbeb;
      color:#92400e;
      border:1px solid #fde68a;
    }

    /* Meta table */
    .meta-table{
      width:100%;
      margin-top:10px;
    }
    .meta-table td{
      padding:2px 0;
      font-size:11px;
    }
    .meta-table td:first-child{
      color:#6b7280;
      padding-right:12px;
      white-space:nowrap;
      width:120px;
    }
    .meta-table td:last-child{
      text-align:right;
      white-space:nowrap;
      font-weight:600;
      color:#111827;
    }

    /* Address blocks */
    .info-table th{
      text-align:left;
      font-size:11px;
      padding:10px 0 6px 0;
      border-top:1px solid #e5e7eb;
      text-transform:uppercase;
      letter-spacing:0.10em;
      color:#374151;
    }
    .info-table td{
      padding-top:6px;
      padding-right:18px;
      vertical-align:top;
      width:50%;
    }
    .addr-title{
      font-weight:700;
      margin-bottom:3px;
    }
    .addr-line{ margin-top:1px; }

    /* Items table */
    .items-table th, .items-table td{
      border-bottom:1px solid #e5e7eb;
      padding:10px 6px;
      vertical-align:top;
    }
    .items-table th{
      background:#f9fafb;
      font-size:10px;
      text-transform:uppercase;
      letter-spacing:0.10em;
      color:#374151;
    }
    .items-table td:first-child{ width:58%; }
    .numeric{ text-align:right; white-space:nowrap; }
    .item-name{
      font-weight:700;
      color:#111827;
      margin-bottom:2px;
    }
    .sku{
      font-size:10px;
      color:#6b7280;
    }
    .price-line{
      font-size:10px;
      color:#6b7280;
      margin-top:3px;
    }

    /* Totals */
    .totals-wrap{ width:100%; }
    .totals-table{
      width:320px;
      margin-left:auto;
      border:1px solid #e5e7eb;
      border-radius:10px;
    }
    /* dompdf doesn't support border-radius on table reliably; keep border clean anyway */
    .totals-table td{
      padding:6px 10px;
      font-size:11px;
    }
    .totals-table tr:not(.grand) td{
      border-bottom:1px solid #f3f4f6;
    }
    .totals-table td:first-child{ color:#6b7280; }
    .totals-table td:last-child{ text-align:right; font-weight:600; color:#111827; }

    .grand td{
      padding:10px 10px;
      font-size:13px;
      font-weight:800;
      color:#111827;
      border-bottom:none;
      background:#f9fafb;
    }
    .grand td:first-child{
      text-transform:uppercase;
      letter-spacing:0.08em;
      color:#111827;
    }

    .payment-note{
      text-align:right;
      margin-top:8px;
      font-size:10px;
      color:#6b7280;
    }

    /* Footer */
    .footer{
      margin-top:22px;
      padding-top:12px;
      border-top:1px solid #e5e7eb;
      font-size:10px;
      color:#6b7280;
    }
    .footer .thanks{
      font-weight:700;
      color:#374151;
      margin-bottom:4px;
    }
    .footer .line{ margin-top:2px; }
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

  $paymentMethodRaw = $order->payment_method ?? '';
  $paymentMethodMap = [
    'manual_transfer' => 'Manual Transfer',
    'billplz' => 'Billplz',
  ];
  $paymentMethodLabel = $paymentMethodMap[$paymentMethodRaw] ?? ($paymentMethodRaw ?: '-');
  $paymentMethodDisplay = $paymentMethodLabel;
  if ($paymentMethodRaw && $paymentMethodLabel !== $paymentMethodRaw) {
    $paymentMethodDisplay ;
  }

  // ✅ Business-grade logic: Paid => RECEIPT, Unpaid => INVOICE
  $isPaid = (bool) $order->paid_at;
  $docTitle = $isPaid ? 'RECEIPT' : 'INVOICE';

  // Optional: show "Tax Invoice" wording if you later need SST/GST etc.
  // $docTitle = $isPaid ? 'RECEIPT' : 'TAX INVOICE';

  $footerNote = $profile['footer_note'] ?? null;

  // Support lines (fallback to profile fields)
  $supportEmail = $profile['company_email'] ?? null;
  $supportPhone = $profile['company_phone'] ?? null;
  $companyWebsite = $profile['company_website'] ?? null;
@endphp

  <div class="page">

    <!-- Header -->
    <div class="section">
      <table class="header-table">
        <tr>
          <td style="width:60%;">
            <table style="width:100%;">
              <tr>
                @if(!empty($profile['company_logo_url']))
                  <td style="width:150px; padding-right:10px; vertical-align:top;">
                    <img class="company-logo" src="{{ $profile['company_logo_url'] }}" alt="Company Logo" />
                  </td>
                @endif
                <td style="vertical-align:top;">
                  <div class="company-name">{{ $profile['company_name'] ?? 'Company Name' }}</div>

                  <div class="company-meta muted">
                    @if(!empty($profile['company_reg_no']))
                      <div>Reg No: {{ $profile['company_reg_no'] }}</div>
                    @endif
                    @if(!empty($profile['company_phone']))
                      <div>Phone: {{ $profile['company_phone'] }}</div>
                    @endif
                    @if(!empty($profile['company_email']))
                      <div>Email: {{ $profile['company_email'] }}</div>
                    @endif
                    @if(!empty($profile['company_website']))
                      <div>Website: {{ $profile['company_website'] }}</div>
                    @endif
                  </div>
                </td>
              </tr>
            </table>

            @if(!empty($profile['company_address']))
              <div class="muted" style="margin-top:8px;">
                {!! nl2br(e($profile['company_address'])) !!}
              </div>
            @endif
          </td>

          <td style="width:40%; text-align:right;">
            <div class="doc-title">{{ $docTitle }}</div>
            <!-- <div class="status-badge {{ $isPaid ? 'status-paid' : 'status-unpaid' }}">
              {{ $isPaid ? 'PAID' : 'UNPAID' }}
            </div> -->

            <table class="meta-table">
              <tr>
                <td>{{ $docTitle === 'RECEIPT' ? 'Receipt No' : 'Invoice No' }}</td>
                <td>{{ $order->order_number }}</td>
              </tr>
              <tr>
                <td>Order Date</td>
                <td>{{ optional($order->placed_at)->format('Y-m-d H:i') ?? '-' }}</td>
              </tr>
              <tr>
                <td>Paid Date</td>
                <td>{{ optional($order->paid_at)->format('Y-m-d H:i') ?? '-' }}</td>
              </tr>
              <tr>
                <td>Payment Method</td>
                <td>{{ $paymentMethodDisplay }}</td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </div>

    <!-- Addresses -->
    <div class="section">
      <table class="info-table">
        <tr>
          <th>Bill To</th>
          <th>{{ $order->pickup_or_shipping === 'pickup' ? 'Pickup' : 'Ship To' }}</th>
        </tr>

        <tr>
          <td>
            <div class="addr-title">{{ $billingName ?? '-' }}</div>
            @if($billingPhone)
              <div class="addr-line muted">Phone: {{ $billingPhone }}</div>
            @endif
            @if($billingLine1)
              <div class="addr-line">{{ $billingLine1 }}</div>
            @endif
            @if($billingLine2)
              <div class="addr-line">{{ $billingLine2 }}</div>
            @endif
            <div class="addr-line">
              {{ trim(collect([$billingPostcode, $billingCity, $billingState])->filter()->implode(' ')) }}
            </div>
            <div class="addr-line">{{ $billingCountry ?? '-' }}</div>
          </td>

          <td>
            @if($order->pickup_or_shipping === 'pickup')
              @if($order->pickupStore)
                <div class="addr-title">{{ $order->pickupStore->name }}</div>
                @if($order->pickupStore->address_line1)
                  <div class="addr-line">{{ $order->pickupStore->address_line1 }}</div>
                @endif
                @if($order->pickupStore->address_line2)
                  <div class="addr-line">{{ $order->pickupStore->address_line2 }}</div>
                @endif
                <div class="addr-line">
                  {{ trim(collect([$order->pickupStore->postcode, $order->pickupStore->city, $order->pickupStore->state])->filter()->implode(' ')) }}
                </div>
                @if($order->pickupStore->country)
                  <div class="addr-line">{{ $order->pickupStore->country }}</div>
                @endif
              @endif

              <div style="margin-top:8px;" class="muted small">
                Pickup Contact: <strong style="color:#111827;">{{ $order->shipping_name ?? '-' }}</strong>
              </div>
              @if($order->shipping_phone)
                <div class="muted small">Phone: {{ $order->shipping_phone }}</div>
              @endif

            @else
              <div class="addr-title">{{ $order->shipping_name ?? '-' }}</div>
              @if($order->shipping_phone)
                <div class="addr-line muted">Phone: {{ $order->shipping_phone }}</div>
              @endif
              @if($order->shipping_address_line1)
                <div class="addr-line">{{ $order->shipping_address_line1 }}</div>
              @endif
              @if($order->shipping_address_line2)
                <div class="addr-line">{{ $order->shipping_address_line2 }}</div>
              @endif
              <div class="addr-line">
                {{ trim(collect([$order->shipping_postcode, $order->shipping_city, $order->shipping_state])->filter()->implode(' ')) }}
              </div>
              <div class="addr-line">{{ $order->shipping_country ?? '-' }}</div>
            @endif
          </td>
        </tr>
      </table>
    </div>

    <!-- Items -->
    <div class="section">
      <table class="items-table">
        <thead>
          <tr>
            <th>Item</th>
            <th class="numeric">Qty</th>
            <th class="numeric">Unit Price</th>
            <th class="numeric">Amount</th>
          </tr>
        </thead>
        <tbody>
          @foreach($order->items as $item)
            <tr>
              <td>
                <div class="item-name">{{ $item->product_name_snapshot }}</div>

                @if($item->sku_snapshot)
                  <div class="sku">SKU: {{ $item->sku_snapshot }}</div>
                @endif

                <!-- Optional: show price x qty in a friendly way -->
                <!-- <div class="price-line">
                  {{ $currency }} {{ number_format((float) $item->price_snapshot, 2) }}
                  × {{ (int) $item->quantity }}
                </div> -->
              </td>

              <td class="numeric">{{ (int) $item->quantity }}</td>
              <td class="numeric">{{ $currency }} {{ number_format((float) $item->price_snapshot, 2) }}</td>
              <td class="numeric">{{ $currency }} {{ number_format((float) $item->line_total, 2) }}</td>
            </tr>
          @endforeach
        </tbody>
      </table>
    </div>

    <!-- Totals -->
    <div class="section totals-wrap">
      <table class="totals-table">
        <tr>
          <td>Subtotal</td>
          <td>{{ $currency }} {{ number_format((float) $order->subtotal, 2) }}</td>
        </tr>
        <tr>
          <td>Discount</td>
          <td>{{ $currency }} {{ number_format((float) $order->discount_total, 2) }}</td>
        </tr>
        <tr>
          <td>Shipping</td>
          <td>{{ $currency }} {{ number_format((float) $order->shipping_fee, 2) }}</td>
        </tr>
        <tr class="grand">
          <td>Grand Total</td>
          <td>{{ $currency }} {{ number_format((float) $order->grand_total, 2) }}</td>
        </tr>
      </table>
    </div>

    <!-- Footer -->
    <div class="footer">
      <div class="thanks">Thank you for shopping with {{ $profile['company_name'] ?? 'us' }}.</div>

      @if($supportEmail)
        <div class="line">Support Email: {{ $supportEmail }}</div>
      @endif
      @if($supportPhone)
        <div class="line">Support Phone: {{ $supportPhone }}</div>
      @endif
      @if($companyWebsite)
        <div class="line">Website: {{ $companyWebsite }}</div>
      @endif

      @if($footerNote)
        <div class="line" style="margin-top:6px;">{{ $footerNote }}</div>
      @else
        <div class="line" style="margin-top:6px;">This document is generated electronically and is valid without signature.</div>
      @endif
    </div>

  </div>
</body>
</html>
