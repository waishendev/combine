<?php

namespace App\Models\Ecommerce;

use Illuminate\Database\Eloquent\Factories\HasFactory;
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
