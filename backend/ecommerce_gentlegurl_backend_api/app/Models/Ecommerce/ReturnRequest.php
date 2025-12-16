<?php

namespace App\Models\Ecommerce;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class ReturnRequest extends Model
{
    use HasFactory;

    protected $fillable = [
        'order_id',
        'customer_id',
        'request_type',
        'status',
        'reason',
        'description',
        'initial_image_urls',
        'admin_note',
        'return_courier_name',
        'return_tracking_no',
        'return_shipped_at',
        'reviewed_at',
        'received_at',
        'completed_at',
    ];

    protected $casts = [
        'initial_image_urls' => 'array',
        'return_shipped_at' => 'datetime',
        'reviewed_at' => 'datetime',
        'received_at' => 'datetime',
        'completed_at' => 'datetime',
    ];

    public function order()
    {
        return $this->belongsTo(Order::class);
    }

    public function customer()
    {
        return $this->belongsTo(Customer::class);
    }

    public function items()
    {
        return $this->hasMany(ReturnRequestItem::class);
    }
}
