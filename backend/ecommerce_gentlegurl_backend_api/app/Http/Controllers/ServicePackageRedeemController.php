<?php

namespace App\Http\Controllers;

use App\Services\Booking\CustomerServicePackageService;
use Illuminate\Http\Request;

class ServicePackageRedeemController extends Controller
{
    public function __construct(protected CustomerServicePackageService $service) {}

    public function redeem(Request $request)
    {
        $validated = $request->validate([
            'customer_id' => ['required', 'integer', 'exists:customers,id'],
            'booking_service_id' => ['required', 'integer', 'exists:booking_services,id'],
            'source' => ['required', 'in:POS,BOOKING,ADMIN'],
            'source_ref_id' => ['nullable', 'integer'],
            'used_qty' => ['nullable', 'integer', 'min:1'],
            'notes' => ['nullable', 'string'],
        ]);

        $usage = $this->service->redeem(
            (int) $validated['customer_id'],
            (int) $validated['booking_service_id'],
            (string) $validated['source'],
            isset($validated['source_ref_id']) ? (int) $validated['source_ref_id'] : null,
            (int) ($validated['used_qty'] ?? 1),
            $validated['notes'] ?? null,
        );

        return $this->respond($usage);
    }
}
