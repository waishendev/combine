<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\Storage;

class HomeSlider extends Model
{
    protected $fillable = [
        'title',
        'subtitle',
        'image_path',
        'mobile_image_path',
        'type',
        'button_label',
        'button_link',
        'content_align',
        'content_vertical',
        'button_align',
        'text_color',
        'button_style',
        'start_at',
        'end_at',
        'is_active',
        'sort_order',
    ];

    protected $casts = [
        'is_active' => 'boolean',
        'start_at' => 'datetime',
        'end_at' => 'datetime',
    ];

    protected $appends = [
        'image_url',
        'mobile_image_url',
    ];

    /**
     * Get the full URL for the image.
     * NEW ENHANCEMENT — home-sliders-query-v1: no Storage::exists (avoids FS per serialize).
     */
    public function getImageUrlAttribute(): ?string
    {
        return $this->resolvePublicUrl($this->image_path);
    }

    /**
     * Get the full URL for the mobile image.
     * NEW ENHANCEMENT — home-sliders-query-v1: no Storage::exists (avoids FS per serialize).
     */
    public function getMobileImageUrlAttribute(): ?string
    {
        return $this->resolvePublicUrl($this->mobile_image_path);
    }

    protected function resolvePublicUrl(?string $path): ?string
    {
        if (! $path) {
            return null;
        }

        if (filter_var($path, FILTER_VALIDATE_URL)) {
            return $path;
        }

        $normalizedPath = ltrim($path, '/');

        return Storage::disk('public')->url($normalizedPath);
    }
}
