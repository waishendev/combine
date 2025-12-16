<?php

namespace App\Models\Ecommerce;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class PointsRedemption extends Model
{
    use HasFactory;

    protected $fillable = [
        'customer_id',
        'reward_id',
        'reward_type',
        'total_points_spent',
    ];

    protected function casts(): array
    {
        return [
            'total_points_spent' => 'integer',
        ];
    }

    public function customer()
    {
        return $this->belongsTo(Customer::class);
    }

    public function reward()
    {
        return $this->belongsTo(Reward::class);
    }

    public function items()
    {
        return $this->hasMany(PointsRedemptionItem::class, 'redemption_id');
    }
}
