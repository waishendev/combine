<?php

namespace App\Models\Booking;

use App\Models\Ecommerce\Customer;
use Illuminate\Database\Eloquent\Model;

class CustomerBookingContact extends Model
{
    protected $fillable = [
        'customer_id',
        'name',
        'phone',
        'email',
        'is_default',
    ];

    protected $casts = [
        'is_default' => 'boolean',
    ];

    public function customer()
    {
        return $this->belongsTo(Customer::class, 'customer_id');
    }
}
