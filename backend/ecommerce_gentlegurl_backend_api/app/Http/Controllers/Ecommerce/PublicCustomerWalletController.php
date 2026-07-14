<?php

namespace App\Http\Controllers\Ecommerce;

use App\Http\Controllers\Controller;
use App\Models\Ecommerce\Customer;
use App\Models\Ecommerce\CustomerWalletTransaction;
use App\Models\Ecommerce\PaymentGateway;
use App\Services\Ecommerce\CustomerWalletService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\Rule;

class PublicCustomerWalletController extends Controller
{
    public function show(): JsonResponse
    {
        /** @var Customer $customer */
        $customer = auth('customer')->user();
        return response()->json(['success' => true, 'data' => [
            'balance' => (string) ($customer->wallet_balance ?? '0.00'),
            'wallet_balance' => (string) ($customer->wallet_balance ?? '0.00'),
            'customer_id' => $customer->id,
        ]]);
    }

    public function transactions(Request $request): JsonResponse
    {
        /** @var Customer $customer */
        $customer = auth('customer')->user();
        $status = $request->query('status', 'completed');
        $query = $customer->walletTransactions()->latest();
        if ($status !== 'all') $query->where('status', $status);
        return response()->json(['success' => true, 'data' => ['transactions' => $query->paginate((int) $request->query('per_page', 20))]]);
    }

    public function gateways(Request $request): JsonResponse
    {
        $workspace = $request->query('workspace_type', 'ecommerce');
        $gateways = PaymentGateway::query()->where('type', $workspace)->where('is_active', true)->orderByDesc('is_default')->orderBy('sort_order')->get();
        return response()->json(['success' => true, 'data' => ['payment_gateways' => $gateways]]);
    }

    public function topup(Request $request, CustomerWalletService $wallet): JsonResponse
    {
        $validated = $request->validate([
            'amount' => ['required', 'numeric', 'min:1', 'max:10000'],
            'workspace_type' => ['required', Rule::in(['ecommerce', 'booking'])],
            'payment_gateway_key' => ['required', 'string'],
            'payment_method_label' => ['nullable', 'string', 'max:255'],
            'reference_no' => ['nullable', 'string', 'max:255'],
        ]);
        $gateway = PaymentGateway::query()->where('type', $validated['workspace_type'])->where('key', $validated['payment_gateway_key'])->where('is_active', true)->firstOrFail();
        /** @var Customer $customer */
        $customer = auth('customer')->user();
        $transaction = $wallet->createPendingTopup($customer, array_merge($validated, [
            'payment_method_label' => $validated['payment_method_label'] ?? $gateway->name,
            'metadata' => ['gateway_configured' => true],
        ]));
        return response()->json(['success' => true, 'message' => 'Top up submitted. Balance will only be credited after payment is successfully verified.', 'data' => ['topup' => $transaction]], 201);
    }

    public function topupShow(CustomerWalletTransaction $topup): JsonResponse
    {
        abort_unless($topup->customer_id === auth('customer')->id(), 404);
        return response()->json(['success' => true, 'data' => ['topup' => $topup]]);
    }

    public function uploadProof(Request $request, CustomerWalletTransaction $topup): JsonResponse
    {
        abort_unless($topup->customer_id === auth('customer')->id(), 404);
        $request->validate(['payment_proof' => ['required', 'file', 'mimes:jpg,jpeg,png,pdf', 'max:5120']]);
        $path = $request->file('payment_proof')->store('wallet-payment-proofs', 'public');
        $metadata = $topup->metadata ?? [];
        $metadata['payment_proof_url'] = Storage::disk('public')->url($path);
        $topup->forceFill(['metadata' => $metadata, 'remark' => 'Manual transfer proof uploaded. Pending verification.'])->save();
        return response()->json(['success' => true, 'data' => ['topup' => $topup->refresh()]]);
    }
}
