<?php

namespace App\Models\Booking;

use App\Models\Ecommerce\StoreLocation;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Facades\Storage;

class BookingProduct extends Model
{
    use HasFactory;

    protected $fillable = [
        'name',
        'cn_name',
        'price',
        'price_mode',
        'price_range_min',
        'price_range_max',
        'barcode',
        'description',
        'image_path',
        'is_active',
    ];

    protected $appends = [
        'image_url',
    ];

    protected $casts = [
        'price' => 'decimal:2',
        'price_range_min' => 'decimal:2',
        'price_range_max' => 'decimal:2',
        'is_active' => 'boolean',
    ];

    public function questions()
    {
        return $this->hasMany(BookingProductQuestion::class, 'booking_product_id')->orderBy('sort_order')->orderBy('id');
    }

    public function activeQuestions()
    {
        return $this->questions()->where('is_active', true)->whereHas('options', fn ($query) => $query->where('is_active', true));
    }

    public function categories()
    {
        return $this->belongsToMany(BookingProductCategory::class, 'booking_product_category_product')
            ->withTimestamps();
    }

    public function linkedBookingService()
    {
        return $this->hasOne(BookingService::class, 'linked_booking_product_id');
    }

    public function storeLocations()
    {
        return $this->belongsToMany(StoreLocation::class, 'booking_product_store_location')->withTimestamps();
    }

    /**
     * The single source of truth for Booking Products shown by POS.
     *
     * Standalone products own their persisted Branch assignments. A linked
     * product's effective assignment is managed by its Booking Service.
     */
    public function scopePosEligibleAtBranch(Builder $query, int $storeLocationId): Builder
    {
        return $query
            ->where('booking_products.is_active', true)
            ->where(function (Builder $availability) use ($storeLocationId) {
                $availability->where(function (Builder $standalone) use ($storeLocationId) {
                    $standalone->whereDoesntHave('linkedBookingService')
                        ->whereHas('storeLocations', fn (Builder $locations) => $locations->whereKey($storeLocationId));
                })->orWhereHas(
                    'linkedBookingService.storeLocations',
                    fn (Builder $locations) => $locations->whereKey($storeLocationId)
                );
            });
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
