<?php

namespace App\Http\Controllers\Ecommerce;

use App\Http\Controllers\Controller;
use App\Models\BankAccount;
use App\Models\BillplzPaymentGatewayOption;
use App\Models\Ecommerce\Customer;
use App\Models\Ecommerce\CustomerWalletTransaction;
use App\Models\Ecommerce\PaymentGateway;
use App\Services\BillplzService;
use App\Services\Ecommerce\CustomerWalletService;
use App\Services\Ecommerce\WalletTopupReserveService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Arr;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\Rule;
use RuntimeException;
use Throwable;

class PublicCustomerWalletController extends Controller
{
    public function __construct(protected WalletTopupReserveService $walletTopupReserveService)
    {
    }

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
        $status = strtolower((string) $request->query('status', 'all'));
        $direction = (string) $request->query('direction', 'all');
        $perPage = max(1, min(50, (int) $request->query('per_page', 10)));
        $query = $customer->walletTransactions()->with('creator:id,name')->latest();

        if ($status === 'pending') {
            $query->whereIn('status', CustomerWalletTransaction::PENDING_REVIEW_STATUSES);
        } elseif ($status === 'completed') {
            $query->where('status', CustomerWalletTransaction::STATUS_COMPLETED);
        } elseif ($status !== 'all' && $status !== '') {
            $query->where('status', $status);
        }

        if (in_array($direction, ['credit', 'debit'], true)) {
            $query->where('direction', $direction);
        }

        $paginator = $query->paginate($perPage);
        $paginator->getCollection()->transform(fn (CustomerWalletTransaction $tx) => $this->decorateTopup($tx));

