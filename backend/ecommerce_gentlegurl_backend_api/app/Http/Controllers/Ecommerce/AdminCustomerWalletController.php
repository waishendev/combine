<?php

namespace App\Http\Controllers\Ecommerce;

use App\Http\Controllers\Controller;
use App\Models\Ecommerce\Customer;
use App\Models\Ecommerce\CustomerWalletTransaction;
use App\Services\Ecommerce\CustomerWalletService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class AdminCustomerWalletController extends Controller
{

    public function pendingTopups(Request $request): JsonResponse
    {
        $rows = CustomerWalletTransaction::query()
            ->with('customer:id,name,email,phone,wallet_balance')
            ->pendingReview()
            ->latest()
            ->paginate((int) $request->query('per_page', 50));

        return response()->json(['success' => true, 'data' => ['topups' => $rows]]);
    }


    public function pendingTopupShow(CustomerWalletTransaction $topup): JsonResponse
    {
        abort_unless($topup->type === CustomerWalletTransaction::TYPE_TOPUP, 404);

        return response()->json(['success' => true, 'data' => ['topup' => $topup->load('customer:id,name,email,phone,wallet_balance', 'creator:id,name')]]);
    }

    public function approvePendingTopup(Request $request, CustomerWalletTransaction $topup, CustomerWalletService $wallet): JsonResponse
    {
        abort_unless($topup->type === CustomerWalletTransaction::TYPE_TOPUP, 422, 'Only top-up transactions can be approved.');
        $validated = $request->validate(['reference_no' => ['nullable', 'string', 'max:255'], 'remark' => ['nullable', 'string', 'max:2000']]);
        $completed = $wallet->complete($topup, $validated['reference_no'] ?? $topup->reference_no, $request->user()?->id, $validated['remark'] ?? null);

        return response()->json(['success' => true, 'message' => 'Top-up approved and balance credited.', 'data' => ['transaction' => $completed->load('customer:id,name,email,phone,wallet_balance', 'creator:id,name'), 'wallet_balance' => (string) $completed->balance_after]]);
    }

    public function rejectPendingTopup(Request $request, CustomerWalletTransaction $topup, CustomerWalletService $wallet): JsonResponse
    {
        abort_unless($topup->type === CustomerWalletTransaction::TYPE_TOPUP, 422, 'Only top-up transactions can be rejected.');
        $validated = $request->validate(['remark' => ['required', 'string', 'max:2000']]);
        $failed = $wallet->markFailed($topup, $validated['remark'], $request->user()?->id, CustomerWalletTransaction::STATUS_REJECTED);

        return response()->json(['success' => true, 'message' => 'Top-up rejected. No balance was credited.', 'data' => ['transaction' => $failed->load('customer:id,name,email,phone,wallet_balance', 'creator:id,name')]]);
    }

    public function show(Customer $customer): JsonResponse
    {
        $summary = $customer->walletTransactions()
            ->where('status', 'completed')
            ->selectRaw("SUM(CASE WHEN direction = 'credit' THEN amount ELSE 0 END) as total_deposited")
            ->selectRaw("SUM(CASE WHEN direction = 'debit' THEN amount ELSE 0 END) as total_withdrawn")
            ->first();

        return response()->json(['success' => true, 'data' => [
            'customer' => $customer->only(['id', 'name', 'email', 'phone']),
            'wallet_balance' => (string) ($customer->wallet_balance ?? '0.00'),
            'total_deposited' => number_format((float) ($summary?->total_deposited ?? 0), 2, '.', ''),
            'total_withdrawn' => number_format((float) ($summary?->total_withdrawn ?? 0), 2, '.', ''),
            'recent_transactions' => $customer->walletTransactions()->with('creator:id,name')->latest()->limit(10)->get(),
            'pending_topups' => $customer->walletTransactions()->pendingReview()->latest()->limit(20)->get(),
        ]]);
    }

    public function transactions(Request $request, Customer $customer): JsonResponse
    {
        return response()->json(['success' => true, 'data' => [
            'transactions' => $customer->walletTransactions()->with('creator:id,name')->latest()->paginate((int) $request->query('per_page', 20)),
        ]]);
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
        return response()->json(['success' => true, 'message' => $validated['direction'] === 'credit' ? 'Deposit completed.' : 'Withdraw completed.', 'data' => ['transaction' => $transaction->load('creator:id,name'), 'wallet_balance' => (string) $transaction->balance_after]], 201);
    }

    public function approveTopup(Request $request, Customer $customer, CustomerWalletTransaction $transaction, CustomerWalletService $wallet): JsonResponse
    {
        abort_unless((int) $transaction->customer_id === (int) $customer->id, 404);
        abort_unless($transaction->type === CustomerWalletTransaction::TYPE_TOPUP, 422, 'Only top-up transactions can be approved.');
        $validated = $request->validate(['reference_no' => ['nullable', 'string', 'max:255'], 'remark' => ['nullable', 'string', 'max:2000']]);
        $completed = $wallet->complete($transaction, $validated['reference_no'] ?? $transaction->reference_no, $request->user()?->id, $validated['remark'] ?? null);

        return response()->json(['success' => true, 'message' => 'Top-up approved and balance credited.', 'data' => ['transaction' => $completed->load('creator:id,name'), 'wallet_balance' => (string) $completed->balance_after]]);
    }

    public function rejectTopup(Request $request, Customer $customer, CustomerWalletTransaction $transaction, CustomerWalletService $wallet): JsonResponse
    {
        abort_unless((int) $transaction->customer_id === (int) $customer->id, 404);
        abort_unless($transaction->type === CustomerWalletTransaction::TYPE_TOPUP, 422, 'Only top-up transactions can be rejected.');
        $validated = $request->validate(['remark' => ['required', 'string', 'max:2000']]);
        $failed = $wallet->markFailed($transaction, $validated['remark'], $request->user()?->id, CustomerWalletTransaction::STATUS_REJECTED);

        return response()->json(['success' => true, 'message' => 'Top-up rejected. No balance was credited.', 'data' => ['transaction' => $failed]]);
    }

    public function reverse(Request $request, Customer $customer, CustomerWalletTransaction $transaction, CustomerWalletService $wallet): JsonResponse
    {
        abort_unless((int) $transaction->customer_id === (int) $customer->id, 404);
        $validated = $request->validate(['remark' => ['required', 'string', 'max:2000']]);
        $reversal = $wallet->reverse($transaction, $validated['remark'], $request->user()?->id);

        return response()->json(['success' => true, 'message' => 'Transaction reversed with an audit ledger entry.', 'data' => ['transaction' => $reversal->load('creator:id,name'), 'wallet_balance' => (string) $reversal->balance_after]]);
    }
}
