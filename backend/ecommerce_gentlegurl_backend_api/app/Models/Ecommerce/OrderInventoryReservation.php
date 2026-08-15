<?php

namespace App\Models\Ecommerce;

use Illuminate\Database\Eloquent\Model;

class OrderInventoryReservation extends Model
{
    protected $fillable = [
        'order_id', 'store_location_id', 'product_id', 'product_variant_id',
        'quantity', 'status', 'idempotency_key', 'expires_at', 'released_at',
    ];

    protected $casts = ['quantity' => 'integer', 'expires_at' => 'datetime', 'released_at' => 'datetime'];
}
