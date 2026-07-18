<?php

namespace App\Console\Commands;

use App\Models\Ecommerce\Customer;
use App\Services\Ecommerce\CustomerWalletService;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\App;
use Illuminate\Support\Facades\Hash;

class WalletDemoDataCommand extends Command
{
    protected $signature = 'wallet:demo-data {--dry-run} {--reset}';
    protected $description = 'Create safe customer wallet demo data for local/staging testing.';

    public function handle(CustomerWalletService $wallet): int
    {
        if (App::environment('production')) { $this->error('Refusing to run in production.'); return self::FAILURE; }
        if ($this->option('dry-run')) { $this->info('Would create/reset wallet demo customers and transactions.'); return self::SUCCESS; }
        if ($this->option('reset')) {
            Customer::where('email', 'like', 'wallet-demo-%@example.test')->get()->each(function (Customer $customer) { $customer->walletTransactions()->delete(); $customer->delete(); });
        }
        $zero = Customer::firstOrCreate(['email'=>'wallet-demo-zero@example.test'], ['name'=>'Wallet Demo Zero','phone'=>'0100000001','password'=>Hash::make('password'),'is_active'=>true]);
        $positive = Customer::firstOrCreate(['email'=>'wallet-demo-positive@example.test'], ['name'=>'Wallet Demo Positive','phone'=>'0100000002','password'=>Hash::make('password'),'is_active'=>true]);
        if (bccomp((string) ($positive->wallet_balance ?? 0), '100.00', 2) < 0) $wallet->adjust($positive, 'credit', '100.00', 'Demo opening customer balance.');
        $pending = $wallet->createPendingTopup($positive, ['amount'=>'50.00','workspace_type'=>'booking','payment_gateway_key'=>'manual_bank_transfer','payment_method_label'=>'Manual Bank Transfer','source_id'=>'demo-pending']);
        $rejected = $wallet->createPendingTopup($positive, ['amount'=>'30.00','workspace_type'=>'ecommerce','payment_gateway_key'=>'manual_bank_transfer','payment_method_label'=>'Manual Bank Transfer','source_id'=>'demo-rejected']);
        $rejected->forceFill(['status'=>'failed','remark'=>'Demo rejected top up. No balance was credited.'])->save();
        $completed = $wallet->createPendingTopup($positive, ['amount'=>'20.00','workspace_type'=>'ecommerce','payment_gateway_key'=>'manual_bank_transfer','payment_method_label'=>'Manual Bank Transfer','source_id'=>'demo-completed']);
        $wallet->complete($completed, 'DEMO-PAID');
        $wallet->adjust($positive, 'credit', '15.00', 'Demo CRM credit adjustment.', null, 'DEMO-CRM-CREDIT');
        $wallet->adjust($positive, 'debit', '5.00', 'Demo CRM debit adjustment.', null, 'DEMO-CRM-DEBIT');
        $wallet->adjust($positive, 'credit', '10.00', 'Demo refund credit example.', null, 'DEMO-REFUND');
        $this->info('Wallet demo data created.');
        return self::SUCCESS;
    }
}
