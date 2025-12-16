<?php

namespace App\Models\Ecommerce;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class PointsRedemptionItem extends Model
{
    use HasFactory;

    protected $fillable = [
        'redemption_id',
        'earn_batch_id',
        'points_used',
    ];

    protected function casts(): array
    {
        return [
            'points_used' => 'integer',
        ];
    }

    public function redemption()
    {
        return $this->belongsTo(PointsRedemption::class, 'redemption_id');
    }

    public function earnBatch()
    {
        return $this->belongsTo(PointsEarnBatch::class, 'earn_batch_id');
    }
}
