<?php

namespace Database\Seeders;

use App\Models\Permission;
use App\Models\PermissionGroup;
use App\Models\Role;
use Illuminate\Database\Seeder;

class ExpensePermissionSeeder extends Seeder
{
    public const ROLE_NAMES = [
        'infra_core_x1',
        'superAdmin',
    ];

    public function run(): void
    {
        $group = PermissionGroup::firstOrCreate(
            ['name' => 'Expenses'],
            ['sort_order' => ((int) PermissionGroup::query()->max('sort_order')) + 1]
        );

        $definitions = [
            'expenses.view' => 'View Expenses',
            'expenses.create' => 'Create Expenses',
            'expenses.update' => 'Update Expenses',
            'expenses.delete' => 'Archive Expenses',
            'expenses.export' => 'Export Expenses',
            'expense_categories.view' => 'View Expense Categories',
            'expense_categories.create' => 'Create Expense Categories',
            'expense_categories.update' => 'Update Expense Categories',
            'expense_categories.delete' => 'Delete Expense Categories',
        ];

        $permissionIds = collect($definitions)
            ->map(fn (string $name, string $slug) => Permission::updateOrCreate(
                ['slug' => $slug],
                [
                    'name' => $name,
                    'description' => 'Expense management permission seeded safely without removing existing access.',
                    'group_id' => $group->id,
                ]
            )->id)
            ->all();

        Role::query()
            ->whereIn('name', self::ROLE_NAMES)
            ->get()
            ->each(fn (Role $role) => $role->permissions()->syncWithoutDetaching($permissionIds));

        if (class_exists(\Spatie\Permission\PermissionRegistrar::class)) {
            app(\Spatie\Permission\PermissionRegistrar::class)->forgetCachedPermissions();
        }

        $this->command?->info('Expense permissions synced for infra_core_x1 and superAdmin roles.');
    }
}
