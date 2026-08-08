<?php

namespace App\Models\Ecommerce;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use App\Models\User;
use App\Models\Staff;
use App\Models\Booking\BookingService;
use Illuminate\Database\Eloquent\Model;
use DateTimeInterface;

class StoreLocation extends Model
{
    use HasFactory;

    protected static function booted(): void
    {
        static::updating(function (StoreLocation $location): void {
            if ($location->isDirty('code')) {
                throw new \LogicException('Branch code is immutable after creation.');
            }
        });
    }

    protected $fillable = [
        'name',
        'code',
        'address_line1',
        'address_line2',
        'city',
        'state',
        'postcode',
        'country',
        'phone',
        'is_active',
        'is_pickup_available',
        'is_review_available',
        'is_booking_available',
        'is_pos_available',
        'sort_order',
        'opening_hours',
    ];

    protected function casts(): array
    {
        return [
            'is_active' => 'boolean',
            'is_pickup_available' => 'boolean',
            'is_review_available' => 'boolean',
            'is_booking_available' => 'boolean',
            'is_pos_available' => 'boolean',
            'sort_order' => 'integer',
            'opening_hours' => 'array',
        ];
    }

    public function images()
    {
        return $this->hasMany(StoreLocationImage::class)->orderBy('sort_order')->orderBy('id');
    }

    public function users()
    {
        return $this->belongsToMany(User::class, 'store_location_user')
            ->withTimestamps();
    }

    public function staffs()
    {
        return $this->belongsToMany(Staff::class, 'staff_store_location')->withTimestamps();
    }

    public function bookingServices()
    {
        return $this->belongsToMany(BookingService::class, 'booking_service_store_location')->withTimestamps();
    }

    public function products()
    {
        return $this->belongsToMany(Product::class, 'store_location_product')
            ->withPivot('is_available')->withTimestamps();
    }

    public function productInventories()
    {
        return $this->hasMany(StoreLocationProductInventory::class);
    }

    /**
     * Prepare a date for array / JSON serialization.
     *
     * @param  \DateTimeInterface  $date
     * @return string
     */
    protected function serializeDate(DateTimeInterface $date)
    {
        return $date->format('Y-m-d H:i:s');
    }
}
