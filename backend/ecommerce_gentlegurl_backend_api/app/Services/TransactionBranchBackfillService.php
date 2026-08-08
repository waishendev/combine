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
        $orderNull = Order::query()->whereNull('store_location_id')->count();
        $fromBooking = Order::query()->whereNull('orders.store_location_id')
            ->whereExists(fn ($q) => $q->selectRaw('1')->from('order_items')->join('bookings', 'bookings.id', '=', 'order_items.booking_id')
                ->whereColumn('order_items.order_id', 'orders.id')->whereNotNull('bookings.store_location_id'))
            ->count();
        $fromPickup = Order::query()->whereNull('store_location_id')->whereNotNull('pickup_store_id')
            ->whereIn('pickup_or_shipping', ['pickup', 'self_pickup'])->count();

        return [
            'selected_branch' => ['id' => $default->id, 'code' => $default->code, 'name' => $default->name],
            'bookings' => ['already_attributed' => Booking::query()->whereNotNull('store_location_id')->count(), 'total_null' => $bookingNull, 'candidate_for_default' => $bookingNull, 'unresolved' => 0],
            'orders' => ['already_attributed' => Order::query()->whereNotNull('store_location_id')->count(), 'total_null' => $orderNull, 'derived_from_booking' => $fromBooking, 'derived_from_pickup' => $fromPickup, 'candidate_for_default' => max(0, $orderNull - $fromBooking - $fromPickup), 'unresolved' => max(0, $orderNull - $fromBooking - $fromPickup)],
            'invalid_references' => DB::table('orders')->whereNotNull('pickup_store_id')->whereNotExists(fn ($q) => $q->selectRaw('1')->from('store_locations')->whereColumn('store_locations.id', 'orders.pickup_store_id'))->count(),
        ];
    }

    public function run(StoreLocation $default): array
    {
        return DB::transaction(function () use ($default) {
            $before = $this->preview($default);
            $bookingChanged = Booking::query()->whereNull('store_location_id')->update(['store_location_id' => $default->id]);

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

            return $before + ['bookings_changed' => $bookingChanged, 'orders_changed' => $orderChanged];
        });
    }
}
