<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::table('booking_services', function (Blueprint $table) {
            if (! Schema::hasColumn('booking_services', 'allow_photo_upload')) {
                $table->boolean('allow_photo_upload')->default(false)->after('is_package_eligible');
            }
        });

        Schema::create('booking_item_photos', function (Blueprint $table) {
            $table->id();
            $table->foreignId('booking_cart_item_id')->nullable()->constrained('booking_cart_items')->nullOnDelete();
            $table->foreignId('booking_id')->nullable()->constrained('bookings')->cascadeOnDelete();
            $table->string('file_path');
            $table->string('original_name');
            $table->string('mime_type', 120);
            $table->unsignedBigInteger('size');
            $table->unsignedSmallInteger('sort_order')->default(0);
            $table->timestamps();

            $table->index(['booking_cart_item_id', 'sort_order']);
            $table->index(['booking_id', 'sort_order']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('booking_item_photos');

        Schema::table('booking_services', function (Blueprint $table) {
            if (Schema::hasColumn('booking_services', 'allow_photo_upload')) {
                $table->dropColumn('allow_photo_upload');
            }
        });
    }
};
