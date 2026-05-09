<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::table('product_stock_movements', function (Blueprint $table) {
            if (! Schema::hasColumn('product_stock_movements', 'is_revoked')) {
                $table->boolean('is_revoked')->default(false)->after('remark');
            }

            if (! Schema::hasColumn('product_stock_movements', 'revoked_at')) {
                $table->timestamp('revoked_at')->nullable()->after('is_revoked');
            }

            if (! Schema::hasColumn('product_stock_movements', 'revoked_by')) {
                $table->foreignId('revoked_by')->nullable()->after('revoked_at')->constrained('users')->nullOnDelete();
            }

            if (! Schema::hasColumn('product_stock_movements', 'revoke_reason')) {
                $table->text('revoke_reason')->nullable()->after('revoked_by');
            }

            if (! Schema::hasColumn('product_stock_movements', 'reversal_of_movement_id')) {
                $table->foreignId('reversal_of_movement_id')
                    ->nullable()
                    ->after('revoke_reason')
                    ->constrained('product_stock_movements')
                    ->nullOnDelete();
            }
        });
    }

    public function down(): void
    {
        Schema::table('product_stock_movements', function (Blueprint $table) {
            if (Schema::hasColumn('product_stock_movements', 'reversal_of_movement_id')) {
                $table->dropConstrainedForeignId('reversal_of_movement_id');
            }

            if (Schema::hasColumn('product_stock_movements', 'revoke_reason')) {
                $table->dropColumn('revoke_reason');
            }

            if (Schema::hasColumn('product_stock_movements', 'revoked_by')) {
                $table->dropConstrainedForeignId('revoked_by');
            }

            if (Schema::hasColumn('product_stock_movements', 'revoked_at')) {
                $table->dropColumn('revoked_at');
            }

            if (Schema::hasColumn('product_stock_movements', 'is_revoked')) {
                $table->dropColumn('is_revoked');
            }
        });
    }
};
