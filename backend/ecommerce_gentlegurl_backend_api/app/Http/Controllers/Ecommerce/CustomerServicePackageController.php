<?php

namespace App\Http\Controllers\Ecommerce;

use App\Http\Controllers\Controller;
use App\Models\Ecommerce\CustomerServicePackage;
use App\Models\Ecommerce\CustomerServicePackageBalance;
use App\Models\Ecommerce\ServicePackage;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class CustomerServicePackageController extends Controller
{
    public function index(Request $request)
    {
        $validated = $request->validate([
            'customer_id' => ['required', 'integer', 'exists:customers,id'],
        ]);

        $rows = CustomerServicePackage::query()
            ->with(['package.items.bookingService', 'balances.bookingService'])
            ->where('customer_id', (int) $validated['customer_id'])
            ->orderByDesc('id')
            ->get();

        return $this->respond($rows->map(fn (CustomerServicePackage $row) => $this->mapAssignment($row))->values()->all());
    }

    public function store(Request $request)
    {
        $validated = $request->validate([
            'customer_id' => ['required', 'integer', 'exists:customers,id'],
            'service_package_id' => ['required', 'integer', 'exists:service_packages,id'],
            'notes' => ['nullable', 'string'],
        ]);

        $assignment = DB::transaction(function () use ($validated, $request) {
            $package = ServicePackage::query()->with('items')->findOrFail((int) $validated['service_package_id']);

            $assignment = CustomerServicePackage::create([
                'customer_id' => (int) $validated['customer_id'],
                'service_package_id' => (int) $validated['service_package_id'],
                'assigned_by_user_id' => $request->user()?->id,
                'assigned_at' => now(),
                'notes' => $validated['notes'] ?? null,
            ]);

            foreach ($package->items as $item) {
                CustomerServicePackageBalance::create([
                    'customer_service_package_id' => $assignment->id,
                    'booking_service_id' => (int) $item->booking_service_id,
                    'total_quantity' => (int) $item->quantity,
                    'used_quantity' => 0,
                ]);
            }

            return $assignment;
        });

        $assignment->load(['package.items.bookingService', 'balances.bookingService']);

        return $this->respond($this->mapAssignment($assignment));
    }

    public function redeem(Request $request)
    {
        $validated = $request->validate([
            'customer_id' => ['required', 'integer', 'exists:customers,id'],
            'booking_service_id' => ['required', 'integer', 'exists:booking_services,id'],
            'quantity' => ['nullable', 'integer', 'min:1'],
        ]);

        $quantity = (int) ($validated['quantity'] ?? 1);
        $customerId = (int) $validated['customer_id'];
        $serviceId = (int) $validated['booking_service_id'];

        $result = DB::transaction(function () use ($customerId, $serviceId, $quantity) {
            $balances = CustomerServicePackageBalance::query()
                ->where('booking_service_id', $serviceId)
                ->whereHas('customerServicePackage', fn ($q) => $q->where('customer_id', $customerId))
                ->orderBy('id')
                ->lockForUpdate()
                ->get();

            $remainingToRedeem = $quantity;
            $used = 0;

            foreach ($balances as $balance) {
                if ($remainingToRedeem <= 0) {
                    break;
                }

                $available = max(0, (int) $balance->total_quantity - (int) $balance->used_quantity);
                if ($available <= 0) {
                    continue;
                }

                $consume = min($available, $remainingToRedeem);
                $balance->used_quantity = (int) $balance->used_quantity + $consume;
                $balance->save();

                $used += $consume;
                $remainingToRedeem -= $consume;
            }

            $totalRemaining = CustomerServicePackageBalance::query()
                ->where('booking_service_id', $serviceId)
                ->whereHas('customerServicePackage', fn ($q) => $q->where('customer_id', $customerId))
                ->get()
                ->sum(fn (CustomerServicePackageBalance $row) => max(0, (int) $row->total_quantity - (int) $row->used_quantity));

            return [
                'requested_quantity' => $quantity,
                'redeemed_quantity' => $used,
                'remaining_quantity' => (int) $totalRemaining,
            ];
        });

        return $this->respond($result);
    }

    private function mapAssignment(CustomerServicePackage $row): array
    {
        return [
            'id' => (int) $row->id,
            'customer_id' => (int) $row->customer_id,
            'service_package_id' => (int) $row->service_package_id,
            'package_name' => $row->package?->name,
            'assigned_at' => $row->assigned_at?->toDateTimeString(),
            'notes' => $row->notes,
            'balances' => $row->balances->map(function (CustomerServicePackageBalance $balance) {
                return [
                    'booking_service_id' => (int) $balance->booking_service_id,
                    'service_name' => $balance->bookingService?->name,
                    'total_quantity' => (int) $balance->total_quantity,
                    'used_quantity' => (int) $balance->used_quantity,
                    'remaining_quantity' => max(0, (int) $balance->total_quantity - (int) $balance->used_quantity),
                ];
            })->values()->all(),
        ];
    }
}
