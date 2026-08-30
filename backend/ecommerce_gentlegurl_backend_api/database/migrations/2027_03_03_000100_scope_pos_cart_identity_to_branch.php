<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('pos_carts', function (Blueprint $table) {
            $table->dropUnique('pos_carts_staff_user_id_unique');
            $table->unique(
                ['staff_user_id', 'store_location_id'],
                'pos_carts_staff_branch_unique'
            );
        });
    }

    public function down(): void
    {
        Schema::table('pos_carts', function (Blueprint $table) {
            $table->dropUnique('pos_carts_staff_branch_unique');
            $table->unique('staff_user_id');
        });
    }
};
