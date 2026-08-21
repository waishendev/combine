<?php

namespace App\Console\Commands;

use App\Models\Ecommerce\StoreLocation;
use App\Models\Role;
use App\Services\StoreLocationAccessService;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;
use RuntimeException;

class ReconcileRoleBranchesCommand extends Command
{
    protected $signature = 'role-branch:reconcile {--store-code= : Exact operational Branch code} {--dry-run : Report only} {--force : Apply atomically}';
    protected $description = 'Reconcile deterministic legacy operational Roles and assignments to a Branch';

    public function handle(): int
    {
        $code = trim((string) $this->option('store-code'));
        $dryRun = (bool) $this->option('dry-run'); $force = (bool) $this->option('force');
        if ($code === '' || $dryRun === $force) {
            $this->error('Provide --store-code and exactly one of --dry-run or --force.'); return self::FAILURE;
        }
        $branch = StoreLocation::query()->where('code', $code)->where('is_active', true)->first();
        if (! $branch) { $this->error("Active Branch [{$code}] was not found."); return self::FAILURE; }
        $audit = $this->audit((int) $branch->id);
        $this->table(['Role reconciliation', 'Count'], [
            ['Deterministic operational Roles', $audit['roles']->count()], ['System/global Roles preserved', $audit['system']],
            ['Ambiguous Roles preserved', $audit['ambiguous']->count()], ['Assignments to move', $audit['assignments']], ['Conflicts', $audit['conflicts']->count()],
        ]);
        foreach ($audit['conflicts'] as $message) $this->warn($message);
        if ($dryRun) { $this->info('DRY RUN ONLY — NO DATA CHANGED'); return self::SUCCESS; }
        if ($audit['conflicts']->isNotEmpty()) { $this->error('Reconciliation aborted; no rows changed.'); return self::FAILURE; }
        try {
            DB::transaction(function () use ($branch) {
                $audit = $this->audit((int) $branch->id, true);
                if ($audit['conflicts']->isNotEmpty()) throw new RuntimeException('Conflicts appeared after locks were acquired.');
                foreach ($audit['roles'] as $role) {
                    DB::table('roles')->where('id', $role->id)->whereNull('store_location_id')->update(['store_location_id' => $branch->id, 'updated_at' => now()]);
                    $users = DB::table('role_user')->where('role_id', $role->id)->pluck('user_id');
                    foreach ($users as $userId) DB::table('role_user_store_location')->updateOrInsert(
                        ['user_id' => $userId, 'store_location_id' => $branch->id, 'role_id' => $role->id], ['created_at' => now(), 'updated_at' => now()]);
                    DB::table('role_user')->where('role_id', $role->id)->delete();
                }
            }, 3);
        } catch (\Throwable $e) { $this->error('Reconciliation rolled back: '.$e->getMessage()); return self::FAILURE; }
        $this->info('Role Branch reconciliation completed.'); return self::SUCCESS;
    }

    private function audit(int $branchId, bool $lock = false): array
    {
        if ($lock) DB::table('roles')->whereNull('store_location_id')->lockForUpdate()->pluck('id');
        $legacy = Role::query()->whereNull('store_location_id')->with('users:id')->get();
        $system = $legacy->filter(fn ($r) => $r->is_system || strcasecmp($r->name, StoreLocationAccessService::PLATFORM_SUPER_ADMIN_ROLE) === 0);
        $operational = $legacy->reject(fn ($r) => $system->contains('id', $r->id))->filter(function ($role) use ($branchId) {
            if ($role->users->isEmpty()) return false;
            $allowed = DB::table('store_location_user')->where('store_location_id', $branchId)->whereIn('user_id', $role->users->pluck('id'))->count();
            return $allowed === $role->users->count();
        });
        $ambiguous = $legacy->reject(fn ($r) => $system->contains('id', $r->id) || $operational->contains('id', $r->id));
        $conflicts = collect();
        foreach ($operational as $role) {
            if (Role::query()->where('store_location_id', $branchId)->whereRaw('LOWER(name) = LOWER(?)', [$role->name])->exists())
                $conflicts->push("Role [{$role->name}] already exists in target Branch.");
        }
        return ['roles' => $operational, 'system' => $system->count(), 'ambiguous' => $ambiguous, 'assignments' => $operational->sum(fn ($r) => $r->users->count()), 'conflicts' => $conflicts];
    }
}
