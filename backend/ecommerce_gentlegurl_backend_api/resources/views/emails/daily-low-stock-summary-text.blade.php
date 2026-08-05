Gentlegurls system alert
Inventory alert: low stock
Date: {{ $date }}

{{ $totalCount }} item(s) need attention ({{ $outOfStockCount }} out of stock, {{ $lowStockCount }} low).

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
@endphp
- [{{ $isOut ? 'OUT' : 'LOW' }}] {{ $sku !== '' ? $sku : '-' }} | {{ $name !== '' ? $name : '-' }}@if($cnName !== '') / {{ $cnName }}@endif @if($variantName !== '' || $variantCnName !== '') | Variant: {{ $variantName }}@if($variantName !== '' && $variantCnName !== '') / @endif{{ $variantCnName }}@endif | Stock {{ $stock }} / Threshold {{ $threshold }}

@endforeach
This is an automated inventory alert from Gentlegurls. Please do not reply.
