<?php

namespace App\Models\Ecommerce;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class PaymentGateway extends Model
{
    use HasFactory;

    protected $fillable = [
        'type',
        'key',
        'name',
        'is_active',
        'allow_checkout',
        'allow_wallet_topup',
        'is_default',
        'sort_order',
        'config',
    ];

    protected function casts(): array
    {
        return [
            'is_active' => 'boolean',
            'allow_checkout' => 'boolean',
            'allow_wallet_topup' => 'boolean',
            'is_default' => 'boolean',
            'config' => 'array',
        ];
    }
}
