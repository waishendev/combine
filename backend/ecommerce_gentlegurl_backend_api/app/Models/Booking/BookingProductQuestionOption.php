<?php

namespace App\Models\Booking;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class BookingProductQuestionOption extends Model
{
    use HasFactory;

    protected $fillable = [
        'booking_product_question_id',
        'label',
        'cn_label',
        'extra_price',
        'sort_order',
        'is_active',
    ];

    protected function casts(): array
    {
        return [
            'extra_price' => 'decimal:2',
            'sort_order' => 'integer',
            'is_active' => 'boolean',
        ];
    }
}
