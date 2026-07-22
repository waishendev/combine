<?php
namespace App\Models;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Support\Facades\Storage;
class Expense extends Model { use HasFactory,SoftDeletes; protected $fillable=['expense_no','expense_category_id','expense_date','title','amount','remark','receipt_path','created_by','updated_by']; protected $casts=['expense_date'=>'date','amount'=>'decimal:2']; protected $appends=['receipt_url']; public function category(){return $this->belongsTo(ExpenseCategory::class,'expense_category_id');} public function creator(){return $this->belongsTo(User::class,'created_by');} public function updater(){return $this->belongsTo(User::class,'updated_by');} public function getReceiptUrlAttribute(){return $this->receipt_path ? Storage::disk('public')->url($this->receipt_path) : null;} }
