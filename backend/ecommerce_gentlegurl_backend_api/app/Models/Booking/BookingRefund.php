<?php

namespace App\Models\Booking;

use App\Models\Ecommerce\Order;
use App\Models\Ecommerce\ReturnRequest;
use App\Models\User;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class BookingRefund extends Model
{
    protected $fillable = [
        'booking_id',
        'order_id',
        'return_request_id',
        'refund_no',
        'mutation_key',
        'amount',
        'method',
        'channel',
        'reason',
        'status',
        'processed_by',
        'processed_at',
        'remark',
    ];

    protected $casts = [
        'amount' => 'decimal:2',
        'processed_at' => 'datetime',
    ];

    public function booking(): BelongsTo
    {
        return $this->belongsTo(Booking::class);
    }

    public function order(): BelongsTo
    {
        return $this->belongsTo(Order::class);
    }

    public function returnRequest(): BelongsTo
    {
        return $this->belongsTo(ReturnRequest::class);
    }

    public function processor(): BelongsTo
    {
        return $this->belongsTo(User::class, 'processed_by');
    }
}
