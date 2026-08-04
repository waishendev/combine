<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Daily Low Stock Summary</title>
</head>
<body style="margin:0; padding:0; background-color:#f3f4f6; font-family:Arial, Helvetica, sans-serif; color:#111827;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f3f4f6; padding:24px 12px;">
        <tr>
            <td align="center">
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:720px; background-color:#ffffff; border-radius:10px; overflow:hidden; border:1px solid #e5e7eb;">
                    <tr>
                        <td style="background-color:#111827; padding:22px 24px;">
                            <h1 style="margin:0; font-size:22px; line-height:1.3; color:#ffffff;">Daily Low Stock Summary</h1>
                            <p style="margin:8px 0 0; font-size:14px; color:#d1d5db;">{{ $date }}</p>
                        </td>
                    </tr>

                    <tr>
                        <td style="padding:20px 24px 8px;">
                            <p style="margin:0 0 16px; font-size:14px; color:#374151;">
                                The following products are at or below their low-stock threshold. Please restock soon.
                            </p>

                            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:18px;">
                                <tr>
                                    <td width="33%" style="padding:0 6px 0 0;">
                                        <div style="background:#f9fafb; border:1px solid #e5e7eb; border-radius:8px; padding:12px;">
                                            <p style="margin:0; font-size:11px; color:#6b7280; text-transform:uppercase; letter-spacing:0.04em;">Total items</p>
                                            <p style="margin:4px 0 0; font-size:22px; font-weight:700; color:#111827;">{{ $totalCount }}</p>
                                        </div>
                                    </td>
                                    <td width="33%" style="padding:0 3px;">
                                        <div style="background:#fef2f2; border:1px solid #fecaca; border-radius:8px; padding:12px;">
                                            <p style="margin:0; font-size:11px; color:#b91c1c; text-transform:uppercase; letter-spacing:0.04em;">Out of stock</p>
                                            <p style="margin:4px 0 0; font-size:22px; font-weight:700; color:#991b1b;">{{ $outOfStockCount }}</p>
                                        </div>
                                    </td>
                                    <td width="33%" style="padding:0 0 0 6px;">
                                        <div style="background:#fffbeb; border:1px solid #fde68a; border-radius:8px; padding:12px;">
                                            <p style="margin:0; font-size:11px; color:#b45309; text-transform:uppercase; letter-spacing:0.04em;">Low stock</p>
                                            <p style="margin:4px 0 0; font-size:22px; font-weight:700; color:#92400e;">{{ $lowStockCount }}</p>
                                        </div>
                                    </td>
                                </tr>
                            </table>
                        </td>
                    </tr>

                    <tr>
                        <td style="padding:0 24px 24px;">
                            <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse; border:1px solid #e5e7eb; border-radius:8px;">
                                <thead>
                                    <tr style="background-color:#f9fafb;">
                                        <th align="left" style="padding:10px 12px; font-size:11px; color:#6b7280; text-transform:uppercase; letter-spacing:0.04em; border-bottom:1px solid #e5e7eb;">SKU</th>
                                        <th align="left" style="padding:10px 12px; font-size:11px; color:#6b7280; text-transform:uppercase; letter-spacing:0.04em; border-bottom:1px solid #e5e7eb;">Product</th>
                                        <th align="right" style="padding:10px 12px; font-size:11px; color:#6b7280; text-transform:uppercase; letter-spacing:0.04em; border-bottom:1px solid #e5e7eb;">Stock</th>
                                        <th align="right" style="padding:10px 12px; font-size:11px; color:#6b7280; text-transform:uppercase; letter-spacing:0.04em; border-bottom:1px solid #e5e7eb;">Threshold</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    @foreach ($products as $index => $product)
                                        @php
                                            $stock = (int) ($product['stock'] ?? 0);
                                            $threshold = (int) ($product['threshold'] ?? 0);
                                            $isOut = $stock <= 0;
                                            $rowBg = $index % 2 === 0 ? '#ffffff' : '#fafafa';
                                            $stockColor = $isOut ? '#991b1b' : '#b45309';
                                            $badgeBg = $isOut ? '#fee2e2' : '#fef3c7';
                                            $badgeColor = $isOut ? '#991b1b' : '#92400e';
                                            $badgeLabel = $isOut ? 'OUT' : 'LOW';
                                            $name = trim((string) ($product['name'] ?? ''));
                                            $cnName = trim((string) ($product['cn_name'] ?? ''));
                                            $variantName = trim((string) ($product['variant_name'] ?? ''));
                                            $variantCnName = trim((string) ($product['variant_cn_name'] ?? ''));
                                            $sku = trim((string) ($product['sku'] ?? ''));
                                        @endphp
                                        <tr style="background-color:{{ $rowBg }};">
                                            <td style="padding:12px; font-size:13px; color:#374151; border-bottom:1px solid #f3f4f6; vertical-align:top; white-space:nowrap;">
                                                {{ $sku !== '' ? $sku : '—' }}
                                            </td>
                                            <td style="padding:12px; font-size:13px; color:#111827; border-bottom:1px solid #f3f4f6; vertical-align:top;">
                                                <div style="font-weight:600;">{{ $name !== '' ? $name : '—' }}</div>
                                                @if ($cnName !== '')
                                                    <div style="margin-top:2px; font-size:12px; color:#6b7280;">{{ $cnName }}</div>
                                                @endif
                                                @if ($variantName !== '' || $variantCnName !== '')
                                                    <div style="margin-top:4px; font-size:12px; color:#4b5563;">
                                                        Variant:
                                                        {{ $variantName !== '' ? $variantName : '' }}
                                                        @if ($variantName !== '' && $variantCnName !== '')
                                                            ·
                                                        @endif
                                                        {{ $variantCnName }}
                                                    </div>
                                                @endif
                                                <div style="margin-top:6px;">
                                                    <span style="display:inline-block; padding:2px 8px; border-radius:999px; background:{{ $badgeBg }}; color:{{ $badgeColor }}; font-size:11px; font-weight:700;">{{ $badgeLabel }}</span>
                                                </div>
                                            </td>
                                            <td align="right" style="padding:12px; font-size:16px; font-weight:700; color:{{ $stockColor }}; border-bottom:1px solid #f3f4f6; vertical-align:top;">
                                                {{ $stock }}
                                            </td>
                                            <td align="right" style="padding:12px; font-size:13px; color:#6b7280; border-bottom:1px solid #f3f4f6; vertical-align:top;">
                                                {{ $threshold }}
                                            </td>
                                        </tr>
                                    @endforeach
                                </tbody>
                            </table>
                        </td>
                    </tr>

                    <tr>
                        <td style="padding:0 24px 24px;">
                            <p style="margin:0; font-size:12px; color:#9ca3af; text-align:center;">
                                Automated inventory alert from Gentlegurls. Please do not reply to this email.
                            </p>
                        </td>
                    </tr>
                </table>
            </td>
        </tr>
    </table>
</body>
</html>
