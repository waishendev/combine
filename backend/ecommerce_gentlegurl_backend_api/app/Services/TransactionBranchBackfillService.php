<?php

namespace App\Services;

use App\Models\Booking\Booking;
use App\Models\Ecommerce\Order;
use App\Models\Ecommerce\StoreLocation;
use Illuminate\Support\Facades\DB;

class TransactionBranchBackfillService
{
    public function preview(StoreLocation $default): array
    {
        $bookingNull = Booking::query()->whereNull('store_location_id')->count();
        $bookingEvidence = DB::table('bookings as b')
            ->join('order_items as oi', 'oi.booking_id', '=', 'b.id')
            ->join('orders as o', 'o.id', '=', 'oi.order_id')
            ->whereNull('b.store_location_id')->whereNotNull('o.store_location_id')
            ->groupBy('b.id')
            ->selectRaw('b.id, COUNT(DISTINCT o.store_location_id) as branch_count');
        $bookingFromOrder = DB::query()->fromSub(clone $bookingEvidence, 'evidence')->where('branch_count', 1)->count();
        $bookingConflicts = DB::query()->fromSub($bookingEvidence, 'evidence')->where('branch_count', '>', 1)->count();
        $orderNull = Order::query()->whereNull('store_location_id')->count();
        $fromBooking = Order::query()->whereNull('orders.store_location_id')
            ->whereExists(fn ($q) => $q->selectRaw('1')->from('order_items')->join('bookings', 'bookings.id', '=', 'order_items.booking_id')
                ->whereColumn('order_items.order_id', 'orders.id')->whereNotNull('bookings.store_location_id'))
            ->count();
        $fromPickup = Order::query()->whereNull('store_location_id')->whereNotNull('pickup_store_id')
            ->whereIn('pickup_or_shipping', ['pickup', 'self_pickup'])->count();

        return [
            'selected_branch' => ['id' => $default->id, 'code' => $default->code, 'name' => $default->name],
            'bookings' => ['already_attributed' => Booking::query()->whereNotNull('store_location_id')->count(), 'total_null' => $bookingNull, 'derived_from_order' => $bookingFromOrder, 'candidate_for_default' => max(0, $bookingNull - $bookingFromOrder - $bookingConflicts), 'unresolved' => $bookingConflicts],
            'orders' => ['already_attributed' => Order::query()->whereNotNull('store_location_id')->count(), 'total_null' => $orderNull, 'derived_from_booking' => $fromBooking, 'derived_from_pickup' => $fromPickup, 'candidate_for_default' => max(0, $orderNull - $fromBooking - $fromPickup), 'unresolved' => max(0, $orderNull - $fromBooking - $fromPickup)],
            'invalid_references' => DB::table('orders')->whereNotNull('pickup_store_id')->whereNotExists(fn ($q) => $q->selectRaw('1')->from('store_locations')->whereColumn('store_locations.id', 'orders.pickup_store_id'))->count(),
        ];
    }

    public function run(StoreLocation $default): array
    {
        return DB::transaction(function () use ($default) {
            $before = $this->preview($default);
            $bookingDerivedFromOrder = 0;
            Booking::query()->whereNull('store_location_id')->orderBy('id')->chunkById(250, function ($bookings) use (&$bookingDerivedFromOrder) {
                foreach ($bookings as $booking) {
                    $branches = DB::table('order_items as oi')->join('orders as o', 'o.id', '=', 'oi.order_id')
                        ->where('oi.booking_id', $booking->id)->whereNotNull('o.store_location_id')
                        ->distinct()->pluck('o.store_location_id');
                    if ($branches->count() === 1 && Booking::query()->whereKey($booking->id)->whereNull('store_location_id')->update(['store_location_id' => (int) $branches->first()])) {
                        $bookingDerivedFromOrder++;
                    }
                }
            });
            // Preserve the established operator-approved default only for rows with
            // no persisted Order evidence. Conflicting evidence is never overwritten.
            $bookingDefaulted = Booking::query()->whereNull('store_location_id')
                ->whereNotExists(fn ($q) => $q->selectRaw('1')->from('order_items as oi')->join('orders as o', 'o.id', '=', 'oi.order_id')
                    ->whereColumn('oi.booking_id', 'bookings.id')->whereNotNull('o.store_location_id'))
                ->update(['store_location_id' => $default->id]);
            $bookingChanged = $bookingDerivedFromOrder + $bookingDefaulted;

            $orderChanged = 0;
            Order::query()->whereNull('store_location_id')->orderBy('id')->chunkById(250, function ($orders) use (&$orderChanged) {
                foreach ($orders as $order) {
                    $bookingBranch = DB::table('order_items')->join('bookings', 'bookings.id', '=', 'order_items.booking_id')
                        ->where('order_items.order_id', $order->id)->whereNotNull('bookings.store_location_id')
                        ->value('bookings.store_location_id');
                    $pickupBranch = in_array($order->pickup_or_shipping, ['pickup', 'self_pickup'], true) ? $order->pickup_store_id : null;
                    $branch = $bookingBranch ?: $pickupBranch;
                    if ($branch && Order::query()->whereKey($order->id)->whereNull('store_location_id')->update(['store_location_id' => $branch])) {
                        $orderChanged++;
                    }
                }
            });

            return $before + ['bookings_derived_from_order' => $bookingDerivedFromOrder, 'bookings_defaulted' => $bookingDefaulted, 'bookings_changed' => $bookingChanged, 'orders_changed' => $orderChanged];
        });
    }
}
