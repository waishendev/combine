<?php

namespace App\Services\Booking;

use App\Models\Booking\Booking;
use App\Models\Booking\CustomerServicePackage;
use App\Models\Booking\CustomerServicePackageBalance;
use App\Models\Booking\CustomerServicePackageUsage;
use App\Models\Booking\ServicePackage;
use App\Models\Ecommerce\Order;
use App\Models\Ecommerce\OrderItem;
use App\Models\Ecommerce\OrderItemStaffSplit;
use Illuminate\Database\Eloquent\Builder;
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

            if ($sourceRefId) {
                $existingClaim = CustomerServicePackageUsage::query()
                    ->where('customer_id', $customerId)
                    ->where('booking_service_id', $bookingServiceId)
                    ->where('used_from', strtoupper($source))
                    ->where('used_ref_id', $sourceRefId)
                    ->whereIn('status', ['reserved', 'consumed'])
                    ->first();

                if ($existingClaim) {
                    throw new \RuntimeException('This item has already been claimed from a package.');
                }
            }

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

    public function reserveFromSpecificPackage(int $customerId, int $bookingServiceId, int $customerServicePackageId, string $source = 'POS', ?int $sourceRefId = null, int $usedQty = 1, ?string $notes = null): CustomerServicePackageUsage
    {
        return DB::transaction(function () use ($customerId, $bookingServiceId, $customerServicePackageId, $source, $sourceRefId, $usedQty, $notes) {
            $usedQty = max(1, $usedQty);

            if ($sourceRefId) {
                $existingClaim = CustomerServicePackageUsage::query()
                    ->where('customer_id', $customerId)
                    ->where('booking_service_id', $bookingServiceId)
                    ->where('used_from', strtoupper($source))
                    ->where('used_ref_id', $sourceRefId)
                    ->whereIn('status', ['reserved', 'consumed'])
                    ->first();

                if ($existingClaim) {
                    throw new \RuntimeException('This item has already been claimed from a package.');
                }
            }

            $balance = CustomerServicePackageBalance::query()
                ->where('customer_service_package_id', $customerServicePackageId)
                ->where('booking_service_id', $bookingServiceId)
                ->lockForUpdate()
                ->firstOrFail();

            $reservedQty = (int) CustomerServicePackageUsage::query()
                ->where('customer_service_package_id', $customerServicePackageId)
                ->where('booking_service_id', $bookingServiceId)
                ->where('status', 'reserved')
                ->sum('used_qty');

            $available = max(0, (int) $balance->remaining_qty - $reservedQty);
            if ($available < $usedQty) {
                throw new \RuntimeException('Not enough balance in the selected package.');
            }

            // BOOKING reservations are created from booking cart item ids before the Booking row exists.
            // Keep booking_id null during reservation; checkout attaches the real bookings.id afterwards.
            $resolvedBookingId = null;
            if ($sourceRefId && strtoupper($source) !== 'BOOKING' && Booking::query()->whereKey($sourceRefId)->exists()) {
                $resolvedBookingId = $sourceRefId;
            }

            return CustomerServicePackageUsage::create([
                'customer_service_package_id' => $customerServicePackageId,
                'customer_id' => $customerId,
                'booking_id' => $resolvedBookingId,
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
            ->where(function ($query) use ($sourceRefId) {
                $query->whereNull('booking_id')
                    ->orWhere('booking_id', $sourceRefId);
            })
            ->update([
                'booking_id' => $bookingId,
                'updated_at' => now(),
            ]);
    }

    public function resolvePosCartServiceItemIdsForBooking(int $bookingId): array
    {
        if ($bookingId <= 0) {
            return [];
        }

        return OrderItemStaffSplit::query()
            ->whereHas('orderItem', fn ($query) => $query->where('booking_id', $bookingId))
            ->pluck('snapshot')
            ->map(function ($snapshot) {
                $data = is_array($snapshot) ? $snapshot : json_decode((string) $snapshot, true);

                return (int) (is_array($data) ? ($data['cart_service_item_id'] ?? 0) : 0);
            })
            ->filter(fn (int $id) => $id > 0)
            ->unique()
            ->values()
            ->all();
    }

    public function resolvePosCartServiceItemIdsForOrderItem(int $orderItemId): array
    {
        if ($orderItemId <= 0) {
            return [];
        }

        return OrderItemStaffSplit::query()
            ->where('order_item_id', $orderItemId)
            ->pluck('snapshot')
            ->map(function ($snapshot) {
                $data = is_array($snapshot) ? $snapshot : json_decode((string) $snapshot, true);

                return (int) (is_array($data) ? ($data['cart_service_item_id'] ?? 0) : 0);
            })
            ->filter(fn (int $id) => $id > 0)
            ->unique()
            ->values()
            ->all();
    }

    public function consumeReservedClaimsForBooking(int $bookingId): int
    {
        return DB::transaction(function () use ($bookingId) {
            $posCartItemIds = $this->resolvePosCartServiceItemIdsForBooking($bookingId);

            $claims = CustomerServicePackageUsage::query()
                ->where(function ($q) use ($bookingId, $posCartItemIds) {
                    $q->where('booking_id', $bookingId)
                        ->orWhere(function ($q2) use ($bookingId) {
                            $q2->where('used_from', 'POS')
                                ->where('used_ref_id', $bookingId)
                                ->whereNull('booking_id');
                        });

                    if ($posCartItemIds !== []) {
                        $q->orWhere(function ($q3) use ($posCartItemIds) {
                            $q3->where('used_from', 'POS')
                                ->whereIn('used_ref_id', $posCartItemIds);
                        })->orWhereIn('booking_id', $posCartItemIds);
                    }
                })
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

    public function releaseActiveClaimsForBookingService(int $bookingId, int $bookingServiceId): int
    {
        if ($bookingId <= 0 || $bookingServiceId <= 0) {
            return 0;
        }

        $posCartItemIds = $this->resolvePosCartServiceItemIdsForBooking($bookingId);

        $usageIds = CustomerServicePackageUsage::query()
            ->where('booking_service_id', $bookingServiceId)
            ->where(function ($query) use ($bookingId, $posCartItemIds) {
                $query->where('booking_id', $bookingId)
                    ->orWhere(function ($q) use ($bookingId) {
                        $q->where('used_from', 'POS')
                            ->where('used_ref_id', $bookingId);
                    });

                if ($posCartItemIds !== []) {
                    $query->orWhere(function ($q) use ($posCartItemIds) {
                        $q->where('used_from', 'POS')
                            ->whereIn('used_ref_id', $posCartItemIds);
                    })->orWhereIn('booking_id', $posCartItemIds);
                }
            })
            ->whereIn('status', ['reserved', 'consumed'])
            ->pluck('id')
            ->all();

        return $this->releaseClaimsForBookingByUsageIds($bookingId, $usageIds);
    }

    public function releaseOrphanedPackageClaimsForBooking(int $bookingId, array $activeBookingServiceIds): int
    {
        if ($bookingId <= 0) {
            return 0;
        }

        $activeServiceIds = collect($activeBookingServiceIds)
            ->map(fn ($value) => (int) $value)
            ->filter(fn (int $value) => $value > 0)
            ->unique()
            ->values();

        $posCartItemIds = $this->resolvePosCartServiceItemIdsForBooking($bookingId);

        $usageIds = CustomerServicePackageUsage::query()
            ->where(function ($query) use ($bookingId, $posCartItemIds) {
                $query->where('booking_id', $bookingId)
                    ->orWhere(function ($q) use ($bookingId) {
                        $q->where('used_from', 'POS')
                            ->where('used_ref_id', $bookingId);
                    });

                if ($posCartItemIds !== []) {
                    $query->orWhere(function ($q) use ($posCartItemIds) {
                        $q->where('used_from', 'POS')
                            ->whereIn('used_ref_id', $posCartItemIds);
                    })->orWhereIn('booking_id', $posCartItemIds);
                }
            })
            ->whereIn('status', ['reserved', 'consumed'])
            ->get()
            ->filter(function (CustomerServicePackageUsage $claim) use ($activeServiceIds) {
                $bookingServiceId = (int) ($claim->booking_service_id ?? 0);

                return $bookingServiceId <= 0 || ! $activeServiceIds->contains($bookingServiceId);
            })
            ->pluck('id')
            ->all();

        return $this->releaseClaimsForBookingByUsageIds($bookingId, $usageIds);
    }

    public function releaseClaimsForBookingByUsageIds(int $bookingId, array $usageIds): int
    {
        $usageIds = collect($usageIds)
            ->map(fn ($value) => (int) $value)
            ->filter(fn (int $value) => $value > 0)
            ->unique()
            ->values()
            ->all();

        if ($usageIds === []) {
            return 0;
        }

        return DB::transaction(function () use ($bookingId, $usageIds) {
            $posCartItemIds = $this->resolvePosCartServiceItemIdsForBooking($bookingId);

            $claims = CustomerServicePackageUsage::query()
                ->whereIn('id', $usageIds)
                ->whereIn('status', ['reserved', 'consumed'])
                ->where(function ($query) use ($bookingId, $posCartItemIds) {
                    $query->where('booking_id', $bookingId)
                        ->orWhere(function ($q) use ($bookingId) {
                            $q->where('used_from', 'POS')
                                ->where('used_ref_id', $bookingId);
                        });

                    if ($posCartItemIds !== []) {
                        $query->orWhere(function ($q) use ($posCartItemIds) {
                            $q->where('used_from', 'POS')
                                ->whereIn('used_ref_id', $posCartItemIds);
                        })->orWhereIn('booking_id', $posCartItemIds);
                    }
                })
                ->lockForUpdate()
                ->get();

            $released = 0;
            foreach ($claims as $claim) {
                if ($claim->status === 'consumed') {
                    $qty = max(1, (int) ($claim->used_qty ?? 1));
                    $balance = CustomerServicePackageBalance::query()
                        ->where('customer_service_package_id', $claim->customer_service_package_id)
                        ->where('booking_service_id', $claim->booking_service_id)
                        ->lockForUpdate()
                        ->first();

                    if ($balance) {
                        $balance->used_qty = max(0, (int) $balance->used_qty - $qty);
                        $balance->remaining_qty = (int) $balance->remaining_qty + $qty;
                        $balance->save();
                        $this->syncPackageStatus((int) $balance->customer_service_package_id);
                    }
                }

                $claim->status = 'released';
                $claim->released_at = now();
                $claim->consumed_at = null;
                $claim->updated_at = now();
                $claim->save();
                $released++;
            }

            return $released;
        });
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

    /**
     * Packages the customer may view or redeem (excludes unpaid booking-shop purchases).
     */
    public function redeemablePackagesQuery(int $customerId): Builder
    {
        return CustomerServicePackage::query()
            ->where('customer_id', $customerId)
            ->where('status', 'active')
            ->where(function (Builder $outer) {
                $outer->where('purchased_from', '!=', 'BOOKING')
                    ->orWhere(function (Builder $booking) {
                        $booking->where('purchased_from', 'BOOKING')
                            ->whereNotNull('purchased_ref_id')
                            ->whereExists(function ($sub) {
                                $sub->select(DB::raw(1))
                                    ->from('orders')
                                    ->whereColumn('orders.id', 'customer_service_packages.purchased_ref_id')
                                    ->where('orders.payment_status', 'paid');
                            });
                    })
                    ->orWhere(function (Builder $legacy) {
                        $legacy->where('purchased_from', 'BOOKING')
                            ->whereExists(function ($sub) {
                                $sub->select(DB::raw(1))
                                    ->from('order_items')
                                    ->join('orders', 'orders.id', '=', 'order_items.order_id')
                                    ->whereColumn('order_items.customer_service_package_id', 'customer_service_packages.id')
                                    ->where('orders.payment_status', 'paid');
                            });
                    });
            })
            ->whereNotExists(function ($sub) {
                $sub->select(DB::raw(1))
                    ->from('order_items')
                    ->join('orders', 'orders.id', '=', 'order_items.order_id')
                    ->whereColumn('order_items.customer_service_package_id', 'customer_service_packages.id')
                    ->where('orders.payment_status', '!=', 'paid');
            });
    }

    /**
     * Grant booking-shop service packages after the order is paid.
     *
     * @return int[]
     */
    public function fulfillPendingPackagesForPaidOrder(Order $order): array
    {
        if (strtolower((string) $order->payment_status) !== 'paid' || ! $order->customer_id) {
            return [];
        }

        $order->loadMissing(['items', 'customer']);
        $ownedIds = [];

        foreach ($order->items as $item) {
            if (! $item instanceof OrderItem) {
                continue;
            }

            if (strtolower((string) ($item->line_type ?? '')) !== 'service_package') {
                continue;
            }

            if ((int) ($item->customer_service_package_id ?? 0) > 0) {
                $ownedIds[] = (int) $item->customer_service_package_id;

                continue;
            }

            $servicePackageId = (int) ($item->service_package_id ?? 0);
            if ($servicePackageId <= 0) {
                continue;
            }

            $servicePackage = ServicePackage::query()
                ->with('items')
                ->where('is_active', true)
                ->find($servicePackageId);

            if (! $servicePackage) {
                continue;
            }

            $owned = $this->purchase(
                (int) $order->customer_id,
                $servicePackage,
                'BOOKING',
                (int) $order->id,
            );

            $item->customer_service_package_id = (int) $owned->id;
            $item->save();

            $ownedIds[] = (int) $owned->id;
        }

        return array_values(array_unique($ownedIds));
    }

    public function revokeUnpaidBookingPackagesForOrder(Order $order): void
    {
        if (strtolower((string) $order->payment_status) === 'paid') {
            return;
        }

        $order->loadMissing('items');
        $packageIds = CustomerServicePackage::query()
            ->where('purchased_from', 'BOOKING')
            ->where('purchased_ref_id', (int) $order->id)
            ->where('status', 'active')
            ->pluck('id');

        $packageIds = $packageIds->merge(
            $order->items
                ->filter(fn (OrderItem $item) => strtolower((string) ($item->line_type ?? '')) === 'service_package')
                ->pluck('customer_service_package_id')
                ->filter(fn ($id) => (int) $id > 0)
                ->map(fn ($id) => (int) $id)
        )->unique()->values();

        if ($packageIds->isEmpty()) {
            return;
        }

        CustomerServicePackage::query()
            ->whereIn('id', $packageIds->all())
            ->where('status', 'active')
            ->update(['status' => 'cancelled']);
    }
}
