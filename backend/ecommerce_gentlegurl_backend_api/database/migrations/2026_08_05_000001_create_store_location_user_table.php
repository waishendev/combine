<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('store_location_user', function (Blueprint $table) {
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->unsignedBigInteger('store_location_id');
            $table->timestamps();

            $table->unique(['user_id', 'store_location_id']);
            $table->index('store_location_id');
            $table->foreign('store_location_id')->references('id')->on('store_locations')->cascadeOnDelete();
        });

        $defaultLocationId = DB::table('store_locations')
            ->where('code', config('store_locations.default_code', 'PNG'))
            ->where('is_active', true)
            ->value('id');

        if (! $defaultLocationId) {
            $activeLocations = DB::table('store_locations')
                ->where('is_active', true)
                ->orderBy('sort_order')
                ->orderBy('id')
                ->limit(2)
                ->pluck('id');

            if ($activeLocations->count() === 1) {
                $defaultLocationId = $activeLocations->first();
            }
        }

        if (! $defaultLocationId) {
            throw new RuntimeException('Unable to determine a safe default StoreLocation for existing admin branch-access backfill. Set DEFAULT_STORE_LOCATION_CODE to an active store_locations.code before running this migration.');
        }

        $superAdminRole = config('auth.super_admin_role', 'infra_core_x1');
        $now = now();

        DB::table('users')
            ->whereNotExists(function ($query) use ($superAdminRole) {
                $query->select(DB::raw(1))
                    ->from('role_user')
                    ->join('roles', 'roles.id', '=', 'role_user.role_id')
                    ->whereColumn('role_user.user_id', 'users.id')
                    ->whereIn('roles.name', array_unique([$superAdminRole, 'infra_core_x1']));
            })
            ->orderBy('users.id')
            ->select('users.id')
            ->chunkById(500, function ($users) use ($defaultLocationId, $now) {
                foreach ($users as $user) {
                    DB::table('store_location_user')->updateOrInsert(
                        ['user_id' => $user->id, 'store_location_id' => $defaultLocationId],
                        ['created_at' => $now, 'updated_at' => $now]
                    );
                }
            }, 'users.id', 'id');
    }

    public function down(): void
    {
        Schema::dropIfExists('store_location_user');
    }
};
