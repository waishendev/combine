<?php

namespace App\Models\Ecommerce;

use App\Models\Staff;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class PosCashShift extends Model
{
    use HasFactory;

    public const STATUS_OPEN = 'OPEN';
    public const STATUS_CLOSED = 'CLOSED';

    public const EVENT_OPEN = 'OPEN';
    public const EVENT_CLOSE = 'CLOSE';

    protected $fillable = [
        'event_type',
        'linked_open_shift_id',
        'opening_amount',
        'opening_refill_packet',
        'opening_atm',
        'opened_by',
        'opened_staff_id',
        'opened_at',
        'closing_amount',
        'closing_withdraw',
        'closing_refill_cash',
        'closed_by',
        'closed_staff_id',
        'closed_at',
        'status',
        'remark',
        'total_initial_cash',
        'total_withdraw',
    ];

    protected function casts(): array
    {
        return [
            'opening_amount' => 'decimal:2',
            'opening_refill_packet' => 'decimal:2',
            'opening_atm' => 'decimal:2',
            'opened_at' => 'datetime',
            'closing_amount' => 'decimal:2',
            'closing_withdraw' => 'decimal:2',
            'closing_refill_cash' => 'decimal:2',
            'closed_at' => 'datetime',
            'total_initial_cash' => 'decimal:2',
            'total_withdraw' => 'decimal:2',
        ];
    }

    public function opener()
    {
        return $this->belongsTo(User::class, 'opened_by');
    }

    public function closer()
    {
        return $this->belongsTo(User::class, 'closed_by');
    }

    public function openedStaff()
    {
        return $this->belongsTo(Staff::class, 'opened_staff_id');
    }

    public function closedStaff()
    {
        return $this->belongsTo(Staff::class, 'closed_staff_id');
    }

    public function poolLedgerEntries()
    {
        return $this->hasMany(PosCashPoolLedger::class, 'pos_cash_shift_id');
    }

    public function linkedOpenShift()
    {
        return $this->belongsTo(self::class, 'linked_open_shift_id');
    }

    public function closeEvent()
    {
        return $this->hasOne(self::class, 'linked_open_shift_id')
            ->where('event_type', self::EVENT_CLOSE);
    }

    public function isOpenEvent(): bool
    {
        return $this->event_type === self::EVENT_OPEN;
    }

    public function isCloseEvent(): bool
    {
        return $this->event_type === self::EVENT_CLOSE;
    }
}
