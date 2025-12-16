<?php

namespace App\Http\Controllers\Ecommerce;

use App\Http\Controllers\Controller;
use App\Models\Ecommerce\Customer;
use App\Services\Loyalty\PointsService;
use Illuminate\Http\Request;

class LoyaltyAdminController extends Controller
{
    public function summary(Customer $customer, PointsService $pointsService)
    {
        return $this->respond([
            'customer' => [
                'id' => $customer->id,
                'name' => $customer->name,
                'email' => $customer->email,
                'tier' => $customer->tier,
            ],
            'summary' => $pointsService->getSummaryForCustomer($customer),
        ]);
    }

    public function history(Customer $customer, Request $request, PointsService $pointsService)
    {
        $filters = [
            'type' => $request->string('type')->toString() ?: null,
            'per_page' => $request->integer('per_page', 15),
        ];

        return $this->respond(
            $pointsService->getHistoryForCustomer($customer, array_filter($filters))
        );
    }
}
