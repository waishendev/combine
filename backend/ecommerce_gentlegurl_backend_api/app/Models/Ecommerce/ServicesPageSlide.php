<?php

namespace App\Models\Ecommerce;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Facades\Storage;

class ServicesPageSlide extends Model
{
    use HasFactory;

    protected $fillable = [
        'services_page_id',
        'sort_order',
        'image_path',
        'mobile_image_path',
        'title',
        'description',
        'button_label',
        'button_link',
    ];

    protected $casts = [
        'sort_order' => 'integer',
    ];

    protected $appends = [
        'image_url',
        'mobile_image_url',
    ];

    public function page(): BelongsTo
    {
        return $this->belongsTo(ServicesPage::class, 'services_page_id');
    }

    public function getImageUrlAttribute(): ?string
    {
        if (!$this->image_path) {
            return null;
        }

        if (filter_var($this->image_path, FILTER_VALIDATE_URL)) {
            return $this->image_path;
        }

        $normalizedPath = ltrim($this->image_path, '/');

        if (Storage::disk('public')->exists($normalizedPath)) {
            return Storage::disk('public')->url($normalizedPath);
        }

        return url('storage/' . $normalizedPath);
    }

    public function getMobileImageUrlAttribute(): ?string
    {
        if (!$this->mobile_image_path) {
            return null;
        }

        if (filter_var($this->mobile_image_path, FILTER_VALIDATE_URL)) {
            return $this->mobile_image_path;
        }

        $normalizedPath = ltrim($this->mobile_image_path, '/');

        if (Storage::disk('public')->exists($normalizedPath)) {
            return Storage::disk('public')->url($normalizedPath);
        }

        return url('storage/' . $normalizedPath);
    }
}
