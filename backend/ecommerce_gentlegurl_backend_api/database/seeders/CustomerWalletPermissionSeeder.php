<?php

namespace Database\Seeders;

use App\Models\Permission;
use App\Models\PermissionGroup;
use App\Models\Role;
use Illuminate\Database\Seeder;

class CustomerWalletPermissionSeeder extends Seeder
{
    public const PERMISSIONS = [
        'customer_wallet.view' => 'Customer Wallet View',
        'customer_wallet.adjust' => 'Customer Wallet Adjust',
        'customer_wallet.view_transactions' => 'Customer Wallet View Transactions',
        'customer_wallet.allow_negative_adjustment' => 'Customer Wallet Allow Negative Adjustment',
        'customer_wallet.reverse_transaction' => 'Customer Wallet Reverse Transaction',
        'customer_wallet.verify_topup' => 'Customer Wallet Verify Top Up',
    ];
    public function run(): void
    {
        $group = PermissionGroup::firstOrCreate(['name' => 'Customer Wallet'], ['sort_order' => (int) PermissionGroup::max('sort_order') + 1]);
        $ids=[];
        foreach (self::PERMISSIONS as $slug=>$name) {
            $ids[] = Permission::updateOrCreate(['slug'=>$slug], ['name'=>$name, 'description'=>'Manage customer balance wallet ledger and audit receipts.', 'group_id'=>$group->id])->id;
        }
        Role::whereIn('name', ['infra_core_x1','superAdmin'])->get()->each(fn (Role $role) => $role->permissions()->syncWithoutDetaching($ids));
        if (class_exists(\Spatie\Permission\PermissionRegistrar::class)) app(\Spatie\Permission\PermissionRegistrar::class)->forgetCachedPermissions();
        $this->command?->info('Customer wallet permissions synced safely.');
    }
}
