<?php

namespace App\Models\Booking;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class BookingProductQuestion extends Model
{
    use HasFactory;

    protected $fillable = [
        'booking_product_id',
        'title',
        'cn_title',
        'description',
        'cn_description',
        'question_type',
        'sort_order',
        'is_required',
        'is_active',
    ];

    protected function casts(): array
    {
        return [
            'sort_order' => 'integer',
            'is_required' => 'boolean',
            'is_active' => 'boolean',
        ];
    }

    public function bookingProduct()
    {
        return $this->belongsTo(BookingProduct::class, 'booking_product_id');
    }

    public function options()
    {
        return $this->hasMany(BookingProductQuestionOption::class, 'booking_product_question_id')->orderBy('sort_order')->orderBy('id');
    }
}
