<?php

namespace App\Models\Ecommerce;

use App\Models\User;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class CustomerPointsAdjustmentLog extends Model
{
    protected $fillable = [
        'customer_id',
        'action_type',
        'points',
        'before_balance',
        'after_balance',
        'remark',
        'created_by',
    ];

    protected function casts(): array
    {
        return [
            'points' => 'integer',
            'before_balance' => 'integer',
            'after_balance' => 'integer',
        ];
    }

    public function customer(): BelongsTo
    {
        return $this->belongsTo(Customer::class);
    }

    public function createdBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    public function creator(): BelongsTo
    {
        return $this->createdBy();
    }
}
