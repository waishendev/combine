<?php

namespace App\Http\Controllers\Ecommerce;

use Illuminate\Http\Request;

class CrmEcommerceOrderController
{
    public function __construct(
        private readonly OrderController $orderController,
        private readonly ReturnRequestController $returnRequestController,
    ) {
    }

    public function new(Request $request)
    {
        $query = $request->query();

        if (!isset($query['status'])) {
            $query['status'] = ['pending', 'processing', 'reject_payment_proof', 'ready_for_pickup', 'shipped', 'confirmed'];
        }

        if (!isset($query['payment_status'])) {
            $query['payment_status'] = ['unpaid', 'paid'];
        }

        $forwardRequest = $request->duplicate($query);

        return $this->orderController->index($forwardRequest);
    }

    public function completed(Request $request)
    {
        $query = $request->query();

        if (!isset($query['status'])) {
            $query['status'] = ['completed', 'cancelled'];
        }

        $forwardRequest = $request->duplicate($query);

        return $this->orderController->index($forwardRequest);
    }

    public function all(Request $request)
    {
        return $this->orderController->index($request);
    }

    public function returns(Request $request)
    {
        return $this->returnRequestController->index($request);
    }
}
