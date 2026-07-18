<?php

namespace App\Services\Ecommerce;

use App\Models\Ecommerce\Customer;
use App\Models\Ecommerce\CustomerWalletTransaction;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class CustomerWalletService
{
    public function createPendingTopup(Customer $customer, array $data): CustomerWalletTransaction
    {
        $amount = $this->normalizeAmount($data['amount'] ?? 0);
        $this->validateAmount($amount);

        return DB::transaction(function () use ($customer, $data, $amount) {
            $locked = Customer::query()->lockForUpdate()->findOrFail($customer->id);
            $sourceType = 'wallet_topup';
            $sourceId = $data['source_id'] ?? $this->newTransactionNo('WTOP');

            return CustomerWalletTransaction::query()->firstOrCreate(
                ['source_type' => $sourceType, 'source_id' => $sourceId],
                [
                    'customer_id' => $locked->id,
                    'transaction_no' => $this->newTransactionNo('WTX'),
                    'type' => CustomerWalletTransaction::TYPE_TOPUP,
                    'direction' => CustomerWalletTransaction::DIRECTION_CREDIT,
                    'amount' => $amount,
                    'balance_before' => $locked->wallet_balance ?? 0,
                    'balance_after' => $locked->wallet_balance ?? 0,
                    'workspace_type' => $data['workspace_type'] ?? null,
                    'payment_gateway_key' => $data['payment_gateway_key'] ?? null,
                    'payment_method_label' => $data['payment_method_label'] ?? null,
                    'reference_no' => $data['reference_no'] ?? null,
                    'status' => $this->initialTopupStatus($data),
                    'remark' => $data['remark'] ?? 'Balance top up pending payment proof.',
                    'metadata' => $data['metadata'] ?? null,
                ]
            );
        });
    }

    public function complete(CustomerWalletTransaction $transaction, ?string $referenceNo = null, ?int $userId = null, ?string $remark = null): CustomerWalletTransaction
    {
        return DB::transaction(function () use ($transaction, $referenceNo, $userId, $remark) {
            $walletTransaction = CustomerWalletTransaction::query()->lockForUpdate()->findOrFail($transaction->id);
            if ($walletTransaction->status === CustomerWalletTransaction::STATUS_COMPLETED) {
                return $walletTransaction;
            }
            if ($walletTransaction->type !== CustomerWalletTransaction::TYPE_TOPUP || $walletTransaction->direction !== CustomerWalletTransaction::DIRECTION_CREDIT) {
                throw ValidationException::withMessages(['transaction' => 'Only credit top ups can be completed.']);
            }
            if (! in_array($walletTransaction->status, CustomerWalletTransaction::PENDING_REVIEW_STATUSES, true)) {
                throw ValidationException::withMessages(['transaction' => 'This top-up is not awaiting review.']);
            }
            $customer = Customer::query()->lockForUpdate()->findOrFail($walletTransaction->customer_id);
            $before = $this->normalizeAmount($customer->wallet_balance ?? 0);
            $after = bcadd($before, $walletTransaction->amount, 2);
            $customer->forceFill(['wallet_balance' => $after])->save();
            $metadata = $walletTransaction->metadata ?? [];
            $metadata['approved_by'] = $userId;
            $metadata['approved_at'] = now()->toDateTimeString();
            if ($remark) { $metadata['approval_remark'] = $remark; }
            $walletTransaction->forceFill([
                'balance_before' => $before,
                'balance_after' => $after,
                'reference_no' => $referenceNo ?: $walletTransaction->reference_no,
                'status' => CustomerWalletTransaction::STATUS_COMPLETED,
                'completed_at' => now(),
                'created_by' => $walletTransaction->created_by ?: $userId,
                'metadata' => $metadata,
            ])->save();
            return $walletTransaction;
        });
    }

    public function adjust(Customer $customer, string $direction, string $amount, string $remark, ?int $userId = null, ?string $referenceNo = null, bool $allowNegative = false): CustomerWalletTransaction
    {
        $amount = $this->normalizeAmount($amount);
        $this->validateAmount($amount);
        if (! in_array($direction, ['credit', 'debit'], true)) {
            throw ValidationException::withMessages(['direction' => 'Invalid adjustment direction.']);
        }
        if (trim($remark) === '') {
            throw ValidationException::withMessages(['remark' => 'Reason / remark is required.']);
        }

        return DB::transaction(function () use ($customer, $direction, $amount, $remark, $userId, $referenceNo, $allowNegative) {
            $locked = Customer::query()->lockForUpdate()->findOrFail($customer->id);
            $before = $this->normalizeAmount($locked->wallet_balance ?? 0);
            $after = $direction === 'credit' ? bcadd($before, $amount, 2) : bcsub($before, $amount, 2);
            if (! $allowNegative && bccomp($after, '0.00', 2) < 0) {
                throw ValidationException::withMessages(['amount' => 'Deduction cannot exceed the current balance.']);
            }
            $locked->forceFill(['wallet_balance' => $after])->save();
            return CustomerWalletTransaction::query()->create([
                'customer_id' => $locked->id,
                'transaction_no' => $this->newTransactionNo('WTX'),
                'type' => $direction === 'credit' ? 'admin_credit' : 'admin_debit',
                'direction' => $direction,
                'amount' => $amount,
                'balance_before' => $before,
                'balance_after' => $after,
                'workspace_type' => 'crm',
                'source_type' => 'crm_adjustment',
                'source_id' => $this->newTransactionNo('ADJ'),
                'reference_no' => $referenceNo,
                'status' => CustomerWalletTransaction::STATUS_COMPLETED,
                'remark' => $remark,
                'created_by' => $userId,
                'completed_at' => now(),
            ]);
        });
    }


    public function markFailed(CustomerWalletTransaction $transaction, string $remark, ?int $userId = null, string $status = 'failed'): CustomerWalletTransaction
    {
        if (! in_array($status, [CustomerWalletTransaction::STATUS_FAILED, CustomerWalletTransaction::STATUS_CANCELLED, CustomerWalletTransaction::STATUS_REJECTED], true)) {
            $status = CustomerWalletTransaction::STATUS_FAILED;
        }

        return DB::transaction(function () use ($transaction, $remark, $userId, $status) {
            $walletTransaction = CustomerWalletTransaction::query()->lockForUpdate()->findOrFail($transaction->id);
            if ($walletTransaction->status === CustomerWalletTransaction::STATUS_COMPLETED) {
                throw ValidationException::withMessages(['transaction' => 'Completed transactions cannot be rejected.']);
            }
            $metadata = $walletTransaction->metadata ?? [];
            $metadata['reviewed_by'] = $userId;
            $metadata['reviewed_at'] = now()->toDateTimeString();
            $walletTransaction->forceFill([
                'status' => $status,
                'remark' => $remark,
                'metadata' => $metadata,
            ])->save();

            return $walletTransaction;
        });
    }

    public function reverse(CustomerWalletTransaction $transaction, string $remark, ?int $userId = null): CustomerWalletTransaction
    {
        if (trim($remark) === '') {
            throw ValidationException::withMessages(['remark' => 'Reversal reason is required.']);
        }

        return DB::transaction(function () use ($transaction, $remark, $userId) {
            $original = CustomerWalletTransaction::query()->lockForUpdate()->findOrFail($transaction->id);
            if ($original->status !== CustomerWalletTransaction::STATUS_COMPLETED) {
                throw ValidationException::withMessages(['transaction' => 'Only completed transactions can be reversed.']);
            }
            if ($original->reversed_transaction_id) {
                throw ValidationException::withMessages(['transaction' => 'This transaction has already been reversed.']);
            }

            $customer = Customer::query()->lockForUpdate()->findOrFail($original->customer_id);
            $before = $this->normalizeAmount($customer->wallet_balance ?? 0);
            $direction = $original->direction === 'credit' ? 'debit' : 'credit';
            $after = $direction === 'credit' ? bcadd($before, $original->amount, 2) : bcsub($before, $original->amount, 2);
            if (bccomp($after, '0.00', 2) < 0) {
                throw ValidationException::withMessages(['transaction' => 'Reversal would make the customer balance negative.']);
            }

            $customer->forceFill(['wallet_balance' => $after])->save();
            $reversal = CustomerWalletTransaction::query()->create([
                'customer_id' => $customer->id,
                'transaction_no' => $this->newTransactionNo('WTR'),
                'type' => 'reversal',
                'direction' => $direction,
                'amount' => $original->amount,
                'balance_before' => $before,
                'balance_after' => $after,
                'workspace_type' => 'crm',
                'source_type' => 'wallet_reversal',
                'source_id' => $this->newTransactionNo('REV'),
                'reference_no' => $original->transaction_no,
                'status' => CustomerWalletTransaction::STATUS_COMPLETED,
                'remark' => $remark,
                'created_by' => $userId,
                'completed_at' => now(),
                'metadata' => ['reverses_transaction_no' => $original->transaction_no],
            ]);

            $original->forceFill([
                'status' => CustomerWalletTransaction::STATUS_REVERSED,
                'reversed_transaction_id' => $reversal->id,
            ])->save();

            return $reversal;
        });
    }


    private function initialTopupStatus(array $data): string
    {
        $metadata = $data['metadata'] ?? [];
        $provider = is_array($metadata) ? (string) ($metadata['provider'] ?? '') : '';
        $gatewayKey = (string) ($data['payment_gateway_key'] ?? '');

        if ($provider === 'manual' || $gatewayKey === 'manual_transfer' || $gatewayKey === 'manual_bank_transfer') {
            return CustomerWalletTransaction::STATUS_PENDING_PROOF;
        }

        return CustomerWalletTransaction::STATUS_PENDING_PAYMENT;
    }

    private function validateAmount(string $amount): void
    {
        if (bccomp($amount, '0.00', 2) <= 0 || bccomp($amount, '10000.00', 2) > 0) {
            throw ValidationException::withMessages(['amount' => 'Amount must be between RM 1.00 and RM 10,000.00.']);
        }
    }

    private function normalizeAmount(mixed $amount): string { return number_format((float) $amount, 2, '.', ''); }
    public function newTransactionNo(string $prefix): string { return $prefix.now()->format('YmdHis').strtoupper(substr(bin2hex(random_bytes(4)), 0, 8)); }
}
