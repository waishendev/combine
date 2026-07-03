<?php

namespace App\Models\Ecommerce;

use App\Models\User;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class PosCashPoolLedger extends Model
{
    public const UPDATED_AT = null;

    public const ACTION_OPEN_REFILL_PACKET = 'open_refill_packet';
    public const ACTION_OPEN_ATM = 'open_atm';
    public const ACTION_CLOSE_WITHDRAW = 'close_withdraw';
    public const ACTION_CLOSE_REFILL_CASH = 'close_refill_cash';

    protected $table = 'pos_cash_pool_ledger';

    protected $fillable = [
        'pos_cash_pool_account_id',
        'pos_cash_shift_id',
        'action',
        'initial_cash_delta',
        'withdraw_delta',
        'initial_cash_after',
        'withdraw_after',
        'created_by',
    ];

    protected function casts(): array
    {
        return [
            'initial_cash_delta' => 'decimal:2',
            'withdraw_delta' => 'decimal:2',
            'initial_cash_after' => 'decimal:2',
            'withdraw_after' => 'decimal:2',
            'created_at' => 'datetime',
        ];
    }

    public function account(): BelongsTo
    {
        return $this->belongsTo(PosCashPoolAccount::class, 'pos_cash_pool_account_id');
    }

    public function shift(): BelongsTo
    {
        return $this->belongsTo(PosCashShift::class, 'pos_cash_shift_id');
    }

    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }
}
