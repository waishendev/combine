<?php

namespace App\Services\Ecommerce;

use App\Models\Booking\CustomerServicePackage;
use App\Models\Ecommerce\Order;
use App\Services\SettingService;

class InvoiceService
{
    public function buildPdf(Order $order)
    {
        $order->loadMissing(['items', 'serviceItems', 'pickupStore']);

        $invoiceProfile = SettingService::get('ecommerce.invoice_profile', $this->defaultInvoiceProfile());
        $productItems = $order->items->map(function ($item) {
            return [
                'product_name' => $item->product_name_snapshot,
                'product_sku' => $item->sku_snapshot,
                'variant_name' => $item->variant_name_snapshot,
                'variant_sku' => $item->variant_sku_snapshot,
                'quantity' => (int) $item->quantity,
                'unit_price' => (float) ($item->effective_unit_price ?? $item->unit_price_snapshot ?? $item->price_snapshot),
                'line_total' => (float) ($item->effective_line_total ?? $item->line_total_snapshot ?? $item->line_total),
                'promotion_summary' => data_get($item->promotion_snapshot, 'summary'),
            ];
        })->values();

        $serviceItems = $order->serviceItems
            ->where('item_type', 'service')
            ->map(fn ($item) => [
                'product_name' => $item->service_name_snapshot,
                'product_sku' => null,
                'variant_name' => 'Service',
                'variant_sku' => null,
                'quantity' => (int) $item->qty,
                'unit_price' => (float) $item->price_snapshot,
                'line_total' => (float) $item->line_total,
                'promotion_summary' => null,
            ])
            ->values();

        $packageItems = CustomerServicePackage::query()
            ->with('servicePackage:id,name,selling_price')
            ->where('purchased_from', 'POS')
            ->where('purchased_ref_id', (int) $order->id)
            ->get()
            ->groupBy('service_package_id')
            ->map(function ($rows) {
                $first = $rows->first();

                return [
                    'product_name' => (string) ($first?->servicePackage?->name ?? 'Service Package'),
                    'product_sku' => null,
                    'variant_name' => 'Service Package',
                    'variant_sku' => null,
                    'quantity' => (int) $rows->count(),
                    'unit_price' => (float) ($first?->servicePackage?->selling_price ?? 0),
                    'line_total' => round((float) $rows->count() * (float) ($first?->servicePackage?->selling_price ?? 0), 2),
                    'promotion_summary' => null,
                ];
            })
            ->values();

        $items = $productItems->concat($serviceItems)->concat($packageItems)->values();

        return app('snappy.pdf.wrapper')->loadView('invoices.order', [
            'order' => $order,
            'items' => $items,
            'invoiceProfile' => $invoiceProfile,
        ]);
    }

    protected function defaultInvoiceProfile(): array
    {
        return [
            'company_logo_url' => null,
            'company_name' => 'Gentlegurl Shop',
            'company_reg_no' => null,
            'company_address' => "123 Gentle Lane\nKuala Lumpur\nMalaysia",
            'company_phone' => null,
            'company_email' => null,
            'company_website' => null,
            'footer_note' => 'This is a computer-generated invoice.',
            'currency' => 'MYR',
        ];
    }
}
