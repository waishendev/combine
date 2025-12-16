<?php

namespace App\Http\Controllers\Ecommerce;

use App\Http\Controllers\Controller;
use App\Models\Ecommerce\Customer;
use App\Services\Ecommerce\LoyaltySummaryService;
use Illuminate\Http\JsonResponse;

class PublicAccountController extends Controller
{
    public function overview(LoyaltySummaryService $loyaltySummary): JsonResponse
    {
        /** @var Customer $customer */
        $customer = auth('customer')->user();

        $profile = [
            'id' => $customer->id,
            'name' => $customer->name,
            'email' => $customer->email,
            'phone' => $customer->phone,
            'avatar' => $customer->avatar,
            'gender' => $customer->gender,
            'date_of_birth' => $customer->date_of_birth
                ? $customer->date_of_birth->toDateString()
                : null,
            'tier' => $customer->tier,
        ];

        $loyalty = $loyaltySummary->getSummaryFor($customer);

        $addresses = $customer->addresses()
            ->orderByDesc('is_default')
            ->orderBy('id')
            ->get();

        return response()->json([
            'data' => [
                'profile' => $profile,
                'loyalty' => $loyalty,
                'addresses' => $addresses,
            ],
            'message' => null,
            'success' => true,
        ]);
    }
}
