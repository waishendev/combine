<?php

namespace App\Services\Ecommerce;

use App\Models\Ecommerce\Order;
use App\Services\SettingService;

class InvoiceService
{
    public function buildPdf(Order $order)
    {
        $order->loadMissing(['items', 'pickupStore']);

        $invoiceProfile = SettingService::get('ecommerce.invoice_profile', $this->defaultInvoiceProfile());
        $items = $order->items->map(function ($item) {
            return [
                'product_name' => $item->product_name_snapshot,
                'product_sku' => $item->sku_snapshot,
                'variant_name' => $item->variant_name_snapshot,
                'variant_sku' => $item->variant_sku_snapshot,
                'quantity' => (int) $item->quantity,
                'unit_price' => (float) $item->price_snapshot,
                'line_total' => (float) $item->line_total,
            ];
        })->values();

        return app('dompdf.wrapper')->loadView('invoices.order', [
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
