<?php

namespace App\Http\Controllers\Booking;

use App\Http\Controllers\Controller;
use App\Models\Booking\CustomerServicePackage;
use App\Models\Booking\ServicePackage;
use App\Services\Booking\CustomerServicePackageService;
use Illuminate\Http\Request;

class ServicePackageCustomerController extends Controller
{
    public function __construct(private readonly CustomerServicePackageService $customerServicePackageService)
    {
    }

    public function index(Request $request)
    {
        $customer = $request->user('customer');

        $rows = $this->customerServicePackageService->redeemablePackagesQuery((int) $customer->id)
            ->with(['servicePackage.items.bookingService:id,name', 'balances.bookingService:id,name'])
            ->orderByDesc('id')
            ->get();

        return $this->respond($rows);
    }


    public function redeem(Request $request)
    {
        $customer = $request->user('customer');

        $validated = $request->validate([
            'booking_service_id' => ['required', 'integer', 'exists:booking_services,id'],
            'source_ref_id' => ['required', 'integer'],
            'used_qty' => ['nullable', 'integer', 'min:1'],
            'customer_service_package_id' => ['nullable', 'integer'],
        ]);

        try {
            if (! empty($validated['customer_service_package_id'])) {
                $usage = $this->customerServicePackageService->reserveFromSpecificPackage(
                    (int) $customer->id,
                    (int) $validated['booking_service_id'],
                    (int) $validated['customer_service_package_id'],
                    'BOOKING',
                    (int) $validated['source_ref_id'],
                    (int) ($validated['used_qty'] ?? 1),
                    'Applied from customer booking cart',
                );
            } else {
                $usage = $this->customerServicePackageService->redeem(
                    (int) $customer->id,
                    (int) $validated['booking_service_id'],
                    'BOOKING',
                    (int) $validated['source_ref_id'],
                    (int) ($validated['used_qty'] ?? 1),
                    'Applied from customer booking cart',
                );
            }
        } catch (\Throwable $e) {
            return $this->respondError($e->getMessage() ?: __('No package balance available.'), 422);
        }

        return $this->respond($usage);
    }

    public function purchase(Request $request)
    {
        $customer = $request->user('customer');

        $validated = $request->validate([
            'service_package_id' => ['required', 'integer', 'exists:service_packages,id'],
        ]);

        $package = ServicePackage::query()
            ->with('items')
            ->where('is_active', true)
            ->findOrFail((int) $validated['service_package_id']);

        $owned = $this->customerServicePackageService->purchase(
            (int) $customer->id,
            $package,
            'BOOKING',
            null
        );

        return $this->respond($owned, __('Package purchased successfully.'));
    }
}
