<?php

namespace App\Models\Ecommerce;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class LoyaltyReward extends Model
{
    use HasFactory;

    protected $fillable = [
        'title',
        'description',
        'type',
        'points_required',
        'product_id',
        'voucher_id',
        'quota_total',
        'quota_used',
        'is_active',
        'sort_order',
    ];

    protected function casts(): array
    {
        return [
            'points_required' => 'integer',
            'quota_total' => 'integer',
            'quota_used' => 'integer',
            'is_active' => 'boolean',
        ];
    }

    public function product()
    {
        return $this->belongsTo(Product::class);
    }

    public function voucher()
    {
        return $this->belongsTo(Voucher::class);
    }

    public function redemptions()
    {
        return $this->hasMany(LoyaltyRedemption::class, 'reward_id');
    }
}
