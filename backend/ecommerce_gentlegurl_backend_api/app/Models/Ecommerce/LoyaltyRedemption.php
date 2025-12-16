<?php

namespace App\Models\Ecommerce;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class LoyaltyRedemption extends Model
{
    use HasFactory;

    protected $fillable = [
        'customer_id',
        'reward_id',
        'points_spent',
        'status',
        'reward_title_snapshot',
        'points_required_snapshot',
        'meta',
    ];

    protected function casts(): array
    {
        return [
            'points_spent' => 'integer',
            'points_required_snapshot' => 'integer',
            'meta' => 'array',
        ];
    }

    public function customer()
    {
        return $this->belongsTo(Customer::class);
    }

    public function reward()
    {
        return $this->belongsTo(LoyaltyReward::class, 'reward_id');
    }
}
