<?php

namespace App\Models\Ecommerce;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class PosCashPoolAccount extends Model
{
    public const DEFAULT_CODE = 'default';

    protected $fillable = [
        'code',
        'total_initial_cash',
        'total_withdraw',
    ];

    protected function casts(): array
    {
        return [
            'total_initial_cash' => 'decimal:2',
            'total_withdraw' => 'decimal:2',
        ];
    }

    public function ledgerEntries(): HasMany
    {
        return $this->hasMany(PosCashPoolLedger::class);
    }

    public function balancesArray(): array
    {
        return [
            'total_initial_cash' => round((float) $this->total_initial_cash, 2),
            'total_withdraw' => round((float) $this->total_withdraw, 2),
        ];
    }
}
