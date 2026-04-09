<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class BillplzPaymentGatewayOption extends Model
{
    use HasFactory;

    protected $fillable = [
        'type',
        'gateway_group',
        'code',
        'name',
        'logo_url',
        'description',
        'is_active',
        'is_default',
        'sort_order',
        'meta',
    ];

    protected function casts(): array
    {
        return [
            'is_active' => 'boolean',
            'is_default' => 'boolean',
            'meta' => 'array',
        ];
    }
}
