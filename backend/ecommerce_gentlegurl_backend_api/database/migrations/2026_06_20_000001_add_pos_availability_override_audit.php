<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        foreach (['pos_cart_service_items', 'order_service_items'] as $tableName) {
            if (! Schema::hasTable($tableName)) {
                continue;
            }

            Schema::table($tableName, function (Blueprint $table) use ($tableName) {
                if (! Schema::hasColumn($tableName, 'availability_override')) {
                    $table->boolean('availability_override')->default(false);
                }
                if (! Schema::hasColumn($tableName, 'availability_override_reason')) {
                    $table->text('availability_override_reason')->nullable();
                }
                if (! Schema::hasColumn($tableName, 'availability_override_warning_type')) {
                    $table->string('availability_override_warning_type', 64)->nullable();
                }
                if (! Schema::hasColumn($tableName, 'availability_override_by')) {
                    $table->unsignedBigInteger('availability_override_by')->nullable();
                }
                if (! Schema::hasColumn($tableName, 'availability_override_at')) {
                    $table->timestamp('availability_override_at')->nullable();
                }
            });
        }
    }

    public function down(): void
    {
        foreach (['pos_cart_service_items', 'order_service_items'] as $tableName) {
            if (! Schema::hasTable($tableName)) {
                continue;
            }

            Schema::table($tableName, function (Blueprint $table) use ($tableName) {
                foreach (['availability_override_at', 'availability_override_by', 'availability_override_warning_type', 'availability_override_reason', 'availability_override'] as $column) {
                    if (Schema::hasColumn($tableName, $column)) {
                        $table->dropColumn($column);
                    }
                }
            });
        }
    }
};
