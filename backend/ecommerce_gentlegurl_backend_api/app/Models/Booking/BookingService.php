<?php

namespace App\Models\Booking;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\Storage;

class BookingService extends Model
{
    protected $fillable = [
        'name', 'service_type', 'description', 'image_path', 'service_price', 'price', 'is_package_eligible', 'duration_min', 'deposit_amount', 'buffer_min', 'is_active', 'rules_json',
    ];

    protected $appends = [
        'image_url',
    ];

    protected $casts = [
        'rules_json' => 'array',
        'is_active' => 'boolean',
        'service_type' => 'string',
        'is_package_eligible' => 'boolean',
        'service_price' => 'decimal:2',
        'price' => 'decimal:2',
    ];

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
