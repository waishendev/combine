<?php

namespace App\Http\Controllers\Ecommerce;

use App\Http\Controllers\Controller;
use App\Models\BankAccount;
use App\Models\Ecommerce\Customer;
use App\Models\Ecommerce\CustomerWalletTransaction;
use App\Models\Ecommerce\PaymentGateway;
use App\Services\Ecommerce\CustomerWalletService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Arr;
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
            'customer' => Arr::only($customer->toArray(), ['id', 'name', 'email', 'phone']),
        ]]);
    }

    public function transactions(Request $request): JsonResponse
    {
        /** @var Customer $customer */
        $customer = auth('customer')->user();
        $status = (string) $request->query('status', 'all');
        $direction = (string) $request->query('direction', 'all');
        $query = $customer->walletTransactions()->with('creator:id,name')->latest();
        if ($status !== 'all') {
            $query->where('status', $status);
        }
        if (in_array($direction, ['credit', 'debit'], true)) {
            $query->where('direction', $direction);
        }

        return response()->json(['success' => true, 'data' => ['transactions' => $query->paginate((int) $request->query('per_page', 20))]]);
    }

    public function gateways(Request $request): JsonResponse
    {
        $workspace = (string) $request->query('workspace_type', 'ecommerce');
        abort_unless(in_array($workspace, ['ecommerce', 'booking'], true), 422, 'Invalid workspace type.');

        $gateways = PaymentGateway::query()
            ->where('type', $workspace)
            ->where('is_active', true)
            ->orderByDesc('is_default')
            ->orderBy('sort_order')
            ->orderBy('id')
            ->get()
            ->map(fn (PaymentGateway $gateway) => [
                'id' => $gateway->id,
                'key' => $this->normalizeGatewayKey($gateway->key),
                'gateway_key' => $gateway->key,
                'name' => $gateway->name,
                'type' => $gateway->type,
                'is_active' => (bool) $gateway->is_active,
                'is_default' => (bool) $gateway->is_default,
                'requires_proof' => $this->normalizeGatewayKey($gateway->key) === 'manual_transfer',
                'provider' => str_starts_with($gateway->key, 'billplz') ? 'billplz' : 'manual',
                'config' => [],
            ]);

        $bankAccounts = BankAccount::query()
            ->where('type', $workspace)
            ->where('is_active', true)
            ->orderByDesc('is_default')
            ->orderBy('sort_order')
            ->orderBy('id')
            ->get()
            ->map(fn (BankAccount $bankAccount) => [
                'id' => $bankAccount->id,
                'label' => $bankAccount->label,
                'bank_name' => $bankAccount->bank_name,
                'account_name' => $bankAccount->account_name,
                'account_no' => $bankAccount->account_number,
                'account_number' => $bankAccount->account_number,
                'branch' => $bankAccount->branch,
                'swift_code' => $bankAccount->swift_code,
                'logo_url' => $bankAccount->logo_url,
                'qr_image_url' => $bankAccount->qr_image_url,
                'is_default' => (bool) $bankAccount->is_default,
                'instructions' => $bankAccount->instructions,
            ]);

        return response()->json(['success' => true, 'data' => [
            'payment_gateways' => $gateways,
            'bank_accounts' => $bankAccounts,
            'workspace_type' => $workspace,
        ]]);
    }

    public function topup(Request $request, CustomerWalletService $wallet): JsonResponse
    {
        $validated = $request->validate([
            'amount' => ['required', 'numeric', 'min:1', 'max:10000'],
            'workspace_type' => ['required', Rule::in(['ecommerce', 'booking'])],
            'payment_gateway_key' => ['required', 'string'],
            'payment_method_label' => ['nullable', 'string', 'max:255'],
            'reference_no' => ['nullable', 'string', 'max:255'],
            'bank_account_id' => ['nullable', 'integer', 'exists:bank_accounts,id'],
        ]);

        $gatewayKey = $this->denormalizeGatewayKey($validated['payment_gateway_key']);
        $gateway = PaymentGateway::query()
            ->where('type', $validated['workspace_type'])
            ->where('key', $gatewayKey)
            ->where('is_active', true)
            ->firstOrFail();

        $bankAccount = null;
        if ($this->normalizeGatewayKey($gateway->key) === 'manual_transfer') {
            $bankAccount = BankAccount::query()
                ->where('type', $validated['workspace_type'])
                ->where('is_active', true)
                ->findOrFail($validated['bank_account_id'] ?? 0);
        }

        /** @var Customer $customer */
        $customer = auth('customer')->user();
        $transaction = $wallet->createPendingTopup($customer, array_merge($validated, [
            'payment_gateway_key' => $this->normalizeGatewayKey($gateway->key),
            'payment_method_label' => $validated['payment_method_label'] ?? $gateway->name,
            'metadata' => [
                'gateway_key' => $gateway->key,
                'provider' => str_starts_with($gateway->key, 'billplz') ? 'billplz' : 'manual',
                'bank_account_id' => $bankAccount?->id,
                'bank_name' => $bankAccount?->bank_name,
                'bank_account_name' => $bankAccount?->account_name,
                'bank_account_number' => $bankAccount?->account_number,
            ],
        ]));

        return response()->json(['success' => true, 'message' => 'Top-up request submitted. Your balance will be credited after payment is successfully verified.', 'data' => ['topup' => $transaction]], 201);
    }

    public function topupShow(CustomerWalletTransaction $topup): JsonResponse
    {
        abort_unless($topup->customer_id === auth('customer')->id(), 404);
        return response()->json(['success' => true, 'data' => ['topup' => $topup->load('creator:id,name')]]);
    }

    public function uploadProof(Request $request, CustomerWalletTransaction $topup): JsonResponse
    {
        abort_unless($topup->customer_id === auth('customer')->id(), 404);
        $request->validate(['payment_proof' => ['required', 'file', 'mimes:jpg,jpeg,png,pdf', 'max:5120']]);
        $path = $request->file('payment_proof')->store('wallet-payment-proofs', 'public');
        $metadata = $topup->metadata ?? [];
        $metadata['payment_proof_url'] = Storage::disk('public')->url($path);
        $metadata['payment_proof_uploaded_at'] = now()->toDateTimeString();
        $topup->forceFill(['metadata' => $metadata, 'remark' => 'Manual transfer proof uploaded. Pending verification.'])->save();
        return response()->json(['success' => true, 'data' => ['topup' => $topup->refresh()]]);
    }

    private function normalizeGatewayKey(string $key): string
    {
        return match ($key) {
            'billplz_fpx' => 'billplz_online_banking',
            'billplz_card' => 'billplz_credit_card',
            default => $key,
        };
    }

    private function denormalizeGatewayKey(string $key): string
    {
        return match ($key) {
            'billplz_online_banking' => 'billplz_fpx',
            'billplz_credit_card' => 'billplz_card',
            default => $key,
        };
    }
}
