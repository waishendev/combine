<?php

namespace App\Http\Controllers\Ecommerce;

use App\Http\Controllers\Controller;
use App\Models\BankAccount;
use Illuminate\Http\JsonResponse;

class PublicPaymentMethodController extends Controller
{
    public function index(): JsonResponse
    {
        $bankAccounts = BankAccount::query()
            ->where('is_active', true)
            ->orderBy('sort_order')
            ->orderBy('id')
            ->get([
                'id',
                'label',
                'bank_name',
                'account_name',
                'account_number',
                'branch',
                'swift_code',
                'logo_url',
                'qr_image_url',
                'is_default',
                'instructions',
            ]);

        $methods = [
            [
                'code' => 'billplz_fpx',
                'label' => 'Online Banking (FPX)',
                'type' => 'online',
                'enabled' => true,
            ],
            [
                'code' => 'manual_bank_transfer',
                'label' => 'Manual Bank Transfer',
                'type' => 'offline',
                'enabled' => $bankAccounts->isNotEmpty(),
                'banks' => $bankAccounts,
            ],
        ];

        return response()->json([
            'data' => [
                'methods' => $methods,
            ],
            'success' => true,
            'message' => null,
        ]);
    }
}
