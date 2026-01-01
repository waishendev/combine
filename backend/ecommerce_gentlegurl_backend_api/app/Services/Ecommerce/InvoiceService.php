<?php

namespace App\Services\Ecommerce;

use App\Models\Ecommerce\Order;

class InvoiceService
{
    public function buildPdf(Order $order)
    {
        $order->loadMissing(['items', 'pickupStore']);

        return app('dompdf.wrapper')->loadView('invoices.order', [
            'order' => $order,
        ]);
    }
}
