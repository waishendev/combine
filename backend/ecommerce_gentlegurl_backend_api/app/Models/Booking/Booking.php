<?php

namespace App\Models\Booking;

use App\Models\Ecommerce\Customer;
use App\Models\Staff;
use Illuminate\Database\Eloquent\Model;

class Booking extends Model
{
    protected $fillable = [
        'booking_code', 'source', 'customer_id', 'guest_name', 'guest_phone', 'guest_email',
        'staff_id', 'service_id', 'start_at', 'end_at', 'buffer_min', 'status', 'deposit_amount',
        'payment_status', 'hold_expires_at', 'created_by_staff_id', 'cancelled_at', 'cancellation_type', 'notes',
        'reschedule_count', 'rescheduled_at', 'rescheduled_from_booking_id', 'reschedule_reason', 'notified_cancellation_voucher_id',
    ];

    protected $casts = [
        'start_at' => 'datetime',
        'end_at' => 'datetime',
        'hold_expires_at' => 'datetime',
        'cancelled_at' => 'datetime',
        'rescheduled_at' => 'datetime',
    ];

    public function service()
    {
        return $this->belongsTo(BookingService::class, 'service_id');
    }

    public function staff()
    {
        return $this->belongsTo(Staff::class, 'staff_id');
    }

    public function customer()
    {
        return $this->belongsTo(Customer::class, 'customer_id');
    }
}
