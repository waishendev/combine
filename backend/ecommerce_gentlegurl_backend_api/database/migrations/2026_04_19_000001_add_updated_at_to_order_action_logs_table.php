<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::table('order_action_logs', function (Blueprint $table) {
            if (! Schema::hasColumn('order_action_logs', 'created_at')) {
                $table->timestamp('created_at')->nullable()->useCurrent();
            }

            if (! Schema::hasColumn('order_action_logs', 'updated_at')) {
                $table->timestamp('updated_at')->nullable();
            }
        });
    }

    public function down(): void
    {
        Schema::table('order_action_logs', function (Blueprint $table) {
            if (Schema::hasColumn('order_action_logs', 'updated_at')) {
                $table->dropColumn('updated_at');
            }
        });
    }
};
