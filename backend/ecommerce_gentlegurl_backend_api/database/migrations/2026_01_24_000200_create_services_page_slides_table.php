<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('services_page_slides', function (Blueprint $table) {
            $table->bigIncrements('id');
            $table->foreignId('services_page_id')
                ->constrained('services_pages')
                ->cascadeOnDelete();
            $table->unsignedInteger('sort_order')->default(1);
            $table->string('desktop_src', 255);
            $table->string('mobile_src', 255)->nullable();
            $table->string('alt', 255);
            $table->string('title', 255)->nullable();
            $table->text('description')->nullable();
            $table->string('button_label', 255)->nullable();
            $table->string('button_href', 255)->nullable();
            $table->timestamps();

            $table->index(['services_page_id', 'sort_order']);
        });

        $pages = DB::table('services_pages')->select(['id', 'hero_slides'])->get();

        foreach ($pages as $page) {
            $slides = json_decode($page->hero_slides ?? '[]', true);
            if (! is_array($slides) || empty($slides)) {
                continue;
            }

            $records = [];
            foreach (array_values($slides) as $index => $slide) {
                if (! is_array($slide) || empty($slide['src']) || empty($slide['alt'])) {
                    continue;
                }

                $records[] = [
                    'services_page_id' => $page->id,
                    'sort_order' => (int) ($slide['sort_order'] ?? $index + 1),
                    'desktop_src' => $slide['src'],
                    'mobile_src' => $slide['mobileSrc'] ?? null,
                    'alt' => $slide['alt'],
                    'title' => $slide['title'] ?? null,
                    'description' => $slide['description'] ?? ($slide['subtitle'] ?? null),
                    'button_label' => $slide['buttonLabel'] ?? null,
                    'button_href' => $slide['buttonHref'] ?? null,
                    'created_at' => now(),
                    'updated_at' => now(),
                ];
            }

            if (! empty($records)) {
                DB::table('services_page_slides')->insert($records);
            }
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('services_page_slides');
    }
};
