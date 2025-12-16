<?php

namespace App\Models\Ecommerce;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class ReturnRequestItem extends Model
{
    use HasFactory;

    protected $fillable = [
        'return_request_id',
        'order_item_id',
        'quantity',
    ];

    public function request()
    {
        return $this->belongsTo(ReturnRequest::class, 'return_request_id');
    }

    public function orderItem()
    {
        return $this->belongsTo(OrderItem::class);
    }
}
