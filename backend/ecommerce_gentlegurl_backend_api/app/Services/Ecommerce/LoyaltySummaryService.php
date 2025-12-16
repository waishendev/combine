<?php

namespace App\Services\Ecommerce;

use App\Models\Ecommerce\Customer;
use App\Services\Loyalty\PointsService;

class LoyaltySummaryService
{
    public function __construct(protected PointsService $pointsService)
    {
    }

    public function getSummaryFor(Customer $customer): array
    {
        return $this->pointsService->getSummaryForCustomer($customer);
    }
}
