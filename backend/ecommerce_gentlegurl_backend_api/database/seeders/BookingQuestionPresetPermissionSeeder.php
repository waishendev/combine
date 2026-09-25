<?php

namespace Database\Seeders;

use App\Models\Permission;
use App\Models\PermissionGroup;
use App\Models\Role;
use Illuminate\Database\Seeder;

class BookingQuestionPresetPermissionSeeder extends Seeder
{
    public function run(): void
    {
        $group = PermissionGroup::query()->firstOrCreate(['name' => 'Booking'], ['sort_order' => 999]);
        $ids = collect(['view', 'create', 'update', 'delete'])->map(function (string $action) use ($group) {
            $slug = "booking.question-presets.{$action}";
            return Permission::query()->firstOrCreate(['slug' => $slug], [
                'name' => ucwords(str_replace(['-', '.'], ' ', $slug)),
                'group_id' => $group->id,
            ])->id;
        });

        Role::query()->where('name', 'infra_core_x1')->first()?->permissions()->syncWithoutDetaching($ids);
    }
}
