<?php

namespace App\Models\Booking;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;

class BookingCart extends Model
{
    use HasUuids;

    public $incrementing = false;
    protected $keyType = 'string';

    protected $fillable = ['customer_id', 'guest_token', 'status'];

    public function items()
    {
        return $this->hasMany(BookingCartItem::class, 'booking_cart_id');
    }
}
