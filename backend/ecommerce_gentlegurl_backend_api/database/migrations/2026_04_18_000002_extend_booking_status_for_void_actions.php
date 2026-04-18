<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration {
    public function up(): void
    {
        DB::statement("ALTER TYPE bookings_status_enum ADD VALUE IF NOT EXISTS 'VOIDED'");
        DB::statement("ALTER TYPE booking_payments_status_enum ADD VALUE IF NOT EXISTS 'VOIDED'");
    }

    public function down(): void
    {
        // Enum value removal is intentionally omitted for PostgreSQL safety.
    }
};
