<?php

namespace App\Models\Booking;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\Storage;

class BookingServiceCategory extends Model
{
    protected $fillable = [
        'name', 'cn_name', 'slug', 'description', 'image_path', 'is_active', 'sort_order',
    ];

    protected $casts = [
        'is_active' => 'boolean',
        'sort_order' => 'integer',
    ];

    protected $appends = [
        'image_url',
    ];

    public function services()
    {
        return $this->hasMany(BookingService::class, 'category_id');
    }

    public function getImageUrlAttribute(): ?string
    {
        if (! $this->image_path) {
            return null;
        }

        if (filter_var($this->image_path, FILTER_VALIDATE_URL)) {
            return $this->image_path;
        }

        return Storage::disk('public')->url(ltrim($this->image_path, '/'));
    }
}
