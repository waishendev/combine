<?php

namespace App\Http\Controllers;

use App\Models\Booking\CustomerServicePackage;
use App\Models\Booking\CustomerServicePackageBalance;
use App\Models\Booking\CustomerServicePackageUsage;
use Illuminate\Http\Request;

class CustomerServicePackageController extends Controller
{
    public function index(int $customerId)
    {
        $rows = CustomerServicePackage::query()
            ->with(['servicePackage:id,name'])
            ->where('customer_id', $customerId)
            ->orderByDesc('id')
            ->get();

        return $this->respond($rows);
    }

    public function balances(int $customerId)
    {
        $packageIds = CustomerServicePackage::query()
            ->where('customer_id', $customerId)
            ->pluck('id')
            ->map(fn ($id) => (int) $id)
            ->filter(fn (int $id) => $id > 0)
            ->values()
            ->all();

        if ($packageIds === []) {
            return $this->respond([]);
        }

        $rows = CustomerServicePackageBalance::query()
            ->with([
                'bookingService:id,name',
                'customerServicePackage:id,customer_id,service_package_id,status',
                'customerServicePackage.servicePackage:id,name',
            ])
            ->whereIn('customer_service_package_id', $packageIds)
            ->orderByDesc('id')
            ->get();

        return $this->respond($rows);
    }

    public function usages(int $id, ?Request $request = null)
    {
        $request = $request ?? request();
        $customerId = $id;
        $perPage = min(100, max(1, $request->integer('per_page', 50)));
        $page = max(1, $request->integer('page', 1));

        $paginator = CustomerServicePackageUsage::query()
            ->with([
                'bookingService:id,name',
                'customerServicePackage:id,customer_id,service_package_id,status',
                'customerServicePackage.servicePackage:id,name',
            ])
            ->where('customer_id', $customerId)
            ->orderByDesc('id')
            ->paginate($perPage, ['*'], 'page', $page);

        // Keep nested `data` rows for FE parsers; expose pagination beside it.
        return $this->respond([
            'data' => $paginator->items(),
            'current_page' => $paginator->currentPage(),
            'last_page' => $paginator->lastPage(),
            'per_page' => $paginator->perPage(),
            'total' => $paginator->total(),
        ]);
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

        if ($rows->isEmpty()) {
            return $this->respond([]);
        }

        $packageIds = $rows
            ->pluck('customer_service_package_id')
            ->map(fn ($id) => (int) $id)
            ->filter(fn (int $id) => $id > 0)
            ->unique()
            ->values()
            ->all();

        $reservedByPackageId = $packageIds === []
            ? collect()
            : CustomerServicePackageUsage::query()
                ->selectRaw('customer_service_package_id, COALESCE(SUM(used_qty), 0) as reserved_qty')
                ->whereIn('customer_service_package_id', $packageIds)
                ->where('booking_service_id', $serviceId)
                ->where('status', 'reserved')
                ->groupBy('customer_service_package_id')
                ->pluck('reserved_qty', 'customer_service_package_id');

        $rows = $rows
            ->map(function ($row) use ($reservedByPackageId) {
                $reservedQty = (int) ($reservedByPackageId[(int) $row->customer_service_package_id] ?? 0);
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
