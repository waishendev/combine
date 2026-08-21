<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * The lightweight calendar feed always authorizes/scopes by Branch, applies
     * a start_at range, then orders by start_at and id. Existing indexes cover
     * staff/status/customer ranges but not this primary Branch access path.
     */
    public function up(): void
    {
        Schema::table('bookings', function (Blueprint $table) {
            $table->index(
                ['store_location_id', 'start_at', 'id'],
                'bookings_store_start_id_calendar_index'
            );
        });
    }

    public function down(): void
    {
        Schema::table('bookings', function (Blueprint $table) {
            $table->dropIndex('bookings_store_start_id_calendar_index');
        });
    }
};
