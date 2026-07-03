<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('booking_services', function (Blueprint $table) {
            if (! Schema::hasColumn('booking_services', 'category_id')) {
                $table->unsignedBigInteger('category_id')->nullable()->after('id');
                $table->index('category_id');
            }
        });

        if (Schema::hasTable('booking_service_category_service')) {
            $rows = DB::table('booking_service_category_service')
                ->select('booking_service_id', 'booking_service_category_id')
                ->orderBy('booking_service_id')
                ->orderBy('booking_service_category_id')
                ->get()
                ->groupBy('booking_service_id');

            foreach ($rows as $serviceId => $serviceRows) {
                $categoryIds = $serviceRows->pluck('booking_service_category_id')->filter()->unique()->values();
                if ($categoryIds->isEmpty()) {
                    continue;
                }

                if ($categoryIds->count() > 1) {
                    echo sprintf(
                        "Warning: booking service %s has multiple categories (%s); using first category %s.\n",
                        $serviceId,
                        $categoryIds->implode(', '),
                        $categoryIds->first()
                    );
                }

                DB::table('booking_services')
                    ->where('id', $serviceId)
                    ->whereNull('category_id')
                    ->update(['category_id' => $categoryIds->first()]);
            }
        }

        Schema::table('booking_services', function (Blueprint $table) {
            if (Schema::hasColumn('booking_services', 'category_id')) {
                $table->foreign('category_id')->references('id')->on('booking_service_categories')->nullOnDelete();
            }
        });
    }

    public function down(): void
    {
        Schema::table('booking_services', function (Blueprint $table) {
            if (Schema::hasColumn('booking_services', 'category_id')) {
                $table->dropForeign(['category_id']);
                $table->dropIndex(['category_id']);
                $table->dropColumn('category_id');
            }
        });
    }
};
