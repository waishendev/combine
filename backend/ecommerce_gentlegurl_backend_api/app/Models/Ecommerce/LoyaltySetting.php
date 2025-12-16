<?php

namespace App\Models\Ecommerce;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class LoyaltySetting extends Model
{
    use HasFactory;

    protected $fillable = [
        'base_multiplier',
        'expiry_months',
        'evaluation_cycle_months',
        'rules_effective_at',
    ];

    protected function casts(): array
    {
        return [
            'base_multiplier' => 'decimal:2',
            'rules_effective_at' => 'date',
        ];
    }
}
