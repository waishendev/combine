<?php

namespace Database\Seeders;

use App\Models\Ecommerce\StoreLocation;
use App\Models\Role;
use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;
use RuntimeException;

abstract class ConfiguredFreshInstallBranchSeeder extends Seeder
{
    protected function seedBranch(string $slot): StoreLocation
    {
        if (app()->environment('production')) {
            throw new RuntimeException('Fresh-install Branch/Admin fixtures cannot run in production.');
        }

        $fixture = config("multi_branch.fresh_seed_branches.{$slot}");
        if (! is_array($fixture) || blank($fixture['code'] ?? null)) {
            throw new RuntimeException("Missing Multi-Branch fresh seed configuration for [{$slot}].");
        }

        $role = Role::query()->whereRaw('LOWER(name) = ?', ['admin'])->first();
        if (! $role) {
            throw new RuntimeException('Admin role must be seeded before fresh-install Branch administrators.');
        }

        $branch = StoreLocation::query()->firstOrCreate(['code' => $fixture['code']], [
            'name' => $fixture['name'],
            'address_line1' => 'QA fixture address',
            'city' => 'George Town',
            'state' => 'Pulau Pinang',
            'postcode' => '10000',
            'country' => 'Malaysia',
            'is_active' => true,
            'is_pickup_available' => true,
            'is_booking_available' => true,
            'is_pos_available' => true,
            'sort_order' => $slot === 'branch_one' ? 1 : 2,
        ]);
        $branch->forceFill([
            'is_active' => true,
            'is_pickup_available' => true,
            'is_booking_available' => true,
            'is_pos_available' => true,
            'sort_order' => $slot === 'branch_one' ? 1 : 2,
        ])->save();

        $user = User::query()->firstOrCreate(['email' => $fixture['admin_email']], [
            'name' => $branch->name.' Admin',
            'username' => $fixture['admin_username'],
            'password' => Hash::make((string) config('multi_branch.fresh_seed_admin_password')),
            'is_active' => true,
        ]);
        $user->roles()->syncWithoutDetaching([$role->id]);

        // Exact assignment is intentional: a Branch fixture administrator must
        // not inherit another Branch when this seeder is replayed or profiles change.
        $user->storeLocations()->sync([$branch->id]);

        $this->command?->info("Seeded {$slot}: {$branch->code} with {$user->email}");

        return $branch;
    }
}
