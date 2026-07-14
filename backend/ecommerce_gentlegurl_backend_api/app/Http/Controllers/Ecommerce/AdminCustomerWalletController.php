<?php

namespace App\Http\Controllers\Ecommerce;

use App\Http\Controllers\Controller;
use App\Models\Ecommerce\Customer;
use App\Services\Ecommerce\CustomerWalletService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class AdminCustomerWalletController extends Controller
{
    public function show(Customer $customer): JsonResponse
    {
        return response()->json(['success' => true, 'data' => ['wallet_balance' => (string) ($customer->wallet_balance ?? '0.00'), 'recent_transactions' => $customer->walletTransactions()->latest()->limit(10)->get()]]);
    }

    public function transactions(Request $request, Customer $customer): JsonResponse
    {
        return response()->json(['success' => true, 'data' => ['transactions' => $customer->walletTransactions()->latest()->paginate((int) $request->query('per_page', 20))]]);
    }

    public function adjust(Request $request, Customer $customer, CustomerWalletService $wallet): JsonResponse
    {
        $validated = $request->validate([
            'direction' => ['required', Rule::in(['credit', 'debit'])],
            'amount' => ['required', 'numeric', 'min:1', 'max:10000'],
            'remark' => ['required', 'string', 'max:2000'],
            'reference_no' => ['nullable', 'string', 'max:255'],
        ]);
        $allowNegative = $request->user()?->can('customer_wallet.allow_negative_adjustment') ?? false;
        $transaction = $wallet->adjust($customer, $validated['direction'], (string) $validated['amount'], $validated['remark'], $request->user()?->id, $validated['reference_no'] ?? null, $allowNegative);
        return response()->json(['success' => true, 'message' => 'Customer balance adjusted.', 'data' => ['transaction' => $transaction, 'wallet_balance' => (string) $transaction->balance_after]], 201);
    }
}
