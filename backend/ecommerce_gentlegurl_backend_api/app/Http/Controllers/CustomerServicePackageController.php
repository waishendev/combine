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
            ->with(['bookingService:id,name', 'customerServicePackage.servicePackage', 'booking:id,booking_code,status,start_at'])
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
            ->get()
            ->map(function ($row) use ($serviceId) {
                $reservedQty = (int) CustomerServicePackageUsage::query()
                    ->where('customer_service_package_id', $row->customer_service_package_id)
                    ->where('booking_service_id', $serviceId)
                    ->where('status', 'reserved')
                    ->sum('used_qty');

                $availableQty = max(0, (int) $row->remaining_qty - $reservedQty);
                $row->reserved_qty = $reservedQty;
                $row->available_qty = $availableQty;
                $row->remaining_qty = $availableQty;

                return $row;
            })
            ->filter(fn ($row) => (int) ($row->available_qty ?? 0) > 0)
            ->values();

        return $this->respond($rows);
    }
}
