<?php

namespace App\Models\Ecommerce;

use App\Models\User;
use Illuminate\Database\Eloquent\Model;

class PosCart extends Model
{
    protected $fillable = [
        'staff_user_id',
        'voucher_id',
        'customer_voucher_id',
        'voucher_code',
        'voucher_discount_amount',
        'voucher_snapshot',
    ];

    protected $casts = [
        'voucher_discount_amount' => 'decimal:2',
        'voucher_snapshot' => 'array',
    ];

    public function staffUser()
    {
        return $this->belongsTo(User::class, 'staff_user_id');
    }

    public function items()
    {
        return $this->hasMany(PosCartItem::class);
    }
}
