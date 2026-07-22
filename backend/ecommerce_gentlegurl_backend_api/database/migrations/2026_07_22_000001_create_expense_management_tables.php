<?php
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
return new class extends Migration {
 public function up(): void {
  Schema::create('expense_categories', function (Blueprint $table) { $table->bigIncrements('id'); $table->string('name',100)->unique(); $table->text('description')->nullable(); $table->unsignedInteger('sort_order')->default(0); $table->boolean('is_active')->default(true)->index(); $table->timestamps(); });
  Schema::create('expenses', function (Blueprint $table) { $table->bigIncrements('id'); $table->string('expense_no',32)->unique(); $table->foreignId('expense_category_id')->constrained('expense_categories')->restrictOnDelete(); $table->date('expense_date')->index(); $table->string('title',150); $table->decimal('amount',12,2); $table->text('remark')->nullable(); $table->string('receipt_path')->nullable(); $table->foreignId('created_by')->constrained('users')->restrictOnDelete(); $table->foreignId('updated_by')->nullable()->constrained('users')->nullOnDelete(); $table->timestamps(); $table->softDeletes(); $table->index(['expense_date','expense_category_id']); });
 }
 public function down(): void { Schema::dropIfExists('expenses'); Schema::dropIfExists('expense_categories'); }
};