        return response()->json(['success' => true, 'data' => ['transactions' => $paginator]]);
    }

    public function gateways(Request $request): JsonResponse
    {
        $workspace = (string) $request->query('workspace_type', 'ecommerce');
        abort_unless(in_array($workspace, ['ecommerce', 'booking'], true), 422, 'Invalid workspace type.');

        $gateways = PaymentGateway::query()
            ->where('type', $workspace)
            ->where('is_active', true)
            ->where('allow_wallet_topup', true)
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
                'allow_wallet_topup' => (bool) $gateway->allow_wallet_topup,
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

    public function topup(Request $request, CustomerWalletService $wallet, BillplzService $billplzService): JsonResponse
    {
        $validated = $request->validate([
            'amount' => ['required', 'numeric', 'min:1', 'max:10000'],
            'workspace_type' => ['required', Rule::in(['ecommerce', 'booking'])],
            'payment_gateway_key' => ['required', 'string'],
            'payment_method_label' => ['nullable', 'string', 'max:255'],
            'reference_no' => ['nullable', 'string', 'max:255'],
            'bank_account_id' => ['nullable', 'integer', 'exists:bank_accounts,id'],
            'billplz_gateway_option_id' => ['nullable', 'integer', 'exists:billplz_payment_gateway_options,id'],
        ]);

        $normalizedKey = $this->normalizeGatewayKey($validated['payment_gateway_key']);
        $gatewayKey = $this->denormalizeGatewayKey($validated['payment_gateway_key']);
        $gateway = PaymentGateway::query()
            ->where('type', $validated['workspace_type'])
            ->where('key', $gatewayKey)
            ->where('is_active', true)
            ->where('allow_wallet_topup', true)
            ->first();

        if (! $gateway) {
            return response()->json([
                'success' => false,
                'message' => 'Selected payment gateway is not available for wallet top up.',
                'errors' => ['payment_gateway_key' => ['Selected payment gateway is not available for wallet top up.']],
            ], 422);
        }

        $bankAccount = null;
        if ($normalizedKey === 'manual_transfer') {
            $bankAccount = BankAccount::query()
                ->where('type', $validated['workspace_type'])
                ->where('is_active', true)
                ->findOrFail($validated['bank_account_id'] ?? 0);
        }

        $selectedGatewayOption = null;
        if ($normalizedKey === 'billplz_online_banking') {
            $selectedGatewayOption = $this->resolveBillplzGatewayOption(
                $validated['workspace_type'],
                'online_banking',
                (int) ($validated['billplz_gateway_option_id'] ?? 0),
            );
        }

        /** @var Customer $customer */
        $customer = auth('customer')->user();
        $provider = str_starts_with($gateway->key, 'billplz') ? 'billplz' : 'manual';

        $transaction = $wallet->createPendingTopup($customer, array_merge($validated, [
            'payment_gateway_key' => $normalizedKey,
            'payment_method_label' => $validated['payment_method_label'] ?? $gateway->name,
            'remark' => $provider === 'billplz'
                ? 'Balance top up pending Billplz payment.'
                : 'Balance top up pending payment proof.',
            'metadata' => [
                'gateway_key' => $gateway->key,
                'provider' => $provider,
                'bank_account_id' => $bankAccount?->id,
                'bank_name' => $bankAccount?->bank_name,
                'bank_account_name' => $bankAccount?->account_name,
                'bank_account_number' => $bankAccount?->account_number,
                'bank_label' => $bankAccount?->label,
                'bank_qr_image_url' => $bankAccount?->qr_image_url,
                'bank_instructions' => $bankAccount?->instructions,
                'billplz_gateway_option_id' => $selectedGatewayOption?->id,
                'selected_gateway_code' => $selectedGatewayOption?->code,
            ],
        ]));

        $paymentUrl = null;
        if ($provider === 'billplz') {
            try {
                $bill = $billplzService->createBillForWalletTopup(
                    $customer,
                    $transaction,
                    $validated['workspace_type'],
                    $normalizedKey,
                    $selectedGatewayOption,
                );
                $paymentUrl = data_get($bill, 'url');
                $metadata = $transaction->metadata ?? [];
                $metadata['billplz_id'] = data_get($bill, 'id');
                $metadata['billplz_url'] = $paymentUrl;
                $metadata['billplz_collection_id'] = data_get($bill, 'collection_id');
                $transaction->forceFill([
                    'metadata' => $metadata,
                    'reference_no' => data_get($bill, 'id') ?: $transaction->reference_no,
                ])->save();
                $transaction = $transaction->refresh();
            } catch (Throwable $e) {
                $wallet->markFailed($transaction, 'Unable to create Billplz payment: '.$e->getMessage());
                $message = $e instanceof RuntimeException
                    ? $e->getMessage()
                    : 'Unable to start Billplz payment. Please try again.';

                return response()->json([
                    'success' => false,
                    'message' => $message,
                    'errors' => ['payment_gateway_key' => [$message]],
                ], 422);
            }

            if (! $paymentUrl) {
                $wallet->markFailed($transaction, 'Billplz did not return a payment URL.');

                return response()->json([
                    'success' => false,
                    'message' => 'Unable to start Billplz payment. Please try again.',
                ], 422);
            }
        }

        $message = $provider === 'billplz'
            ? 'Redirecting to Billplz to complete your top up.'
            : 'Top-up request created. Transfer the amount and upload your payment proof.';

        return response()->json([
            'success' => true,
            'message' => $message,
            'data' => [
                'topup' => $this->decorateTopup($transaction),
                'payment_url' => $paymentUrl,
                'requires_proof' => $provider === 'manual',
            ],
        ], 201);
    }

    public function topupShow(CustomerWalletTransaction $topup): JsonResponse
    {
        abort_unless($topup->customer_id === auth('customer')->id(), 404);

        return response()->json([
            'success' => true,
            'data' => ['topup' => $this->decorateTopup($topup->load('creator:id,name'))],
        ]);
    }

    public function pay(CustomerWalletTransaction $topup, BillplzService $billplzService, CustomerWalletService $wallet): JsonResponse
    {
        abort_unless($topup->customer_id === auth('customer')->id(), 404);
        abort_unless($topup->type === CustomerWalletTransaction::TYPE_TOPUP, 404);

        if ($this->walletTopupReserveService->expireIfNeeded($topup->refresh(), $wallet)) {
            return response()->json([
                'success' => false,
                'message' => 'This top-up has expired. Please create a new top-up.',
                'data' => ['topup' => $this->decorateTopup($topup->refresh())],
            ], 422);
        }

        if ($topup->status !== CustomerWalletTransaction::STATUS_PENDING_PAYMENT) {
            return response()->json([
                'success' => false,
                'message' => 'This top-up is not awaiting payment.',
            ], 422);
        }

        $metadata = is_array($topup->metadata) ? $topup->metadata : [];
        $provider = (string) ($metadata['provider'] ?? '');
        $paymentMethod = $this->normalizeGatewayKey((string) ($topup->payment_gateway_key ?? ''));

        if ($provider !== 'billplz' && ! str_starts_with($paymentMethod, 'billplz_')) {
            return response()->json([
                'success' => false,
                'message' => 'Only Billplz top-ups can be paid online.',
            ], 422);
        }

        $existingUrl = (string) ($metadata['billplz_url'] ?? '');
        if ($existingUrl !== '') {
            return response()->json([
                'success' => true,
                'message' => 'Continue payment on Billplz.',
                'data' => [
                    'topup' => $this->decorateTopup($topup),
                    'payment_url' => $existingUrl,
                ],
            ]);
        }

        $workspaceType = in_array((string) $topup->workspace_type, ['ecommerce', 'booking'], true)
            ? (string) $topup->workspace_type
            : 'booking';

        $selectedGatewayOption = null;
        $optionId = (int) ($metadata['billplz_gateway_option_id'] ?? 0);
        if ($paymentMethod === 'billplz_online_banking' && $optionId > 0) {
            $selectedGatewayOption = BillplzPaymentGatewayOption::query()
                ->where('id', $optionId)
                ->where('type', $workspaceType)
                ->where('gateway_group', 'online_banking')
                ->where('is_active', true)
                ->first();
        }

        /** @var Customer $customer */
        $customer = auth('customer')->user();

        try {
            $bill = $billplzService->createBillForWalletTopup(
                $customer,
                $topup,
                $workspaceType,
                $paymentMethod ?: 'billplz_online_banking',
                $selectedGatewayOption,
            );
            $paymentUrl = (string) data_get($bill, 'url', '');
            if ($paymentUrl === '') {
                return response()->json([
                    'success' => false,
                    'message' => 'Unable to start Billplz payment. Please try again.',
                ], 422);
            }

            $metadata['billplz_id'] = data_get($bill, 'id');
            $metadata['billplz_url'] = $paymentUrl;
            $metadata['billplz_collection_id'] = data_get($bill, 'collection_id');
            $topup->forceFill([
                'metadata' => $metadata,
                'reference_no' => data_get($bill, 'id') ?: $topup->reference_no,
            ])->save();

            return response()->json([
                'success' => true,
                'message' => 'Redirecting to Billplz to complete your top up.',
                'data' => [
                    'topup' => $this->decorateTopup($topup->refresh()),
                    'payment_url' => $paymentUrl,
                ],
            ]);
        } catch (Throwable $e) {
            $message = $e instanceof RuntimeException
                ? $e->getMessage()
                : 'Unable to start Billplz payment. Please try again.';

            return response()->json([
                'success' => false,
                'message' => $message,
            ], 422);
        }
    }

    public function cancel(CustomerWalletTransaction $topup, CustomerWalletService $wallet): JsonResponse
    {
        abort_unless($topup->customer_id === auth('customer')->id(), 404);
        abort_unless($topup->type === CustomerWalletTransaction::TYPE_TOPUP, 404);

        if ($this->walletTopupReserveService->expireIfNeeded($topup->refresh(), $wallet)) {
            return response()->json([
                'success' => false,
                'message' => 'This top-up has already expired.',
                'data' => ['topup' => $this->decorateTopup($topup->refresh())],
            ], 422);
        }

        $cancellable = [
            CustomerWalletTransaction::STATUS_PENDING,
            CustomerWalletTransaction::STATUS_PENDING_PAYMENT,
            CustomerWalletTransaction::STATUS_PENDING_PROOF,
        ];

        if (! in_array($topup->status, $cancellable, true)) {
            return response()->json([
                'success' => false,
                'message' => 'This top-up can no longer be cancelled.',
            ], 422);
        }

        $cancelled = $wallet->markFailed(
            $topup,
            'Cancelled by customer.',
            null,
            CustomerWalletTransaction::STATUS_CANCELLED,
        );

        return response()->json([
            'success' => true,
            'message' => 'Top-up cancelled.',
            'data' => ['topup' => $this->decorateTopup($cancelled)],
        ]);
    }

    public function uploadProof(Request $request, CustomerWalletTransaction $topup, CustomerWalletService $wallet): JsonResponse
    {
        abort_unless($topup->customer_id === auth('customer')->id(), 404);
        abort_unless($topup->type === CustomerWalletTransaction::TYPE_TOPUP, 404);

        if ($this->walletTopupReserveService->expireIfNeeded($topup->refresh(), $wallet)) {
            return response()->json([
                'success' => false,
                'message' => 'This top-up has expired. Please create a new top-up to upload proof.',
                'data' => ['topup' => $this->decorateTopup($topup->refresh())],
            ], 422);
        }

        $allowedStatuses = [
            CustomerWalletTransaction::STATUS_PENDING,
            CustomerWalletTransaction::STATUS_PENDING_PROOF,
            CustomerWalletTransaction::STATUS_WAITING_VERIFICATION,
            CustomerWalletTransaction::STATUS_PROOF_SUBMITTED,
        ];

        if (! in_array($topup->status, $allowedStatuses, true)) {
            return response()->json([
                'success' => false,
                'message' => 'This top-up can no longer accept payment proof.',
            ], 422);
        }

        $request->validate(['payment_proof' => ['required', 'file', 'mimes:jpg,jpeg,png,webp,pdf', 'max:5120']]);
        $path = $request->file('payment_proof')->store('wallet-payment-proofs', 'public');
        $metadata = $topup->metadata ?? [];
        $metadata['payment_proof_url'] = Storage::disk('public')->url($path);
        $metadata['payment_proof_uploaded_at'] = now()->toDateTimeString();
        $metadata['payment_proof_original_name'] = $request->file('payment_proof')->getClientOriginalName();
        $topup->forceFill([
            'metadata' => $metadata,
            'status' => CustomerWalletTransaction::STATUS_WAITING_VERIFICATION,
            'remark' => 'Manual transfer proof uploaded. Pending verification.',
        ])->save();

        return response()->json([
            'success' => true,
            'message' => 'Payment proof submitted. Waiting for verification.',
            'data' => ['topup' => $this->decorateTopup($topup->refresh())],
        ]);
    }

    private function decorateTopup(CustomerWalletTransaction $topup): CustomerWalletTransaction
    {
        if ($this->walletTopupReserveService->isSubjectToReserve($topup)) {
            $expiresAt = $this->walletTopupReserveService->getReserveExpiresAt($topup);
            $topup->setAttribute('reserve_expires_at', $expiresAt->toDateTimeString());
            $topup->setAttribute('is_reserve_expired', $expiresAt->isPast());
        } else {
            $topup->setAttribute('reserve_expires_at', null);
            $topup->setAttribute('is_reserve_expired', false);
        }

        return $topup;
    }

    private function resolveBillplzGatewayOption(string $workspaceType, string $gatewayGroup, int $optionId): ?BillplzPaymentGatewayOption
    {
        if ($optionId <= 0) {
            return null;
        }

        $option = BillplzPaymentGatewayOption::query()
            ->where('id', $optionId)
            ->where('type', $workspaceType)
            ->where('gateway_group', $gatewayGroup)
            ->where('is_active', true)
            ->first();

        if (! $option) {
            abort(response()->json([
                'success' => false,
                'message' => 'Selected online banking option is not available.',
                'errors' => ['billplz_gateway_option_id' => ['Selected online banking option is not available.']],
            ], 422));
        }

        return $option;
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
