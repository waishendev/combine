<?php

namespace App\Models\Booking;

use App\Models\Ecommerce\Customer;
use App\Models\Ecommerce\Order;
use App\Models\User;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Carbon;

class BookingPaymentLink extends Model
{
    protected $fillable = [
        'booking_id',
        'token',
        'purpose',
        'amount',
        'status',
        'provider',
        'payment_ref',
        'order_id',
        'booking_payment_id',
        'manual_slip_path',
        'manual_slip_url',
        'manual_review_status',
        'payer_customer_id',
        'payer_name',
        'payer_phone',
        'payer_email',
        'paid_at',
        'expires_at',
        'created_by',
        'cancelled_by',
        'cancelled_at',
        'notes',
    ];

    protected $casts = [
        'amount' => 'decimal:2',
        'paid_at' => 'datetime',
        'expires_at' => 'datetime',
        'cancelled_at' => 'datetime',
    ];

    public function booking()
    {
        return $this->belongsTo(Booking::class, 'booking_id');
    }

    public function order()
    {
        return $this->belongsTo(Order::class, 'order_id');
    }

    public function createdBy()
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    public function payerCustomer()
    {
        return $this->belongsTo(Customer::class, 'payer_customer_id');
    }

    public function isExpired(): bool
    {
        return $this->expires_at !== null && Carbon::parse($this->expires_at)->isPast();
    }

    /**
     * A link can accept a (new) payment attempt only while it is PENDING and not expired.
     */
    public function isPayable(): bool
    {
        return $this->status === 'PENDING' && ! $this->isExpired();
    }
}
