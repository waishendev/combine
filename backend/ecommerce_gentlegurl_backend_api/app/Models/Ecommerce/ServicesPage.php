<?php

namespace App\Models\Ecommerce;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ServicesPage extends Model
{
    use HasFactory;

    protected $fillable = [
        'services_menu_item_id',
        'title',
        'slug',
        'subtitle',
        'hero_slides',
        'sections',
        'is_active',
    ];

    protected $casts = [
        'hero_slides' => 'array',
        'sections' => 'array',
        'is_active' => 'boolean',
    ];

    public function menuItem(): BelongsTo
    {
        return $this->belongsTo(ServicesMenuItem::class, 'services_menu_item_id');
    }
}
