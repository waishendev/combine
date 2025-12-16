<?php

namespace App\Models\Ecommerce;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class TierChangeLog extends Model
{
    use HasFactory;

    protected $fillable = [
        'customer_id',
        'old_tier',
        'new_tier',
        'reason',
        'evaluated_period_start',
        'evaluated_period_end',
    ];

    protected function casts(): array
    {
        return [
            'evaluated_period_start' => 'date',
            'evaluated_period_end' => 'date',
        ];
    }

    public function customer()
    {
        return $this->belongsTo(Customer::class);
    }
}
