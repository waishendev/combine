<?php

namespace App\Services\Booking;

use App\Models\Booking\CustomerServicePackage;
use App\Models\Booking\CustomerServicePackageBalance;
use App\Models\Booking\CustomerServicePackageUsage;
use App\Models\Booking\ServicePackage;
use Illuminate\Support\Facades\DB;

class CustomerServicePackageService
{
    public function purchase(int $customerId, ServicePackage $package, string $source = 'ADMIN', ?int $sourceRefId = null): CustomerServicePackage
    {
        return DB::transaction(function () use ($customerId, $package, $source, $sourceRefId) {
            $startedAt = now();
            $expiresAt = $package->valid_days ? $startedAt->copy()->addDays((int) $package->valid_days) : null;

            $customerPackage = CustomerServicePackage::create([
                'customer_id' => $customerId,
                'service_package_id' => $package->id,
                'purchased_from' => strtoupper($source),
                'purchased_ref_id' => $sourceRefId,
                'started_at' => $startedAt,
                'expires_at' => $expiresAt,
                'status' => 'active',
            ]);

            $package->loadMissing('items');
            foreach ($package->items as $item) {
                CustomerServicePackageBalance::create([
                    'customer_service_package_id' => $customerPackage->id,
                    'booking_service_id' => $item->booking_service_id,
                    'total_qty' => (int) $item->quantity,
                    'used_qty' => 0,
                    'remaining_qty' => (int) $item->quantity,
                ]);
            }

            return $customerPackage->load(['servicePackage', 'balances.bookingService']);
        });
    }

    public function redeem(int $customerId, int $bookingServiceId, string $source = 'ADMIN', ?int $sourceRefId = null, int $usedQty = 1, ?string $notes = null): CustomerServicePackageUsage
    {
        return DB::transaction(function () use ($customerId, $bookingServiceId, $source, $sourceRefId, $usedQty, $notes) {
            $usedQty = max(1, $usedQty);

            $balance = CustomerServicePackageBalance::query()
                ->select('customer_service_package_balances.*')
                ->join('customer_service_packages', 'customer_service_packages.id', '=', 'customer_service_package_balances.customer_service_package_id')
                ->where('customer_service_packages.customer_id', $customerId)
                ->where('customer_service_package_balances.booking_service_id', $bookingServiceId)
                ->where('customer_service_packages.status', 'active')
                ->where(function ($query) {
                    $query->whereNull('customer_service_packages.expires_at')
                        ->orWhere('customer_service_packages.expires_at', '>=', now());
                })
                ->where('customer_service_package_balances.remaining_qty', '>=', $usedQty)
                ->orderBy('customer_service_packages.created_at')
                ->lockForUpdate()
                ->firstOrFail();

            $balance->used_qty = (int) $balance->used_qty + $usedQty;
            $balance->remaining_qty = max(0, (int) $balance->remaining_qty - $usedQty);
            $balance->save();

            $usage = CustomerServicePackageUsage::create([
                'customer_service_package_id' => $balance->customer_service_package_id,
                'customer_id' => $customerId,
                'booking_service_id' => $bookingServiceId,
                'used_qty' => $usedQty,
                'used_from' => strtoupper($source),
                'used_ref_id' => $sourceRefId,
                'notes' => $notes,
            ]);

            $package = CustomerServicePackage::query()->with('balances')->find($balance->customer_service_package_id);
            if ($package) {
                $remaining = $package->balances->sum('remaining_qty');
                if ((int) $remaining <= 0) {
                    $package->status = 'exhausted';
                    $package->save();
                }
            }

            return $usage->load(['customerServicePackage', 'bookingService']);
        });
    }
}
