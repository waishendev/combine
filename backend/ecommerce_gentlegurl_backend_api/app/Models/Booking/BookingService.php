<?php

namespace App\Models\Booking;

use App\Models\Staff;
use App\Traits\LogsActivity;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\Storage;

class BookingService extends Model
{
    use LogsActivity;

    protected $fillable = [
        'category_id', 'name', 'cn_name', 'service_type', 'description', 'image_path', 'linked_booking_product_id', 'service_price', 'price', 'price_mode', 'price_range_min', 'price_range_max', 'is_package_eligible', 'allow_photo_upload', 'duration_min', 'deposit_amount', 'buffer_min', 'is_active', 'rules_json',
    ];

    protected $appends = [
        'image_url',
    ];

    protected $casts = [
        'rules_json' => 'array',
        'is_active' => 'boolean',
        'service_type' => 'string',
        'is_package_eligible' => 'boolean',
        'allow_photo_upload' => 'boolean',
        'service_price' => 'decimal:2',
        'price' => 'decimal:2',
        'price_mode' => 'string',
        'price_range_min' => 'decimal:2',
        'price_range_max' => 'decimal:2',
    ];



    public function questions()
    {
        return $this->hasMany(BookingServiceQuestion::class, 'booking_service_id')
            ->orderBy('sort_order')
            ->orderBy('id');
    }

    public function category()
    {
        return $this->belongsTo(BookingServiceCategory::class, 'category_id');
    }

    public function primarySlots()
    {
        return $this->hasMany(BookingServicePrimarySlot::class, 'booking_service_id')->orderBy('sort_order')->orderBy('start_time');
    }

    public function allowedStaffs()
    {
        return $this->belongsToMany(Staff::class, 'booking_service_staff', 'service_id', 'staff_id')
            ->withTimestamps()
            ->wherePivot('is_active', true);
    }

    public function linkedBookingProduct()
    {
        return $this->belongsTo(BookingProduct::class, 'linked_booking_product_id');
    }

    public function isStaffAllowed(int $staffId): bool
    {
        return $this->allowedStaffs()->where('staffs.id', $staffId)->exists();
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
