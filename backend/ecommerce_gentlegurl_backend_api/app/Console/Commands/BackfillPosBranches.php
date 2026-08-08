<?php

namespace App\Console\Commands;

use App\Models\Ecommerce\PosCashPoolAccount;
use App\Models\Ecommerce\PosCashShift;
use App\Models\Ecommerce\StoreLocation;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;

class BackfillPosBranches extends Command
{
    protected $signature = 'pos-branch:backfill {--store-code=} {--dry-run} {--force}';
    protected $description = 'Attribute legacy POS cash operational parents to one explicit existing Branch';

    public function handle(): int
    {
        $code = trim((string) $this->option('store-code'));
        if ($code === '' || $this->option('dry-run') === $this->option('force')) {
            $this->error('Provide --store-code and exactly one of --dry-run or --force.');
            return self::FAILURE;
        }
        $branch = StoreLocation::query()->where('code', $code)->first();
        if (! $branch) {
            $this->error("Branch code [{$code}] does not exist; no Branch was created.");
            return self::FAILURE;
        }

        $conflictingCloseIds = PosCashShift::query()->whereNull('store_location_id')
            ->whereNotNull('linked_open_shift_id')
            ->whereHas('linkedOpenShift', fn ($query) => $query->whereNotNull('store_location_id')->where('store_location_id', '!=', $branch->id))
            ->pluck('id');
        $nullShifts = PosCashShift::query()->whereNull('store_location_id')->count();
        $assignableShifts = $nullShifts - $conflictingCloseIds->count();
        $nullAccounts = PosCashPoolAccount::query()->whereNull('store_location_id')->get();
        $conflictingAccountIds = $nullAccounts->filter(fn ($account) => PosCashPoolAccount::query()
            ->where('store_location_id', $branch->id)->where('code', $account->code)->exists())->pluck('id');
        $assignableAccounts = $nullAccounts->count() - $conflictingAccountIds->count();
        $unresolvedLedger = DB::table('pos_cash_pool_ledger')->join('pos_cash_pool_accounts', 'pos_cash_pool_accounts.id', '=', 'pos_cash_pool_ledger.pos_cash_pool_account_id')
            ->whereNull('pos_cash_pool_accounts.store_location_id')->count();

        $this->line("shifts_null={$nullShifts}; shifts_assignable={$assignableShifts}; shifts_unresolved={$conflictingCloseIds->count()}");
        $this->line("accounts_null={$nullAccounts->count()}; accounts_assignable={$assignableAccounts}; accounts_unresolved={$conflictingAccountIds->count()}");
        $this->line("ledger_entries_inheriting_unresolved_account={$unresolvedLedger}");
        if ($this->option('dry-run')) {
            $this->info('Dry run: zero writes performed.');
            return self::SUCCESS;
        }

        DB::transaction(function () use ($branch, $conflictingCloseIds, $conflictingAccountIds) {
            PosCashShift::query()->whereNull('store_location_id')->whereNotIn('id', $conflictingCloseIds)->update(['store_location_id' => $branch->id]);
            PosCashPoolAccount::query()->whereNull('store_location_id')->whereNotIn('id', $conflictingAccountIds)->update(['store_location_id' => $branch->id]);
        });
        $this->info('POS Branch attribution completed. Existing non-null values and unresolved conflicts were preserved.');
        return self::SUCCESS;
    }
}
