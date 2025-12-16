<?php

namespace App\Models;

use App\Models\Ecommerce\Order;
use Illuminate\Database\Eloquent\Model;

class BillplzBill extends Model
{
    protected $fillable = [
        'order_id',
        'billplz_id',
        'collection_id',
        'state',
        'paid',
        'amount',
        'paid_at',
        'payload',
    ];

    protected $casts = [
        'paid' => 'boolean',
        'paid_at' => 'datetime',
        'payload' => 'array',
    ];

    public function order()
    {
        return $this->belongsTo(Order::class);
    }
}
