<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class BankAccount extends Model
{
    protected $fillable = [
        'label',
        'bank_name',
        'account_name',
        'account_number',
        'branch',
        'swift_code',
        'logo_url',
        'qr_image_url',
        'is_active',
        'is_default',
        'sort_order',
        'instructions',
    ];

    protected $casts = [
        'is_active' => 'boolean',
        'is_default' => 'boolean',
        'sort_order' => 'integer',
    ];
}
