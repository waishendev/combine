<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        // Drop the unique constraint if it exists (using PostgreSQL IF EXISTS)
        DB::statement('ALTER TABLE users DROP CONSTRAINT IF EXISTS users_username_unique');

        // Modify the column to be nullable
        Schema::table('users', function (Blueprint $table) {
            $table->string('username', 100)->nullable()->change();
        });

        // Re-add the unique constraint (PostgreSQL allows multiple NULLs in unique columns)
        Schema::table('users', function (Blueprint $table) {
            $table->unique('username');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        // Drop the unique constraint
        DB::statement('ALTER TABLE users DROP CONSTRAINT IF EXISTS users_username_unique');

        // Modify column to be not nullable
        Schema::table('users', function (Blueprint $table) {
            $table->string('username', 100)->nullable(false)->change();
        });

        // Re-add the unique constraint
        Schema::table('users', function (Blueprint $table) {
            $table->unique('username');
        });
    }
};
