<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('product_media', function (Blueprint $table) {
            $table->bigIncrements('id');
            $table->foreignId('product_id')->constrained('products')->cascadeOnDelete();
            $table->string('type', 20);
            $table->string('disk', 50)->default('public');
            $table->string('path', 255);
            $table->string('thumbnail_path', 255)->nullable();
            $table->integer('sort_order')->default(0);
            $table->string('mime_type', 100);
            $table->unsignedBigInteger('size_bytes')->default(0);
            $table->unsignedInteger('width')->nullable();
            $table->unsignedInteger('height')->nullable();
            $table->unsignedDecimal('duration_seconds', 8, 2)->nullable();
            $table->string('status', 20)->default('ready');
            $table->timestamps();

            $table->index(['product_id', 'type']);
        });

        if (Schema::hasTable('product_images')) {
            $images = DB::table('product_images')
                ->orderBy('product_id')
                ->orderByDesc('is_main')
                ->orderBy('sort_order')
                ->orderBy('id')
                ->get();

            $currentProduct = null;
            $sortOrder = 0;

            foreach ($images as $image) {
                if ($currentProduct !== $image->product_id) {
                    $currentProduct = $image->product_id;
                    $sortOrder = 0;
                }

                $extension = strtolower(pathinfo((string) $image->image_path, PATHINFO_EXTENSION));
                $mimeType = match ($extension) {
                    'png' => 'image/png',
                    'webp' => 'image/webp',
                    'gif' => 'image/gif',
                    default => 'image/jpeg',
                };

                DB::table('product_media')->insert([
                    'product_id' => $image->product_id,
                    'type' => 'image',
                    'disk' => 'public',
                    'path' => $image->image_path,
                    'thumbnail_path' => null,
                    'sort_order' => $sortOrder,
                    'mime_type' => $mimeType,
                    'size_bytes' => 0,
                    'width' => null,
                    'height' => null,
                    'duration_seconds' => null,
                    'status' => 'ready',
                    'created_at' => $image->created_at,
                    'updated_at' => $image->updated_at,
                ]);

                $sortOrder++;
            }
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('product_media');
    }
};
