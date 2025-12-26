<?php

namespace Database\Seeders;

use App\Models\Role;
use Illuminate\Database\Seeder;

class RoleSeeder extends Seeder
{
    public function run(): void
    {
        $roles = [
            // Add business roles here.
        ];

        foreach ($roles as $role) {
            $model = Role::firstOrNew(['name' => $role['name']]);
            $model->description = $role['description'] ?? null;
            $model->is_active = $role['is_active'] ?? true;
            $model->is_system = false;
            $model->save();
        }
    }
}
