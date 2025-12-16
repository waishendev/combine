<?php

namespace App\Http\Controllers\Ecommerce;

use App\Http\Controllers\Controller;
use App\Models\BankAccount;
use Illuminate\Http\JsonResponse;

class PublicBankAccountController extends Controller
{
    public function index(): JsonResponse
    {
        $bankAccounts = BankAccount::query()
            ->where('is_active', true)
            ->orderBy('sort_order')
            ->orderBy('id')
            ->get([
                'id',
                'bank_name',
                'account_name',
                'account_number as account_no',
                'branch',
                'logo_url',
                'qr_image_url',
                'label',
                'swift_code',
            ]);

        return response()->json([
            'data' => $bankAccounts,
            'success' => true,
            'message' => null,
        ]);
    }
}
