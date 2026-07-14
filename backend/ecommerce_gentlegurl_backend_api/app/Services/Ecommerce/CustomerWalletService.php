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
                    'type' => 'topup',
                    'direction' => 'credit',
                    'amount' => $amount,
                    'balance_before' => $locked->wallet_balance ?? 0,
                    'balance_after' => $locked->wallet_balance ?? 0,
                    'workspace_type' => $data['workspace_type'] ?? null,
                    'payment_gateway_key' => $data['payment_gateway_key'] ?? null,
                    'payment_method_label' => $data['payment_method_label'] ?? null,
                    'reference_no' => $data['reference_no'] ?? null,
                    'status' => 'pending',
                    'remark' => $data['remark'] ?? 'Balance top up pending verification.',
                    'metadata' => $data['metadata'] ?? null,
                ]
            );
        });
    }

    public function complete(CustomerWalletTransaction $transaction, ?string $referenceNo = null): CustomerWalletTransaction
    {
        return DB::transaction(function () use ($transaction, $referenceNo) {
            $walletTransaction = CustomerWalletTransaction::query()->lockForUpdate()->findOrFail($transaction->id);
            if ($walletTransaction->status === 'completed') {
                return $walletTransaction;
            }
            if ($walletTransaction->direction !== 'credit') {
                throw ValidationException::withMessages(['transaction' => 'Only credit top ups can be completed.']);
            }
            $customer = Customer::query()->lockForUpdate()->findOrFail($walletTransaction->customer_id);
            $before = $this->normalizeAmount($customer->wallet_balance ?? 0);
            $after = bcadd($before, $walletTransaction->amount, 2);
            $customer->forceFill(['wallet_balance' => $after])->save();
            $walletTransaction->forceFill([
                'balance_before' => $before,
                'balance_after' => $after,
                'reference_no' => $referenceNo ?: $walletTransaction->reference_no,
                'status' => 'completed',
                'completed_at' => now(),
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
                'status' => 'completed',
                'remark' => $remark,
                'created_by' => $userId,
                'completed_at' => now(),
            ]);
        });
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
