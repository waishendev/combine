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
            ->get()
            ->map(function ($bankAccount) {
                return [
                    'id' => $bankAccount->id,
                    'bank_name' => $bankAccount->bank_name,
                    'account_name' => $bankAccount->account_name,
                    'account_no' => $bankAccount->account_number,
                    'account_number' => $bankAccount->account_number,
                    'branch' => $bankAccount->branch,
                    'logo_url' => $bankAccount->logo_url, // Accessor will return full URL
                    'qr_image_url' => $bankAccount->qr_image_url, // Accessor will return full URL
                    'label' => $bankAccount->label,
                    'swift_code' => $bankAccount->swift_code,
                    'is_default' => $bankAccount->is_default,
                    'instructions' => $bankAccount->instructions,
                ];
            });

        return response()->json([
            'data' => $bankAccounts,
            'success' => true,
            'message' => null,
        ]);
    }
}
