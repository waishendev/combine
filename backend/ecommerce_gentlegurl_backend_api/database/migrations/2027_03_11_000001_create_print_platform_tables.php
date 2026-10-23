<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('print_devices', function (Blueprint $table) {
            $table->id();
            $table->uuid('uuid')->unique();
            $table->foreignId('store_location_id')->constrained('store_locations')->cascadeOnDelete();
            $table->string('name');
            $table->string('platform')->default('android');
            $table->string('status')->default('active');
            $table->string('app_version')->nullable();
            $table->string('installation_id_hash', 64)->nullable();
            $table->timestamp('last_seen_at')->nullable()->index();
            $table->string('last_seen_ip', 45)->nullable();
            $table->timestamp('paired_at')->nullable();
            $table->foreignId('paired_by_user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('revoked_at')->nullable();
            $table->foreignId('revoked_by_user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->string('revocation_reason')->nullable();
            $table->timestamps();
            $table->index(['store_location_id', 'status']);
        });

        Schema::create('print_device_pairing_codes', function (Blueprint $table) {
            $table->id();
            $table->foreignId('print_device_id')->constrained()->cascadeOnDelete();
            $table->string('code_hash', 64)->unique();
            $table->timestamp('expires_at')->index();
            $table->timestamp('consumed_at')->nullable();
            $table->string('consumed_ip', 45)->nullable();
            $table->unsignedSmallInteger('attempt_count')->default(0);
            $table->foreignId('created_by_user_id')->constrained('users')->cascadeOnDelete();
            $table->timestamps();
        });

        Schema::create('printers', function (Blueprint $table) {
            $table->id();
            $table->uuid('uuid')->unique();
            $table->foreignId('print_device_id')->constrained()->cascadeOnDelete();
            $table->string('name');
            $table->string('role')->default('receipt');
            $table->string('connection_type')->nullable();
            $table->text('configuration')->nullable();
            $table->json('capabilities')->nullable();
            $table->unsignedSmallInteger('paper_width')->nullable();
            $table->boolean('is_default')->default(false);
            $table->boolean('is_active')->default(false);
            $table->timestamps();
            $table->index(['print_device_id', 'role', 'is_active']);
        });

        Schema::create('print_jobs', function (Blueprint $table) {
            $table->ulid('id')->primary();
            $table->foreignId('store_location_id')->constrained('store_locations')->restrictOnDelete();
            $table->foreignId('print_device_id')->constrained()->restrictOnDelete();
            $table->foreignId('printer_id')->nullable()->constrained()->nullOnDelete();
            $table->string('type');
            $table->string('status')->default('pending');
            $table->unsignedSmallInteger('payload_schema_version')->default(1);
            $table->json('payload');
            $table->string('source_type')->nullable();
            $table->string('source_id')->nullable();
            $table->string('idempotency_key')->nullable();
            $table->unsignedSmallInteger('priority')->default(100);
            $table->timestamp('available_at')->index();
            $table->unsignedSmallInteger('attempt_count')->default(0);
            $table->unsignedSmallInteger('max_attempts')->default(3);
            $table->string('claim_token_hash', 64)->nullable();
            $table->timestamp('claimed_at')->nullable();
            $table->timestamp('lease_expires_at')->nullable()->index();
            $table->timestamp('processing_at')->nullable();
            $table->timestamp('completed_at')->nullable();
            $table->timestamp('failed_at')->nullable();
            $table->string('last_error_code')->nullable();
            $table->text('last_error_message')->nullable();
            $table->foreignId('created_by_user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->ulid('manually_retried_from_job_id')->nullable();
            $table->timestamps();
            $table->unique(['created_by_user_id', 'idempotency_key']);
            $table->index(['print_device_id', 'status', 'available_at']);
            $table->index(['store_location_id', 'created_at']);
        });

        Schema::create('print_job_attempts', function (Blueprint $table) {
            $table->id();
            $table->foreignUlid('print_job_id')->constrained('print_jobs')->cascadeOnDelete();
            $table->foreignId('print_device_id')->constrained()->restrictOnDelete();
            $table->uuid('claim_id')->unique();
            $table->unsignedSmallInteger('attempt_number');
            $table->string('status')->default('claimed');
            $table->timestamp('claimed_at');
            $table->timestamp('started_at')->nullable();
            $table->timestamp('finished_at')->nullable();
            $table->timestamp('lease_expires_at');
            $table->string('result_code')->nullable();
            $table->text('error_message')->nullable();
            $table->json('metadata')->nullable();
            $table->timestamps();
            $table->unique(['print_job_id', 'attempt_number']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('print_job_attempts');
        Schema::dropIfExists('print_jobs');
        Schema::dropIfExists('printers');
        Schema::dropIfExists('print_device_pairing_codes');
        Schema::dropIfExists('print_devices');
    }
};
