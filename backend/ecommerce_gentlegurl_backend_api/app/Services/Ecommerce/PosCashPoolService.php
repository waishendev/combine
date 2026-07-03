<?php

namespace App\Services\Ecommerce;

use App\Models\Ecommerce\PosCashPoolAccount;
use App\Models\Ecommerce\PosCashPoolLedger;
use App\Models\Ecommerce\PosCashShift;
use Illuminate\Validation\ValidationException;

class PosCashPoolService
{
    /**
     * @return array{total_initial_cash: float, total_withdraw: float}
     */
    public function balances(): array
    {
        return $this->defaultAccount()->balancesArray();
    }

    /**
     * @return array{total_initial_cash: float, total_withdraw: float}
     */
    public function applyOpenMovements(PosCashShift $shift, float $refillPacket, float $atm, ?int $userId): array
    {
        $refillPacket = round($refillPacket, 2);
        $atm = round($atm, 2);

        $account = $this->lockDefaultAccount();
        $this->assertAtmAllowed($account->balancesArray(), $atm);

        if ($refillPacket > 0) {
            $this->postEntry($account, $shift, PosCashPoolLedger::ACTION_OPEN_REFILL_PACKET, $refillPacket, 0, $userId);
        }

        if ($atm > 0) {
            $this->postEntry($account, $shift, PosCashPoolLedger::ACTION_OPEN_ATM, 0, -$atm, $userId);
        }

        $account->refresh();

        return $account->balancesArray();
    }

    /**
     * @return array{total_initial_cash: float, total_withdraw: float}
     */
    public function applyCloseMovements(PosCashShift $shift, float $withdraw, float $refillCash, ?int $userId): array
    {
        $withdraw = round($withdraw, 2);
        $refillCash = round($refillCash, 2);

        $account = $this->lockDefaultAccount();

        if ($refillCash > (float) $account->total_initial_cash) {
            throw ValidationException::withMessages([
                'closing_refill_cash' => [__('Refill cash cannot exceed the Total Initial Cash pool balance.')],
            ]);
        }

        if ($withdraw > 0) {
            $this->postEntry($account, $shift, PosCashPoolLedger::ACTION_CLOSE_WITHDRAW, 0, $withdraw, $userId);
        }

        if ($refillCash > 0) {
            $this->postEntry($account, $shift, PosCashPoolLedger::ACTION_CLOSE_REFILL_CASH, -$refillCash, 0, $userId);
        }

        $account->refresh();

        return $account->balancesArray();
    }

    /**
     * @param  array{total_initial_cash: float, total_withdraw: float}  $balances
     */
    public function assertAtmAllowed(array $balances, float $atm): void
    {
        $atm = round($atm, 2);

        if ($atm <= 0) {
            return;
        }

        if ($balances['total_withdraw'] <= 0) {
            throw ValidationException::withMessages([
                'opening_atm' => [__('ATM amount cannot be used when Total Withdraw pool is empty.')],
            ]);
        }

        if ($atm > $balances['total_withdraw']) {
            throw ValidationException::withMessages([
                'opening_atm' => [__('ATM amount cannot exceed the Total Withdraw pool balance.')],
            ]);
        }
    }

    private function lockDefaultAccount(): PosCashPoolAccount
    {
        return PosCashPoolAccount::query()
            ->where('code', PosCashPoolAccount::DEFAULT_CODE)
            ->lockForUpdate()
            ->firstOrFail();
    }

    private function defaultAccount(): PosCashPoolAccount
    {
        return PosCashPoolAccount::query()
            ->where('code', PosCashPoolAccount::DEFAULT_CODE)
            ->firstOrFail();
    }

    private function postEntry(
        PosCashPoolAccount $account,
        PosCashShift $shift,
        string $action,
        float $initialCashDelta,
        float $withdrawDelta,
        ?int $userId,
    ): void {
        $initialCashDelta = round($initialCashDelta, 2);
        $withdrawDelta = round($withdrawDelta, 2);

        $nextInitialCash = round((float) $account->total_initial_cash + $initialCashDelta, 2);
        $nextWithdraw = round((float) $account->total_withdraw + $withdrawDelta, 2);

        if ($nextInitialCash < 0) {
            throw ValidationException::withMessages([
                'pool' => [__('Total Initial Cash pool cannot go below zero.')],
            ]);
        }

        if ($nextWithdraw < 0) {
            throw ValidationException::withMessages([
                'pool' => [__('Total Withdraw pool cannot go below zero.')],
            ]);
        }

        $account->update([
            'total_initial_cash' => $nextInitialCash,
            'total_withdraw' => $nextWithdraw,
        ]);

        PosCashPoolLedger::query()->create([
            'pos_cash_pool_account_id' => $account->id,
            'pos_cash_shift_id' => $shift->id,
            'action' => $action,
            'initial_cash_delta' => $initialCashDelta,
            'withdraw_delta' => $withdrawDelta,
            'initial_cash_after' => $nextInitialCash,
            'withdraw_after' => $nextWithdraw,
            'created_by' => $userId,
        ]);
    }
}
