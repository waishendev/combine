<?php

namespace App\Models\Ecommerce;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use DateTimeInterface;


class MembershipTierRule extends Model
{
    use HasFactory;

    protected $fillable = [
        'tier',
        'display_name',
        'description',
        'badge_image_path',
        'min_spent_last_x_months',
        'months_window',
        'multiplier',
        'product_discount_percent',
        'is_active',
        'sort_order',
    ];

    protected function casts(): array
    {
        return [
            'min_spent_last_x_months' => 'decimal:2',
            'months_window' => 'integer',
            'multiplier' => 'decimal:2',
            'product_discount_percent' => 'decimal:2',
            'is_active' => 'boolean',
            'sort_order' => 'integer',
        ];
    }

    /**
     * Prepare a date for array / JSON serialization.
     *
     * @param  \DateTimeInterface  $date
     * @return string
    */
    protected function serializeDate(DateTimeInterface $date)
    {
        return $date->format('Y-m-d H:i:s');
    }
}
