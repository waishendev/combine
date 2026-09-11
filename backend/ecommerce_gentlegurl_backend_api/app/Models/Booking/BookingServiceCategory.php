<?php

namespace App\Models\Booking;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Facades\Storage;

class BookingServiceCategory extends Model
{
    protected $fillable = [
        'linked_booking_product_category_id', 'name', 'cn_name', 'slug', 'description', 'image_path', 'is_active', 'show_in_pos_filter', 'sort_order',
    ];

    protected $casts = [
        'is_active' => 'boolean',
        'show_in_pos_filter' => 'boolean',
        'sort_order' => 'integer',
    ];

    protected $appends = [
        'image_url',
    ];

    public function linkedBookingProductCategory()
    {
        return $this->belongsTo(BookingProductCategory::class, 'linked_booking_product_category_id');
    }

    public function services()
    {
        return $this->belongsToMany(
            BookingService::class,
            'booking_service_category_service',
            'booking_service_category_id',
            'booking_service_id',
        )->withTimestamps();
    }

    /**
     * Categories remain global identities; operational visibility is derived from
     * their active Services' authoritative Branch assignments.
     */
    public function scopeVisibleAtBranch(Builder $query, int $storeLocationId): Builder
    {
        return $query
            ->where('is_active', true)
            ->whereHas('services', fn (Builder $services) => $services->eligibleAtBranch($storeLocationId));
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
