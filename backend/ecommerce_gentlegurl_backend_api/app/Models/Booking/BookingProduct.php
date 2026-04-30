<?php

namespace App\Models\Booking;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class BookingProduct extends Model
{
    use HasFactory;

    protected $fillable = [
        'name',
        'price',
        'barcode',
        'description',
        'image_path',
        'category_id',
        'is_active',
    ];

    public function category()
    {
        return $this->belongsTo(BookingProductCategory::class, 'category_id');
    }

    protected $casts = [
        'price' => 'decimal:2',
        'is_active' => 'boolean',
    ];
}
