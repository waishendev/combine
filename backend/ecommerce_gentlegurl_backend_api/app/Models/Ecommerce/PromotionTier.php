<?php

namespace App\Models\Ecommerce;

use App\Models\Promotion;
use Illuminate\Database\Eloquent\Model;

class PromotionTier extends Model
{
    protected $fillable = [
        'promotion_id',
        'min_qty',
        'min_amount',
        'discount_type',
        'discount_value',
    ];

    protected function casts(): array
    {
        return [
            'min_qty' => 'integer',
            'min_amount' => 'decimal:2',
            'discount_value' => 'decimal:2',
        ];
    }

    public function promotion()
    {
        return $this->belongsTo(Promotion::class);
    }
}
