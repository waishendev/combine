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
        'quantity_total',
        'quantity_used',
        'source_redemption_id',
        'assigned_by_admin_id',
        'assigned_at',
        'status',
        'claimed_at',
        'used_at',
        'start_at',
        'end_at',
        'expires_at',
        'note',
        'meta',
    ];

    protected function casts(): array
    {
        return [
            'quantity_total' => 'integer',
            'quantity_used' => 'integer',
            'assigned_at' => 'datetime',
            'claimed_at' => 'datetime',
            'used_at' => 'datetime',
            'start_at' => 'datetime',
            'end_at' => 'datetime',
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
