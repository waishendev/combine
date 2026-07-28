<?php

namespace App\Models\Ecommerce;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class LoyaltySetting extends Model
{
    use HasFactory;

    protected $fillable = [
        'base_multiplier',
        'ecommerce_earning_rate', 'ecommerce_redemption_enabled', 'ecommerce_point_value_sen', 'ecommerce_max_redemption_percent',
        'booking_earning_rate', 'booking_redemption_enabled', 'booking_point_value_sen', 'booking_max_redemption_percent',
        'expiry_months',
        'evaluation_cycle_months',
        'rules_effective_at',
    ];

    protected function casts(): array
    {
        return [
            'base_multiplier' => 'decimal:2',
            'ecommerce_earning_rate' => 'decimal:2',
            'ecommerce_redemption_enabled' => 'boolean',
            'ecommerce_max_redemption_percent' => 'decimal:2',
            'booking_earning_rate' => 'decimal:2',
            'booking_redemption_enabled' => 'boolean',
            'booking_max_redemption_percent' => 'decimal:2',
            'rules_effective_at' => 'date',
        ];
    }

    public static function active(): ?self
    {
        return static::query()->where(fn ($q) => $q->whereNull('rules_effective_at')->orWhereDate('rules_effective_at', '<=', now()))
            ->orderByDesc('rules_effective_at')->orderByDesc('created_at')->first();
    }
}
