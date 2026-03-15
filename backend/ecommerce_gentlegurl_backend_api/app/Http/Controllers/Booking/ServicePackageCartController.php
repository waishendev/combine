<?php

namespace App\Http\Controllers\Booking;

use App\Http\Controllers\Controller;
use App\Models\Booking\ServicePackage;
use App\Services\Booking\CustomerServicePackageService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class ServicePackageCartController extends Controller
{
    public function __construct(private readonly CustomerServicePackageService $customerServicePackageService)
    {
    }

    public function show(Request $request)
    {
        $customer = $request->user('customer');

        $items = DB::table('booking_package_cart_items')
            ->where('customer_id', (int) $customer->id)
            ->where('status', 'ACTIVE')
            ->orderByDesc('id')
            ->get();

        $packageIds = collect($items)->pluck('service_package_id')->map(fn ($id) => (int) $id)->unique()->values()->all();
        $packages = ServicePackage::query()
            ->whereIn('id', $packageIds)
            ->get()
            ->keyBy('id');

        $mapped = collect($items)->map(function ($item) use ($packages) {
            $pkg = $packages->get((int) $item->service_package_id);
            $price = (float) ($pkg?->selling_price ?? 0);
            $qty = (int) $item->qty;

            return [
                'id' => (int) $item->id,
                'service_package_id' => (int) $item->service_package_id,
                'qty' => $qty,
                'unit_price' => $price,
                'line_total' => $price * $qty,
                'service_package' => $pkg,
            ];
        })->values();

        return $this->respond([
            'items' => $mapped,
            'total' => (float) $mapped->sum('line_total'),
        ]);
    }

    public function add(Request $request)
    {
        $customer = $request->user('customer');

        $validated = $request->validate([
            'service_package_id' => ['required', 'integer', 'exists:service_packages,id'],
            'qty' => ['nullable', 'integer', 'min:1'],
        ]);

        $qty = (int) ($validated['qty'] ?? 1);

        $package = ServicePackage::query()
            ->where('is_active', true)
            ->findOrFail((int) $validated['service_package_id']);

        $existing = DB::table('booking_package_cart_items')
            ->where('customer_id', (int) $customer->id)
            ->where('service_package_id', (int) $package->id)
            ->where('status', 'ACTIVE')
            ->first();

        if ($existing) {
            DB::table('booking_package_cart_items')
                ->where('id', (int) $existing->id)
                ->update([
                    'qty' => (int) $existing->qty + $qty,
                    'updated_at' => now(),
                ]);
        } else {
            DB::table('booking_package_cart_items')->insert([
                'customer_id' => (int) $customer->id,
                'service_package_id' => (int) $package->id,
                'qty' => $qty,
                'status' => 'ACTIVE',
                'created_at' => now(),
                'updated_at' => now(),
            ]);
        }

        return $this->show($request);
    }

    public function remove(Request $request, int $id)
    {
        $customer = $request->user('customer');

        DB::table('booking_package_cart_items')
            ->where('id', $id)
            ->where('customer_id', (int) $customer->id)
            ->where('status', 'ACTIVE')
            ->delete();

        return $this->show($request);
    }

    public function checkout(Request $request)
    {
        $customer = $request->user('customer');

        $items = DB::table('booking_package_cart_items')
            ->where('customer_id', (int) $customer->id)
            ->where('status', 'ACTIVE')
            ->get();

        if ($items->isEmpty()) {
            return $this->respondError('Package cart is empty.', 422);
        }

        $packageIds = $items->pluck('service_package_id')->map(fn ($id) => (int) $id)->unique()->values()->all();
        $packages = ServicePackage::query()->whereIn('id', $packageIds)->get()->keyBy('id');

        $total = 0.0;
        foreach ($items as $item) {
            $price = (float) ($packages->get((int) $item->service_package_id)?->selling_price ?? 0);
            $total += $price * (int) $item->qty;
        }

        $paymentId = DB::table('booking_package_payments')->insertGetId([
            'customer_id' => (int) $customer->id,
            'amount' => $total,
            'status' => 'PENDING',
            'ref' => 'PKG-' . (int) $customer->id . '-' . now()->timestamp,
            'raw_response' => json_encode(['item_count' => $items->count()]),
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        DB::table('booking_package_cart_items')
            ->where('customer_id', (int) $customer->id)
            ->where('status', 'ACTIVE')
            ->update([
                'status' => 'CHECKED_OUT',
                'updated_at' => now(),
            ]);

        return $this->respond([
            'payment_id' => (int) $paymentId,
            'status' => 'PENDING',
            'amount' => $total,
            'payment_url' => url('/api/booking/package-cart/payment/callback?payment_id=' . $paymentId . '&status=PAID'),
        ]);
    }

    public function callback(Request $request)
    {
        $validated = $request->validate([
            'payment_id' => ['required', 'integer', 'exists:booking_package_payments,id'],
            'status' => ['required', 'in:PAID,FAILED'],
            'ref' => ['nullable', 'string'],
        ]);

        $payment = DB::table('booking_package_payments')->where('id', (int) $validated['payment_id'])->first();
        if (!$payment) {
            return $this->respondError('Payment record not found.', 404);
        }

        if ($validated['status'] === 'PAID') {
            DB::table('booking_package_payments')->where('id', (int) $payment->id)->update([
                'status' => 'PAID',
                'ref' => $validated['ref'] ?? $payment->ref,
                'raw_response' => json_encode($request->all()),
                'updated_at' => now(),
            ]);

            $items = DB::table('booking_package_cart_items')
                ->where('customer_id', (int) $payment->customer_id)
                ->where('status', 'CHECKED_OUT')
                ->get();

            foreach ($items as $item) {
                $package = ServicePackage::query()->with('items')->find((int) $item->service_package_id);
                if (!$package) {
                    continue;
                }

                for ($i = 0; $i < (int) $item->qty; $i++) {
                    $this->customerServicePackageService->purchase(
                        (int) $payment->customer_id,
                        $package,
                        'BOOKING',
                        (int) $payment->id,
                    );
                }
            }

            DB::table('booking_package_cart_items')
                ->where('customer_id', (int) $payment->customer_id)
                ->where('status', 'CHECKED_OUT')
                ->delete();
        } else {
            DB::table('booking_package_payments')->where('id', (int) $payment->id)->update([
                'status' => 'FAILED',
                'ref' => $validated['ref'] ?? $payment->ref,
                'raw_response' => json_encode($request->all()),
                'updated_at' => now(),
            ]);

            DB::table('booking_package_cart_items')
                ->where('customer_id', (int) $payment->customer_id)
                ->where('status', 'CHECKED_OUT')
                ->update([
                    'status' => 'ACTIVE',
                    'updated_at' => now(),
                ]);
        }

        return $this->respond([
            'payment_id' => (int) $payment->id,
            'payment_status' => $validated['status'],
        ]);
    }
}
