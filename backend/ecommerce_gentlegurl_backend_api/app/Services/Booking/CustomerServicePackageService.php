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
        $source = strtoupper($source);

        if (in_array($source, ['BOOKING', 'POS'], true)) {
            return $this->reserve($customerId, $bookingServiceId, $source, $sourceRefId, $usedQty, $notes);
        }

        return $this->consumeNow($customerId, $bookingServiceId, $source, $sourceRefId, $usedQty, $notes);
    }

    public function reserve(int $customerId, int $bookingServiceId, string $source = 'BOOKING', ?int $sourceRefId = null, int $usedQty = 1, ?string $notes = null): CustomerServicePackageUsage
    {
        return DB::transaction(function () use ($customerId, $bookingServiceId, $source, $sourceRefId, $usedQty, $notes) {
            $usedQty = max(1, $usedQty);

            $balance = $this->findBalanceWithAvailability($customerId, $bookingServiceId, $usedQty);

            return CustomerServicePackageUsage::create([
                'customer_service_package_id' => $balance->customer_service_package_id,
                'customer_id' => $customerId,
                'booking_id' => null,
                'booking_service_id' => $bookingServiceId,
                'used_qty' => $usedQty,
                'used_from' => strtoupper($source),
                'used_ref_id' => $sourceRefId,
                'status' => 'reserved',
                'reserved_at' => now(),
                'notes' => $notes,
            ])->load(['customerServicePackage', 'bookingService']);
        });
    }

    public function consumeNow(int $customerId, int $bookingServiceId, string $source = 'ADMIN', ?int $sourceRefId = null, int $usedQty = 1, ?string $notes = null): CustomerServicePackageUsage
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
                'status' => 'consumed',
                'consumed_at' => now(),
                'notes' => $notes,
            ]);

            $this->syncPackageStatus((int) $balance->customer_service_package_id);

            return $usage->load(['customerServicePackage', 'bookingService']);
        });
    }

    public function attachReservedClaimsToBooking(int $customerId, int $bookingServiceId, string $source, int $sourceRefId, int $bookingId): int
    {
        return (int) CustomerServicePackageUsage::query()
            ->where('customer_id', $customerId)
            ->where('booking_service_id', $bookingServiceId)
            ->where('used_from', strtoupper($source))
            ->where('used_ref_id', $sourceRefId)
            ->where('status', 'reserved')
            ->whereNull('booking_id')
            ->update([
                'booking_id' => $bookingId,
                'updated_at' => now(),
            ]);
    }

    public function consumeReservedClaimsForBooking(int $bookingId): int
    {
        return DB::transaction(function () use ($bookingId) {
            $claims = CustomerServicePackageUsage::query()
                ->where('booking_id', $bookingId)
                ->where('status', 'reserved')
                ->lockForUpdate()
                ->get();

            $count = 0;
            foreach ($claims as $claim) {
                $balance = CustomerServicePackageBalance::query()
                    ->where('customer_service_package_id', $claim->customer_service_package_id)
                    ->where('booking_service_id', $claim->booking_service_id)
                    ->lockForUpdate()
                    ->first();

                if (! $balance) {
                    continue;
                }

                $qty = (int) ($claim->used_qty ?? 1);
                $balance->used_qty = (int) $balance->used_qty + $qty;
                $balance->remaining_qty = max(0, (int) $balance->remaining_qty - $qty);
                $balance->save();

                $claim->status = 'consumed';
                $claim->consumed_at = now();
                $claim->released_at = null;
                $claim->save();

                $this->syncPackageStatus((int) $balance->customer_service_package_id);
                $count++;
            }

            return $count;
        });
    }

    public function releaseReservedClaimsForBooking(int $bookingId): int
    {
        return (int) CustomerServicePackageUsage::query()
            ->where('booking_id', $bookingId)
            ->where('status', 'reserved')
            ->update([
                'status' => 'released',
                'released_at' => now(),
                'updated_at' => now(),
            ]);
    }

    public function releaseReservedClaimsBySource(string $source, int $sourceRefId): int
    {
        return (int) CustomerServicePackageUsage::query()
            ->where('used_from', strtoupper($source))
            ->where('used_ref_id', $sourceRefId)
            ->where('status', 'reserved')
            ->update([
                'status' => 'released',
                'released_at' => now(),
                'updated_at' => now(),
            ]);
    }

    private function findBalanceWithAvailability(int $customerId, int $bookingServiceId, int $requiredQty): CustomerServicePackageBalance
    {
        $balances = CustomerServicePackageBalance::query()
            ->select('customer_service_package_balances.*')
            ->join('customer_service_packages', 'customer_service_packages.id', '=', 'customer_service_package_balances.customer_service_package_id')
            ->where('customer_service_packages.customer_id', $customerId)
            ->where('customer_service_package_balances.booking_service_id', $bookingServiceId)
            ->where('customer_service_packages.status', 'active')
            ->where(function ($query) {
                $query->whereNull('customer_service_packages.expires_at')
                    ->orWhere('customer_service_packages.expires_at', '>=', now());
            })
            ->orderBy('customer_service_packages.created_at')
            ->lockForUpdate()
            ->get();

        foreach ($balances as $balance) {
            $reservedQty = (int) CustomerServicePackageUsage::query()
                ->where('customer_service_package_id', $balance->customer_service_package_id)
                ->where('booking_service_id', $bookingServiceId)
                ->where('status', 'reserved')
                ->sum('used_qty');

            $available = (int) $balance->remaining_qty - $reservedQty;
            if ($available >= $requiredQty) {
                return $balance;
            }
        }

        throw new \RuntimeException('No package balance available for reservation.');
    }

    private function syncPackageStatus(int $customerServicePackageId): void
    {
        $package = CustomerServicePackage::query()->with('balances')->find($customerServicePackageId);
        if (! $package) {
            return;
        }

        $remaining = (int) $package->balances->sum('remaining_qty');
        $package->status = $remaining <= 0 ? 'exhausted' : 'active';
        $package->save();
    }
}
