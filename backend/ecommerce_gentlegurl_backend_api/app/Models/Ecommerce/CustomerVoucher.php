<?php

namespace App\Models\Ecommerce;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class CustomerVoucher extends Model
{
    use HasFactory;

    protected $fillable = [
        'customer_id',
        'voucher_id',
        'source_redemption_id',
        'status',
        'claimed_at',
        'used_at',
        'expires_at',
        'meta',
    ];

    protected function casts(): array
    {
        return [
            'claimed_at' => 'datetime',
            'used_at' => 'datetime',
            'expires_at' => 'datetime',
            'meta' => 'array',
        ];
    }

    public function customer()
    {
        return $this->belongsTo(Customer::class);
    }

    public function voucher()
    {
        return $this->belongsTo(Voucher::class);
    }

    public function redemption()
    {
        return $this->belongsTo(LoyaltyRedemption::class, 'source_redemption_id');
    }
}
