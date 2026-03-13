<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Promotion extends Model
{
    protected $fillable = [
        'title',
        'name',
        'code',
        'description',
        'promotion_type',
        'trigger_type',
        'priority',
        'starts_at',
        'ends_at',
        'image_path',
        'button_label',
        'button_link',
        'start_at',
        'end_at',
        'is_active',
        'sort_order',
    ];

    protected $casts = [
        'is_active' => 'boolean',
        'start_at' => 'datetime',
        'end_at' => 'datetime',
        'starts_at' => 'datetime',
        'ends_at' => 'datetime',
    ];

    public function promotionProducts()
    {
        return $this->hasMany(\App\Models\Ecommerce\PromotionProduct::class);
    }

    public function promotionTiers()
    {
        return $this->hasMany(\App\Models\Ecommerce\PromotionTier::class);
    }

    public function scopeActive($query)
    {
        return $query->where('is_active', true);
    }

    public function scopeCurrent($query)
    {
        $now = now();

        return $query->where(function ($q) use ($now) {
            $q->whereNull('start_at')->orWhere('start_at', '<=', $now);
        })->where(function ($q) use ($now) {
            $q->whereNull('end_at')->orWhere('end_at', '>=', $now);
        });
    }
}
