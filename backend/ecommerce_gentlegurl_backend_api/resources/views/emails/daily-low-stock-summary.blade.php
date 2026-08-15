<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Inventory alert</title>
</head>
<body style="margin:0; padding:0; background-color:#ffffff; font-family:Arial, Helvetica, sans-serif; color:#222222;">
    <div style="max-width:680px; margin:0 auto; padding:24px 16px;">
        <p style="margin:0 0 4px; font-size:13px; color:#666666;">Gentlegurls system alert</p>
        <h1 style="margin:0 0 8px; font-size:20px; font-weight:700; color:#111111;">Inventory alert: low stock</h1>
        <p style="margin:0 0 20px; font-size:14px; color:#444444;">
            Date: {{ $date }} · {{ $totalCount }} item(s) need attention
            ({{ $outOfStockCount }} out of stock, {{ $lowStockCount }} low).
        </p>

        <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse; border-top:1px solid #dddddd;">
            <thead>
                <tr>
                    <th align="left" style="padding:10px 8px; font-size:12px; color:#666666; border-bottom:1px solid #dddddd;">SKU</th>
                    <th align="left" style="padding:10px 8px; font-size:12px; color:#666666; border-bottom:1px solid #dddddd;">Product</th>
                    <th align="right" style="padding:10px 8px; font-size:12px; color:#666666; border-bottom:1px solid #dddddd;">Stock</th>
                    <th align="right" style="padding:10px 8px; font-size:12px; color:#666666; border-bottom:1px solid #dddddd;">Threshold</th>
                    <th align="left" style="padding:10px 8px; font-size:12px; color:#666666; border-bottom:1px solid #dddddd;">Status</th>
                </tr>
            </thead>
            <tbody>
                @foreach ($products as $product)
                    @php
                        $stock = (int) ($product['stock'] ?? 0);
                        $threshold = (int) ($product['threshold'] ?? 0);
                        $isOut = $stock <= 0;
                        $name = trim((string) ($product['name'] ?? ''));
                        $cnName = trim((string) ($product['cn_name'] ?? ''));
                        $variantName = trim((string) ($product['variant_name'] ?? ''));
                        $variantCnName = trim((string) ($product['variant_cn_name'] ?? ''));
                        $sku = trim((string) ($product['sku'] ?? ''));
                        $branchName = trim((string) ($product['branch_name'] ?? ''));
                    @endphp
                    <tr>
                        <td style="padding:10px 8px; font-size:13px; vertical-align:top; border-bottom:1px solid #eeeeee; white-space:nowrap;">
                            {{ $sku !== '' ? $sku : '—' }}
                        </td>
                        <td style="padding:10px 8px; font-size:13px; vertical-align:top; border-bottom:1px solid #eeeeee;">
                            <div>{{ $name !== '' ? $name : '—' }}</div>
                            @if ($branchName !== '')
                                <div style="margin-top:2px; font-size:12px; font-weight:600; color:#475569;">Branch: {{ $branchName }}</div>
                            @endif
                            @if ($cnName !== '')
                                <div style="margin-top:2px; font-size:12px; color:#666666;">{{ $cnName }}</div>
                            @endif
                            @if ($variantName !== '' || $variantCnName !== '')
                                <div style="margin-top:2px; font-size:12px; color:#666666;">
                                    Variant:
                                    {{ $variantName }}
                                    @if ($variantName !== '' && $variantCnName !== '') / @endif
                                    {{ $variantCnName }}
                                </div>
                            @endif
                        </td>
                        <td align="right" style="padding:10px 8px; font-size:13px; font-weight:700; vertical-align:top; border-bottom:1px solid #eeeeee;">
                            {{ $stock }}
                        </td>
                        <td align="right" style="padding:10px 8px; font-size:13px; color:#666666; vertical-align:top; border-bottom:1px solid #eeeeee;">
                            {{ $threshold }}
                        </td>
                        <td style="padding:10px 8px; font-size:12px; vertical-align:top; border-bottom:1px solid #eeeeee;">
                            {{ $isOut ? 'Out of stock' : 'Low stock' }}
                        </td>
                    </tr>
                @endforeach
            </tbody>
        </table>

        <p style="margin:20px 0 0; font-size:12px; color:#888888;">
            This is an automated inventory alert from Gentlegurls. Please do not reply.
        </p>
    </div>
</body>
</html>
