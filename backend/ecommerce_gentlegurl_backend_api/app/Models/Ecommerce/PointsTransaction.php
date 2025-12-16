<?php

namespace App\Models\Ecommerce;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class PointsTransaction extends Model
{
    use HasFactory;

    protected $fillable = [
        'customer_id',
        'type',
        'points_change',
        'source_type',
        'source_id',
        'meta',
    ];

    protected function casts(): array
    {
        return [
            'points_change' => 'integer',
            'meta' => 'array',
        ];
    }

    public function customer()
    {
        return $this->belongsTo(Customer::class);
    }
}
