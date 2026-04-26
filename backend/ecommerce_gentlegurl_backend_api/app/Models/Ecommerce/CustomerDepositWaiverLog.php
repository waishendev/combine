<?php

namespace App\Models\Ecommerce;

use App\Models\User;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class CustomerDepositWaiverLog extends Model
{
    protected $fillable = [
        'customer_id',
        'action_type',
        'before_value',
        'after_value',
        'remark',
        'created_by',
    ];

    protected function casts(): array
    {
        return [
            'before_value' => 'array',
            'after_value' => 'array',
        ];
    }

    public function customer(): BelongsTo
    {
        return $this->belongsTo(Customer::class);
    }

    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }
}
