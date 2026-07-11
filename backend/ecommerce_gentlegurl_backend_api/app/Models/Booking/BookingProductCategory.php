<?php

namespace App\Models\Booking;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class BookingProductCategory extends Model
{
    use HasFactory;

    protected $fillable = ['name', 'cn_name', 'sort_order', 'is_active', 'show_in_pos_filter'];

    protected $casts = [
        'sort_order' => 'integer',
        'is_active' => 'boolean',
        'show_in_pos_filter' => 'boolean',
    ];

    public function products()
    {
        return $this->belongsToMany(BookingProduct::class, 'booking_product_category_product')
            ->withTimestamps();
    }
}
