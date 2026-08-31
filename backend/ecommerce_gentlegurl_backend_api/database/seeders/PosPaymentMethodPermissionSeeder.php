<?php

namespace Database\Seeders;

use App\Models\Permission;
use App\Models\Role;
use Illuminate\Database\Seeder;

class PosPaymentMethodPermissionSeeder extends Seeder
{
    public function run(): void
    {
        $ids = collect(['pos.payment-method-settings.view' => 'POS Payment Method Settings View', 'pos.payment-method-settings.update' => 'POS Payment Method Settings Update'])
            ->map(fn ($name, $slug) => Permission::query()->firstOrCreate(['slug' => $slug], ['name' => $name])->id)->values()->all();
        Role::query()->where('name', 'infra_core_x1')->get()->each(fn ($role) => $role->permissions()->syncWithoutDetaching($ids));
    }
}
