<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('permissions', function (Blueprint $table) {
            $table->bigIncrements('id');
            $table->unsignedBigInteger('group_id')->nullable();
            $table->string('name', 150)->unique();
            $table->string('slug', 150)->unique();
            $table->string('description', 255)->nullable();
            $table->timestamps();

            $table->foreign('group_id')
                ->references('id')
                ->on('permission_groups')
                ->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('permissions');
    }
};
