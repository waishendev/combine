<?php

namespace App\Models\Ecommerce;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class PointsEarnBatch extends Model
{
    use HasFactory;

    protected $fillable = [
        'customer_id',
        'points_total',
        'points_remaining',
        'source_type',
        'source_id',
        'earned_at',
        'expires_at',
        'status',
    ];

    protected function casts(): array
    {
        return [
            'points_total' => 'integer',
            'points_remaining' => 'integer',
            'earned_at' => 'datetime',
            'expires_at' => 'datetime',
        ];
    }

    public function customer()
    {
        return $this->belongsTo(Customer::class);
    }
}
