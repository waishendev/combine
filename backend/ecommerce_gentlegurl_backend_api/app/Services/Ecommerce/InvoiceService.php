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

        $pdf = app('dompdf.wrapper');
        $options = $pdf->getDomPDF()->getOptions();
        $options->set('isFontSubsettingEnabled', true);
        $options->set('isRemoteEnabled', true);
        $pdf->getDomPDF()->setOptions($options);

        return $pdf->loadView('invoices.order', [
            'order' => $order,
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
