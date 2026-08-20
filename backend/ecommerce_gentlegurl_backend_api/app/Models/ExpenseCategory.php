<?php
namespace App\Models;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
class ExpenseCategory extends Model { use HasFactory; protected $fillable=['store_location_id','name','description','sort_order','is_active']; protected $casts=['store_location_id'=>'integer','is_active'=>'boolean','sort_order'=>'integer']; public function storeLocation(){return $this->belongsTo(\App\Models\Ecommerce\StoreLocation::class);} public function expenses(){return $this->hasMany(Expense::class);} }
