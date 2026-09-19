<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasColumn('store_locations', 'display_code')) {
            Schema::table('store_locations', function (Blueprint $table) {
                $table->string('display_code', 50)->nullable()->after('code');
            });
        }

        // Backfill public label from existing system code for current Branches.
        DB::table('store_locations')
            ->whereNull('display_code')
            ->orWhere('display_code', '')
            ->update(['display_code' => DB::raw('code')]);
    }

    public function down(): void
    {
        if (Schema::hasColumn('store_locations', 'display_code')) {
            Schema::table('store_locations', function (Blueprint $table) {
                $table->dropColumn('display_code');
            });
        }
    }
};
