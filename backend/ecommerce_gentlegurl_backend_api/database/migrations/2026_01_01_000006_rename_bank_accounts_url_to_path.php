<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::table('bank_accounts', function (Blueprint $table) {
            $table->renameColumn('logo_url', 'logo_path');
            $table->renameColumn('qr_image_url', 'qr_image_path');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('bank_accounts', function (Blueprint $table) {
            $table->renameColumn('logo_path', 'logo_url');
            $table->renameColumn('qr_image_path', 'qr_image_url');
        });
    }
};

