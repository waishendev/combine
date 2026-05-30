<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>Invoice {{ $order->order_number }}</title>

  @php
    $hiddenReceiptVariantLabels = [
      'Final Settlement',
      'Booking Add-on Settlement',
      'Service',
      'Booking Deposit',
      'Booking Add-on Deposit',
    ];
    $combinedBookingSettlementLineTypes = ['booking_settlement', 'booking_addon'];
    $shouldShowReceiptItem = function ($item) use ($combinedBookingSettlementLineTypes) {
      $lineType = (string) ($item['line_type'] ?? $item['type'] ?? '');
      $productName = (string) ($item['product_name'] ?? $item['name'] ?? '');

      return !($productName !== ''
        && str_contains($productName, '::')
        && in_array($lineType, $combinedBookingSettlementLineTypes, true));
    };

    // Check if CJK font exists (supports Chinese, Japanese, Korean)
    $cjkFontPath = collect([
      public_path('fonts/NotoSansCJKkr-Regular.otf'),
      storage_path('fonts/NotoSansCJKkr-Regular.otf'),
    ])->first(fn ($path) => file_exists($path));
    
    // Define fonts - prioritize CJK font if available, otherwise use separate fonts
    $fontConfigs = [];
    
    if ($cjkFontPath) {
      // Use CJK font that supports both Chinese and Korean
      $fontConfigs[] = [
        'name' => 'Noto Sans CJK',
        'paths' => [$cjkFontPath],
      ];
    } else {
      // Fallback: use separate fonts for Korean and Chinese
      $fontConfigs[] = [
        'name' => 'Noto Sans KR',
        'paths' => [
          public_path('fonts/NotoSansKR-Regular.otf'),
          storage_path('fonts/NotoSansKR-Regular.otf'),
        ],
      ];
      $fontConfigs[] = [
        'name' => 'Noto Sans SC',
        'paths' => [
          public_path('fonts/NotoSansSC-Regular.otf'),
          storage_path('fonts/NotoSansSC-Regular.otf'),
        ],
      ];
    }
    
    // Add Malgun Gothic as fallback
    $fontConfigs[] = [
      'name' => 'Malgun Gothic',
      'paths' => [
        public_path('fonts/malgun.ttf'),
        storage_path('fonts/malgun.ttf'),
      ],
    ];
    
    $resolvedFonts = collect($fontConfigs)->map(function ($config) {
      $fontPath = collect($config['paths'])->first(fn ($path) => file_exists($path));
      if ($fontPath) {
        // Convert Windows path to format suitable for wkhtmltopdf
        $fontPathFormatted = str_replace('\\', '/', $fontPath);
        // Use file:// protocol for local files
        $fontUrl = 'file:///' . $fontPathFormatted;
        $fontFormat = str_ends_with($fontPath, '.ttf') ? 'truetype' : 'opentype';
        return [
          'name' => $config['name'],
          'url' => $fontUrl,
          'format' => $fontFormat,
        ];
      }
      return null;
    })->filter();
  @endphp

  <style>
    <?php foreach($resolvedFonts as $font): ?>
      @font-face {
        font-family: "{{ $font['name'] }}";
        font-style: normal;
        font-weight: 400;
        src: url("{{ $font['url'] }}") format("{{ $font['format'] }}");
      }
    <?php endforeach; ?>

    @page { margin: 24px; }

    body{
      font-family:"Noto Sans CJK","Noto Sans KR","Noto Sans SC","Malgun Gothic","Microsoft YaHei","PingFang SC","Heiti SC","SimHei","WenQuanYi Micro Hei",DejaVu Sans,Arial,sans-serif;
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
  $billingEmail = $order->customer?->email ?? data_get($order->payment_meta, 'pos_billing_email');

  $walkInBillTo = data_get($profile, 'pos_walk_in_bill_to', [
    'name' => 'UNKNOWN',
    'phone' => null,
    'email' => null,
  ]);
  $billingLine1 = $useShippingForBilling ? $order->shipping_address_line1 : $order->billing_address_line1;
  $billingLine2 = $useShippingForBilling ? $order->shipping_address_line2 : $order->billing_address_line2;
  $billingCity = $useShippingForBilling ? $order->shipping_city : $order->billing_city;
  $billingState = $useShippingForBilling ? $order->shipping_state : $order->billing_state;
  $billingPostcode = $useShippingForBilling ? $order->shipping_postcode : $order->billing_postcode;
  $billingCountry = $useShippingForBilling ? $order->shipping_country : $order->billing_country;
  $customerName = $order->customer?->name;
  $customerPhone = $order->customer?->phone;

  $isUnknownWalkIn = strtoupper(trim((string) ($billingName ?? ''))) === 'UNKNOWN';

  if (!$billingName && $customerName) {
    $billingName = $customerName;
  }
  if (!$billingPhone && $customerPhone && !$isUnknownWalkIn) {
    $billingPhone = $customerPhone;
  }

  /** POS in-store sale without a linked member must stay guest/unknown (never auto-assign a real member). */
  if ($order->pickup_or_shipping === 'in_store' && !$order->customer_id) {
    if (!trim((string) ($billingName ?? '')) || $billingName === '-') {
      $billingName = (string) (data_get($walkInBillTo, 'name') ?: 'UNKNOWN');
    }

    if (strtoupper(trim((string) $billingName)) === 'UNKNOWN') {
      $billingPhone = null;
      $billingEmail = null;
    }
  }

  $paymentMethodMap = [
    'manual_transfer' => 'Manual Transfer',
    'billplz' => 'Billplz',
    'cash' => 'Cash',
    'qrpay' => 'QRPay',
    'credit_card' => 'Credit Card',
    'billplz_credit_card' => 'Credit Card',
    'split' => 'Split',
  ];
  $paymentRows = collect($order->payments ?? [])
    ->map(function ($payment) {
      return [
        'method' => data_get($payment, 'payment_method') ?: data_get($payment, 'method'),
        'amount' => (float) data_get($payment, 'amount', 0),
        'reference_no' => data_get($payment, 'reference_no') ?: data_get($payment, 'reference'),
      ];
    })
    ->filter(fn ($payment) => trim((string) ($payment['method'] ?? '')) !== '' && (float) ($payment['amount'] ?? 0) > 0)
    ->values();
  $paymentMethodRaw = (string) ($order->payment_method ?? '');
  $paymentMethodDisplay = $paymentMethodMap[$paymentMethodRaw] ?? ($paymentMethodRaw ?: '-');

  // ✅ Business-grade logic: Paid => RECEIPT, Unpaid => INVOICE
  $isPaid = (bool) $order->paid_at;
  $docTitle = $isPaid ? 'RECEIPT' : 'INVOICE';

  // Optional: show "Tax Invoice" wording if you later need SST/GST etc.
  // $docTitle = $isPaid ? 'RECEIPT' : 'TAX INVOICE';

  $footerNote = $profile['footer_note'] ?? null;
  $receiptStageLabel = $receiptLabel ?? null;
  $coveredByPackage = (bool) data_get($packageCoverage ?? [], 'covered', false);
  $packageAppliedNames = data_get($packageCoverage ?? [], 'package_names', []);
  $packageOffsetDisplay = (float) data_get($packageCoverage ?? [], 'offset', 0);
  $subtotalDisplay = isset($displaySubtotal) ? (float) $displaySubtotal : (float) $order->subtotal;
  $discountDisplay = isset($displayDiscount) ? (float) $displayDiscount : (float) $order->discount_total;
  $shippingDisplay = isset($displayShipping) ? (float) $displayShipping : (float) $order->shipping_fee;
  $grandTotalDisplay = isset($displayGrandTotal) ? (float) $displayGrandTotal : (float) $order->grand_total;

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
                <?php if(!empty($profile['company_logo_url'])): ?>
                  <td style="width:150px; padding-right:10px; vertical-align:top;">
                    <img class="company-logo" src="{{ $profile['company_logo_url'] }}" alt="Company Logo" />
                  </td>
                <?php endif; ?>
                <td style="vertical-align:top;">
                  <div class="company-name">{{ $profile['company_name'] ?? 'Company Name' }}</div>

                  <div class="company-meta muted">
                    <?php if(!empty($profile['company_reg_no'])): ?>
                      <div>Reg No: {{ $profile['company_reg_no'] }}</div>
                    <?php endif; ?>
                    <?php if(!empty($profile['company_phone'])): ?>
                      <div>Phone: {{ $profile['company_phone'] }}</div>
                    <?php endif; ?>
                    <?php if(!empty($profile['company_email'])): ?>
                      <div>Email: {{ $profile['company_email'] }}</div>
                    <?php endif; ?>
                    <?php if(!empty($profile['company_website'])): ?>
                      <div>Website: {{ $profile['company_website'] }}</div>
                    <?php endif; ?>
                  </div>
                </td>
              </tr>
            </table>

            <?php if(!empty($profile['company_address'])): ?>
              <div class="muted" style="margin-top:8px;">
                {!! nl2br(e($profile['company_address'])) !!}
              </div>
            <?php endif; ?>
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
                <td>
                  <?php if($paymentRows->isNotEmpty()): ?>
                    <?php foreach($paymentRows as $payment): ?>
                      <?php $pm = $paymentMethodMap[$payment['method']] ?? $payment['method']; ?>
                      <div>
                        {{ $pm }} {{ $currency }} {{ number_format((float) $payment['amount'], 2) }}
                        <?php if(!empty($payment['reference_no'])): ?>
                          <span class="muted small">({{ $payment['reference_no'] }})</span>
                        <?php endif; ?>
                      </div>
                    <?php endforeach; ?>
                  <?php else: ?>
                    {{ $paymentMethodDisplay }}
                  <?php endif; ?>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </div>

    <!-- Addresses -->
    <div class="section">
      <?php if($order->pickup_or_shipping === 'in_store'): ?>
        <table class="info-table">
          <tr>
            <th>Bill To</th>
          </tr>
          <tr>
            <td style="width:100%;">
              <div class="addr-title">{{ $billingName ?? '-' }}</div>
              <?php if($billingPhone): ?>
                <div class="addr-line muted">Phone: {{ $billingPhone }}</div>
              <?php endif; ?>
              <?php if($billingEmail): ?>
                <div class="addr-line muted">Email: {{ $billingEmail }}</div>
              <?php endif; ?>
              <?php if($billingLine1): ?>
                <div class="addr-line">{{ $billingLine1 }}</div>
              <?php endif; ?>
              <?php if($billingLine2): ?>
                <div class="addr-line">{{ $billingLine2 }}</div>
              <?php endif; ?>
              <div class="addr-line">
                {{ trim(collect([$billingPostcode, $billingCity, $billingState])->filter()->implode(' ')) }}
              </div>
              <?php if(trim((string) ($billingCountry ?? '')) && $billingCountry !== '-'): ?>
                <div class="addr-line">{{ $billingCountry }}</div>
              <?php endif; ?>
            </td>
          </tr>
        </table>
      <?php else: ?>
        <table class="info-table">
          <tr>
            <th>Bill To</th>
            <th>{{ $order->pickup_or_shipping === 'pickup' ? 'Pickup' : 'Ship To' }}</th>
          </tr>

          <tr>
            <td>
              <div class="addr-title">{{ $billingName ?? '-' }}</div>
              <?php if($billingPhone): ?>
                <div class="addr-line muted">Phone: {{ $billingPhone }}</div>
              <?php endif; ?>
              <?php if($billingEmail): ?>
                <div class="addr-line muted">Email: {{ $billingEmail }}</div>
              <?php endif; ?>
              <?php if($billingLine1): ?>
                <div class="addr-line">{{ $billingLine1 }}</div>
              <?php endif; ?>
              <?php if($billingLine2): ?>
                <div class="addr-line">{{ $billingLine2 }}</div>
              <?php endif; ?>
              <div class="addr-line">
                {{ trim(collect([$billingPostcode, $billingCity, $billingState])->filter()->implode(' ')) }}
              </div>
              <div class="addr-line">{{ $billingCountry ?? '-' }}</div>
            </td>

            <td>
              <?php if($order->pickup_or_shipping === 'pickup'): ?>
                <?php if($order->pickupStore): ?>
                  <div class="addr-title">{{ $order->pickupStore->name }}</div>
                  <?php if($order->pickupStore->address_line1): ?>
                    <div class="addr-line">{{ $order->pickupStore->address_line1 }}</div>
                  <?php endif; ?>
                  <?php if($order->pickupStore->address_line2): ?>
                    <div class="addr-line">{{ $order->pickupStore->address_line2 }}</div>
                  <?php endif; ?>
                  <div class="addr-line">
                    {{ trim(collect([$order->pickupStore->postcode, $order->pickupStore->city, $order->pickupStore->state])->filter()->implode(' ')) }}
                  </div>
                  <?php if($order->pickupStore->country): ?>
                    <div class="addr-line">{{ $order->pickupStore->country }}</div>
                  <?php endif; ?>
                <?php endif; ?>

                <div style="margin-top:8px;" class="muted small">
                  <strong style="color:#111827;">{{ $order->shipping_name ?: ($customerName ?? '-') }}</strong>
                </div>
                <?php if($order->shipping_phone || $customerPhone): ?>
                  <div class="muted small">Phone: {{ $order->shipping_phone ?: $customerPhone }}</div>
                <?php endif; ?>

              <?php else: ?>
                <div class="addr-title">{{ $order->shipping_name ?: ($customerName ?? '-') }}</div>
                <?php if($order->shipping_phone || $customerPhone): ?>
                  <div class="addr-line muted">Phone: {{ $order->shipping_phone ?: $customerPhone }}</div>
                <?php endif; ?>
                <?php if($order->shipping_address_line1): ?>
                  <div class="addr-line">{{ $order->shipping_address_line1 }}</div>
                <?php endif; ?>
                <?php if($order->shipping_address_line2): ?>
                  <div class="addr-line">{{ $order->shipping_address_line2 }}</div>
                <?php endif; ?>
                <div class="addr-line">
                  {{ trim(collect([$order->shipping_postcode, $order->shipping_city, $order->shipping_state])->filter()->implode(' ')) }}
                </div>
                <div class="addr-line">{{ $order->shipping_country ?? '-' }}</div>
              <?php endif; ?>
            </td>
          </tr>
        </table>
      <?php endif; ?>
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
          <?php foreach($items as $item): ?>
            <?php if(! $shouldShowReceiptItem($item)) { continue; } ?>
            @php
              $bookingProductOptionRows = collect($item['selected_booking_product_options'] ?? [])
                ->flatMap(fn ($question) => $question['options'] ?? [])
                ->values();
              $bookingProductOptionUnitTotal = (float) $bookingProductOptionRows->sum(fn ($option) => (float) ($option['extra_price'] ?? 0));
              $displayUnitPrice = $bookingProductOptionRows->isNotEmpty()
                ? max(0, (float) ($item['unit_price'] ?? 0) - $bookingProductOptionUnitTotal)
                : (float) ($item['unit_price'] ?? 0);
              $displayLineTotal = $bookingProductOptionRows->isNotEmpty()
                ? max(0, (float) ($item['line_total'] ?? 0) - ($bookingProductOptionUnitTotal * (int) ($item['quantity'] ?? 1)))
                : (float) ($item['line_total'] ?? 0);
            @endphp
            <tr>
              <td>
                <div class="item-name">{{ $item['product_name'] }}</div>
                <?php if(!empty($item['product_cn_name'])): ?>
                  <div class="sku" style="margin-top:1px;">{{ $item['product_cn_name'] }}</div>
                <?php endif; ?>

                @php
                  $sku = $item['variant_sku'] ?? $item['product_sku'];
                @endphp
                <?php if($sku): ?>
                  <div class="sku">SKU: {{ $sku }}</div>
                <?php endif; ?>
                <?php if($item['variant_name'] && !in_array($item['variant_name'], $hiddenReceiptVariantLabels, true)): ?>
                  <div class="sku">
                    Variant: {{ $item['variant_name'] }}
                    <?php if($item['variant_sku']): ?>
                      ({{ $item['variant_sku'] }})
                    <?php endif; ?>
                  </div>
                <?php endif; ?>
                <?php if(!empty($item['promotion_summary'])): ?>
                  <div class="sku">Promotion: {{ $item['promotion_summary'] }}</div>
                <?php endif; ?>
                <?php if(((float) ($item['discount_amount'] ?? 0)) > 0): ?>
                  <div class="sku" style="color:#92400e;margin-top:2px;">
                    Original: {{ $currency }} {{ number_format((float) ($item['line_total_snapshot'] ?? 0), 2) }}
                  </div>
                  <div class="sku" style="color:#92400e;">
                    Discount
                    <?php if(($item['discount_type'] ?? '') === 'percentage'): ?>
                      ({{ number_format((float) ($item['discount_value'] ?? 0), 2) }}%)
                    <?php elseif(($item['discount_type'] ?? '') === 'fixed'): ?>
                      ({{ $currency }} {{ number_format((float) ($item['discount_value'] ?? 0), 2) }})
                    <?php endif; ?>
                    : - {{ $currency }} {{ number_format((float) ($item['discount_amount'] ?? 0), 2) }}
                  </div>
                <?php endif; ?>
                <?php if(!empty($item['is_staff_free_applied'])): ?>
                  <div class="sku" style="color:#047857;margin-top:2px;font-weight:600;">
                    Staff free
                  </div>
                <?php endif; ?>
                <?php if(!empty($item['covered_by_package'])): ?>
                  <div class="sku" style="color:#065f46;margin-top:2px;font-weight:600;">Included in package</div>
                  <?php if(!empty($item['package_applied_name'])): ?>
                    <div class="sku" style="color:#065f46;">Package Applied: {{ $item['package_applied_name'] }}</div>
                  <?php endif; ?>
                <?php endif; ?>

                <!-- Optional: show price x qty in a friendly way -->
                <!-- <div class="price-line">
                  {{ $currency }} {{ number_format((float) $item['unit_price'], 2) }}
                  × {{ (int) $item['quantity'] }}
                </div> -->
              </td>

              <td class="numeric">{{ (int) $item['quantity'] }}</td>
              <td class="numeric">{{ $currency }} {{ number_format((float) $displayUnitPrice, 2) }}</td>
              <td class="numeric">
                <?php if(!empty($item['covered_by_package'])): ?>
                  <div style="font-size:11px;color:#9ca3af;text-decoration:line-through;">
                    {{ $currency }} {{ number_format((float) ($item['line_total_snapshot'] ?? $item['line_total'] ?? 0), 2) }}
                  </div>
                  <div style="color:#047857;font-weight:700;">{{ $currency }} 0.00</div>
                <?php else: ?>
                  <?php if(((float) ($item['discount_amount'] ?? 0)) > 0): ?>
                    <div style="font-size:11px;color:#9ca3af;text-decoration:line-through;">
                      {{ $currency }} {{ number_format((float) ($item['line_total_snapshot'] ?? 0), 2) }}
                    </div>
                  <?php endif; ?>
                  <div>{{ $currency }} {{ number_format((float) $displayLineTotal, 2) }}</div>
                <?php endif; ?>
              </td>
            </tr>
            @foreach($bookingProductOptionRows as $option)
              <tr style="background:#f9fafb;">
                <td style="padding-left:18px;">
                  <div class="item-name" style="font-weight:500;">{{ $option['label'] ?? '-' }}</div>
                  <?php if(!empty($option['cn_label'])): ?>
                    <div class="sku" style="margin-top:1px;">{{ $option['cn_label'] }}</div>
                  <?php endif; ?>
                </td>
                <td class="numeric">{{ (int) ($item['quantity'] ?? 1) }}</td>
                <td class="numeric">{{ $currency }} {{ number_format((float) ($option['extra_price'] ?? 0), 2) }}</td>
                <td class="numeric">{{ $currency }} {{ number_format((float) ($option['extra_price'] ?? 0) * (int) ($item['quantity'] ?? 1), 2) }}</td>
              </tr>
            @endforeach
          <?php endforeach; ?>
        </tbody>
      </table>
    </div>


    <!-- Totals -->
    <div class="section totals-wrap">
      <table class="totals-table">
        <tr>
          <td>Subtotal</td>
          <td>{{ $currency }} {{ number_format($subtotalDisplay, 2) }}</td>
        </tr>
        <tr>
          <td>Voucher Discount</td>
          <td>{{ $currency }} {{ number_format($discountDisplay, 2) }}</td>
        </tr>
        <tr>
          <td>Shipping</td>
          <td>{{ $currency }} {{ number_format($shippingDisplay, 2) }}</td>
        </tr>
        <?php if($coveredByPackage && $packageOffsetDisplay > 0): ?>
          <tr>
            <td>Package Offset</td>
            <td>- {{ $currency }} {{ number_format($packageOffsetDisplay, 2) }}</td>
          </tr>
        <?php endif; ?>
        <tr class="grand">
          <td>Grand Total</td>
          <td>{{ $currency }} {{ number_format($grandTotalDisplay, 2) }}</td>
        </tr>
      </table>
    </div>

    <!-- Footer -->
    <div class="footer">
      <div class="thanks">Thank you for shopping with {{ $profile['company_name'] ?? 'us' }}.</div>

      <?php if($supportEmail): ?>
        <div class="line">Support Email: {{ $supportEmail }}</div>
      <?php endif; ?>
      <?php if($supportPhone): ?>
        <div class="line">Support Phone: {{ $supportPhone }}</div>
      <?php endif; ?>
      <?php if($companyWebsite): ?>
        <div class="line">Website: {{ $companyWebsite }}</div>
      <?php endif; ?>

      <?php if($footerNote): ?>
        <div class="line" style="margin-top:6px;">{{ $footerNote }}</div>
      <?php else: ?>
        <div class="line" style="margin-top:6px;">This document is generated electronically and is valid without signature.</div>
      <?php endif; ?>
    </div>

  </div>
</body>
</html>
