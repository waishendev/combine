<?php

namespace App\Http\Controllers;

use App\Models\Booking\CustomerServicePackage;
use App\Models\Booking\CustomerServicePackageBalance;
use App\Models\Booking\CustomerServicePackageUsage;

class CustomerServicePackageController extends Controller
{
    public function index(int $customerId)
    {
        $rows = CustomerServicePackage::query()
            ->with(['servicePackage', 'balances.bookingService'])
            ->where('customer_id', $customerId)
            ->orderByDesc('id')
            ->get();

        return $this->respond($rows);
    }

    public function balances(int $customerId)
    {
        $rows = CustomerServicePackageBalance::query()
            ->with(['bookingService:id,name', 'customerServicePackage.servicePackage'])
            ->whereHas('customerServicePackage', fn ($q) => $q->where('customer_id', $customerId))
            ->orderByDesc('id')
            ->get();

        return $this->respond($rows);
    }

    public function usages(int $customerId)
    {
        $rows = CustomerServicePackageUsage::query()
            ->with(['bookingService:id,name', 'customerServicePackage.servicePackage'])
            ->where('customer_id', $customerId)
            ->orderByDesc('id')
            ->get();

        return $this->respond($rows);
    }

    public function availableFor(int $customerId, int $serviceId)
    {
        $rows = CustomerServicePackageBalance::query()
            ->with(['customerServicePackage.servicePackage'])
            ->where('booking_service_id', $serviceId)
            ->where('remaining_qty', '>', 0)
            ->whereHas('customerServicePackage', function ($q) use ($customerId) {
                $q->where('customer_id', $customerId)
                    ->where('status', 'active')
                    ->where(function ($nested) {
                        $nested->whereNull('expires_at')->orWhere('expires_at', '>=', now());
                    });
            })
            ->orderByDesc('id')
            ->get();

        return $this->respond($rows);
    }
}
