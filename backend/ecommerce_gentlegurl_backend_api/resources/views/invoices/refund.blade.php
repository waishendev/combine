<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>Refund Receipt {{ $refund->refund_no }}</title>

  @php
    $cjkFontPath = collect([
      public_path('fonts/NotoSansCJKkr-Regular.otf'),
      storage_path('fonts/NotoSansCJKkr-Regular.otf'),
    ])->first(fn ($path) => file_exists($path));

    $fontConfigs = [];
    if ($cjkFontPath) {
      $fontConfigs[] = ['name' => 'Noto Sans CJK', 'paths' => [$cjkFontPath]];
    } else {
      $fontConfigs[] = ['name' => 'Noto Sans KR', 'paths' => [public_path('fonts/NotoSansKR-Regular.otf'), storage_path('fonts/NotoSansKR-Regular.otf')]];
      $fontConfigs[] = ['name' => 'Noto Sans SC', 'paths' => [public_path('fonts/NotoSansSC-Regular.otf'), storage_path('fonts/NotoSansSC-Regular.otf')]];
    }
    $fontConfigs[] = ['name' => 'Malgun Gothic', 'paths' => [public_path('fonts/malgun.ttf'), storage_path('fonts/malgun.ttf')]];

    $resolvedFonts = collect($fontConfigs)->map(function ($config) {
      $fontPath = collect($config['paths'])->first(fn ($path) => file_exists($path));
      if ($fontPath) {
        $fontPathFormatted = str_replace('\\', '/', $fontPath);
        $fontUrl = 'file:///' . $fontPathFormatted;
        $fontFormat = str_ends_with($fontPath, '.ttf') ? 'truetype' : 'opentype';
        return ['name' => $config['name'], 'url' => $fontUrl, 'format' => $fontFormat];
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
    table{ border-collapse:collapse; width:100%; }

    .header-table td{ vertical-align:top; }
    .company-name{ font-size:16px; font-weight:700; margin-bottom:2px; color:#111827; }
    .company-meta div{ margin-top:2px; }
    .company-logo{ max-width:140px; height:34px; object-fit:contain; display:block; }

    .doc-title{ font-size:26px; font-weight:800; text-align:right; letter-spacing:0.06em; color:#b91c1c; }

    .meta-table{ width:100%; margin-top:10px; }
    .meta-table td{ padding:2px 0; font-size:11px; }
    .meta-table td:first-child{ color:#6b7280; padding-right:12px; white-space:nowrap; width:120px; }
    .meta-table td:last-child{ text-align:right; white-space:nowrap; font-weight:600; color:#111827; }

    .info-table th{ text-align:left; font-size:11px; padding:10px 0 6px 0; border-top:1px solid #e5e7eb; text-transform:uppercase; letter-spacing:0.10em; color:#374151; }
    .info-table td{ padding-top:6px; padding-right:18px; vertical-align:top; width:100%; }
    .addr-title{ font-weight:700; margin-bottom:3px; }
    .addr-line{ margin-top:1px; }

    .items-table th, .items-table td{ border-bottom:1px solid #e5e7eb; padding:10px 6px; vertical-align:top; }
    .items-table th{ background:#f9fafb; font-size:10px; text-transform:uppercase; letter-spacing:0.10em; color:#374151; }
    .items-table td:first-child{ width:70%; }
    .numeric{ text-align:right; white-space:nowrap; }
    .item-name{ font-weight:700; color:#111827; margin-bottom:2px; }
    .sku{ font-size:10px; color:#6b7280; }

    .totals-wrap{ width:100%; }
    .totals-table{ width:320px; margin-left:auto; border:1px solid #e5e7eb; }
    .totals-table td{ padding:6px 10px; font-size:11px; }
    .totals-table td:first-child{ color:#6b7280; }
    .totals-table td:last-child{ text-align:right; font-weight:600; color:#111827; }
    .grand td{ padding:10px 10px; font-size:13px; font-weight:800; color:#b91c1c; border-bottom:none; background:#fff1f2; }
    .grand td:first-child{ text-transform:uppercase; letter-spacing:0.08em; color:#991b1b; }

    .footer{ margin-top:22px; padding-top:12px; border-top:1px solid #e5e7eb; font-size:10px; color:#6b7280; }
    .footer .thanks{ font-weight:700; color:#374151; margin-bottom:4px; }
    .footer .line{ margin-top:2px; }
  </style>
</head>

<body>
@php
  $profile = $invoiceProfile ?? [];
  $currency = $profile['currency'] ?? 'MYR';
  $amount = (float) $refund->amount;
  $processedAt = $refund->processed_at ?? $refund->created_at;
  $supportEmail = $profile['company_email'] ?? null;
  $supportPhone = $profile['company_phone'] ?? null;
  $companyWebsite = $profile['company_website'] ?? null;
  $footerNote = $profile['footer_note'] ?? null;
@endphp

  <div class="page">

    <!-- Header -->
    <div class="section">
      <table class="header-table">
        <tr>
          <td style="width:60%;">
            <?php if(!empty($profile['company_logo_url'])): ?>
              <img class="company-logo" src="{{ $profile['company_logo_url'] }}" alt="Company Logo" style="margin-bottom:6px;" />
            <?php endif; ?>
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
            </div>
            <?php if(!empty($profile['company_address'])): ?>
              <div class="muted" style="margin-top:8px;">{!! nl2br(e($profile['company_address'])) !!}</div>
            <?php endif; ?>
          </td>

          <td style="width:40%; text-align:right;">
            <div class="doc-title">REFUND RECEIPT</div>
            <table class="meta-table">
              <tr>
                <td>Refund No</td>
                <td>{{ $refund->refund_no }}</td>
              </tr>
              <tr>
                <td>Date</td>
                <td>{{ optional($processedAt)->format('Y-m-d H:i') ?? '-' }}</td>
              </tr>
              <tr>
                <td>Refund Method</td>
                <td>{{ $methodLabel }}</td>
              </tr>
              <tr>
                <td>Channel</td>
                <td>{{ ucfirst((string) $refund->channel) }}</td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </div>

    <!-- Refund To -->
    <div class="section">
      <table class="info-table">
        <tr>
          <th>Refund To</th>
        </tr>
        <tr>
          <td style="width:100%;">
            <div class="addr-title">{{ $customerName }}</div>
            <?php if(!empty($customerPhone)): ?>
              <div class="addr-line muted">Phone: {{ $customerPhone }}</div>
            <?php endif; ?>
            <?php if(!empty($customerEmail)): ?>
              <div class="addr-line muted">Email: {{ $customerEmail }}</div>
            <?php endif; ?>
          </td>
        </tr>
      </table>
    </div>

    <!-- Items -->
    <div class="section">
      <table class="items-table">
        <thead>
          <tr>
            <th>Description</th>
            <th class="numeric">Amount</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>
              <div class="item-name">Overpaid deposit refund</div>
              <div class="sku">{{ $methodLabel }}</div>
              <?php if($refund->remark): ?>
                <div class="sku" style="margin-top:2px;">{{ $refund->remark }}</div>
              <?php endif; ?>
            </td>
            <td class="numeric" style="color:#b91c1c;font-weight:700;">- {{ $currency }} {{ number_format($amount, 2) }}</td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Totals -->
    <div class="section totals-wrap">
      <table class="totals-table">
        <tr>
          <td>Refund Subtotal</td>
          <td style="color:#b91c1c;">- {{ $currency }} {{ number_format($amount, 2) }}</td>
        </tr>
        <tr class="grand">
          <td>Total Refund</td>
          <td>- {{ $currency }} {{ number_format($amount, 2) }}</td>
        </tr>
      </table>
    </div>

    <!-- Footer -->
    <div class="footer">
      <div class="thanks">Refund processed by {{ $profile['company_name'] ?? 'us' }}.</div>
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
