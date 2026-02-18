<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        DB::statement('ALTER TABLE pos_cart_items ALTER COLUMN variant_id DROP NOT NULL');
    }

    public function down(): void
    {
        DB::statement('ALTER TABLE pos_cart_items ALTER COLUMN variant_id SET NOT NULL');
    }
};
