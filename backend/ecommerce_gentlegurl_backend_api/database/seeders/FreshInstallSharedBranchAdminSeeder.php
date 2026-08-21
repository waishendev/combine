<?php

namespace Database\Seeders;

use App\Models\Ecommerce\StoreLocation;
use App\Models\Role;
use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;
use RuntimeException;

class FreshInstallSharedBranchAdminSeeder extends Seeder
{
    public function run(): void
    {
        if (app()->environment('production')) {
            throw new RuntimeException('Fresh-install shared Branch Admin fixture cannot run in production.');
        }

        $profile = config('multi_branch.fresh_seed_profile');
        if (! in_array($profile, ['branch_one', 'both'], true)) {
            throw new RuntimeException('MULTI_BRANCH_SEED_PROFILE must be branch_one or both.');
        }

        $role = Role::query()->whereRaw('LOWER(name) = ?', ['admin'])->first();
        if (! $role) {
            throw new RuntimeException('Admin role must be seeded before the shared Branch administrator.');
        }

        $slots = $profile === 'both' ? ['branch_one', 'branch_two'] : ['branch_one'];
        $codes = collect($slots)->map(
            fn (string $slot) => config("multi_branch.fresh_seed_branches.{$slot}.code"),
        );
        $branches = StoreLocation::query()->whereIn('code', $codes)->get();
        if ($branches->count() !== count($slots)) {
            throw new RuntimeException('All configured Branches must exist before the shared Branch administrator is seeded.');
        }

        $fixture = config('multi_branch.fresh_seed_shared_admin');
        $user = User::query()->firstOrCreate(['email' => $fixture['email']], [
            'name' => 'Multi-Branch Admin',
            'username' => $fixture['username'],
            'password' => Hash::make((string) config('multi_branch.fresh_seed_admin_password')),
            'is_active' => true,
        ]);
        $user->roles()->syncWithoutDetaching([$role->id]);
        $user->storeLocations()->sync($branches->modelKeys());

        $this->command?->info('Seeded shared Admin '.$user->email.' for Branches: '.$branches->pluck('code')->sort()->join(', '));
    }
}
