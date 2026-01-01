<?php

namespace App\Services\Ecommerce;

use App\Models\Ecommerce\Order;
use Barryvdh\DomPDF\Facade\Pdf;

class InvoiceService
{
    public function buildPdf(Order $order)
    {
        $order->loadMissing(['items', 'pickupStore']);

        return Pdf::loadView('ecommerce.invoice', [
            'order' => $order,
        ]);
    }
}
