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
    ];

    protected $appends = [
        'image_url',
        'mobile_image_url',
    ];

    /**
     * Get the full URL for the image
     */
    public function getImageUrlAttribute(): ?string
    {
        if (!$this->image_path) {
            return null;
        }

        // If it's already a full URL, return it as is
        if (filter_var($this->image_path, FILTER_VALIDATE_URL)) {
            return $this->image_path;
        }

        // If it's a storage path, return the full URL
        if (Storage::disk('public')->exists($this->image_path)) {
            return Storage::disk('public')->url($this->image_path);
        }

        // Fallback: construct URL manually
        return url('storage/' . $this->image_path);
    }

    /**
     * Get the full URL for the mobile image
     */
    public function getMobileImageUrlAttribute(): ?string
    {
        if (!$this->mobile_image_path) {
            return null;
        }

        // If it's already a full URL, return it as is
        if (filter_var($this->mobile_image_path, FILTER_VALIDATE_URL)) {
            return $this->mobile_image_path;
        }

        // If it's a storage path, return the full URL
        if (Storage::disk('public')->exists($this->mobile_image_path)) {
            return Storage::disk('public')->url($this->mobile_image_path);
        }

        // Fallback: construct URL manually
        return url('storage/' . $this->mobile_image_path);
    }
}
