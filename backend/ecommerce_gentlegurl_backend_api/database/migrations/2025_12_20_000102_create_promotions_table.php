<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        // Check if table already exists (from old migration)
        if (Schema::hasTable('promotions')) {
            // Add missing columns if they don't exist
            Schema::table('promotions', function (Blueprint $table) {
                if (!Schema::hasColumn('promotions', 'image_path')) {
                    $table->string('image_path', 255)->nullable()->after('title');
                }
                if (!Schema::hasColumn('promotions', 'button_label')) {
                    $table->string('button_label', 100)->nullable()->after('image_path');
                }
                if (!Schema::hasColumn('promotions', 'button_link')) {
                    $table->string('button_link', 255)->nullable()->after('button_label');
                }
                if (!Schema::hasColumn('promotions', 'sort_order')) {
                    $table->integer('sort_order')->default(0)->after('is_active');
                }
            });
        } else {
            Schema::create('promotions', function (Blueprint $table) {
                $table->bigIncrements('id');

                $table->string('title', 255);
                $table->string('image_path', 255)->nullable();
                $table->string('button_label', 100)->nullable();
                $table->string('button_link', 255)->nullable();

                $table->timestamp('start_at')->nullable();
                $table->timestamp('end_at')->nullable();

                $table->boolean('is_active')->default(true);
                $table->integer('sort_order')->default(0);

                $table->timestamps();
            });
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('promotions');
    }
};
