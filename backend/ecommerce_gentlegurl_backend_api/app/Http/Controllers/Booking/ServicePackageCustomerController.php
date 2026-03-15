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

        $rows = CustomerServicePackage::query()
            ->with(['servicePackage.items.bookingService:id,name', 'balances.bookingService:id,name'])
            ->where('customer_id', (int) $customer->id)
            ->orderByDesc('id')
            ->get();

        return $this->respond($rows);
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
