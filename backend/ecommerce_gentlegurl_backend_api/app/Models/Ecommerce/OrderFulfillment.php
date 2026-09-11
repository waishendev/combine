<?php

namespace App\Models\Ecommerce;

use Illuminate\Database\Eloquent\Model;

class OrderFulfillment extends Model
{
    protected $table = 'ecommerce_order_fulfillments';
    protected $fillable = ['order_id', 'store_location_id', 'status'];

    public function order() { return $this->belongsTo(Order::class); }
    public function storeLocation() { return $this->belongsTo(StoreLocation::class); }
}
