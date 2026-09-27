<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        DB::table('payment_gateways')
            ->where('key', 'customer_balance')
            ->where('category', '!=', 'internal_wallet')
            ->update(['category' => 'internal_wallet']);
    }

    public function down(): void
    {
        // Category was corrected from a bad seed; do not restore external_gateway.
    }
};
