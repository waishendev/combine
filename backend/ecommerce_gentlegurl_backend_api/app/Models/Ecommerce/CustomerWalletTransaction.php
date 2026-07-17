<?php

namespace App\Models\Ecommerce;

use App\Models\User;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class CustomerWalletTransaction extends Model
{
    public const TYPE_TOPUP = 'topup';
    public const DIRECTION_CREDIT = 'credit';
    public const STATUS_PENDING = 'pending';
    public const STATUS_PENDING_PAYMENT = 'pending_payment';
    public const STATUS_PENDING_PROOF = 'pending_proof';
    public const STATUS_WAITING_VERIFICATION = 'waiting_verification';
    public const STATUS_PROOF_SUBMITTED = 'proof_submitted';
    public const STATUS_COMPLETED = 'completed';
    public const STATUS_REJECTED = 'rejected';
    public const STATUS_FAILED = 'failed';
    public const STATUS_CANCELLED = 'cancelled';
    public const STATUS_REVERSED = 'reversed';

    public const PENDING_REVIEW_STATUSES = [
        self::STATUS_PENDING,
        self::STATUS_PENDING_PAYMENT,
        self::STATUS_PENDING_PROOF,
        self::STATUS_WAITING_VERIFICATION,
        self::STATUS_PROOF_SUBMITTED,
    ];

    protected $fillable = [
        'customer_id','transaction_no','type','direction','amount','balance_before','balance_after','workspace_type',
        'payment_gateway_key','payment_method_label','source_type','source_id','reference_no','status','remark','created_by',
        'completed_at','reversed_transaction_id','metadata',
    ];

    protected function casts(): array
    {
        return ['amount'=>'decimal:2','balance_before'=>'decimal:2','balance_after'=>'decimal:2','completed_at'=>'datetime','metadata'=>'array'];
    }

    public function scopeTopUps(Builder $query): Builder { return $query->where('type', self::TYPE_TOPUP)->where('direction', self::DIRECTION_CREDIT); }
    public function scopePendingReview(Builder $query): Builder { return $query->topUps()->whereIn('status', self::PENDING_REVIEW_STATUSES); }
    public function scopeCompleted(Builder $query): Builder { return $query->where('status', self::STATUS_COMPLETED); }
    public function scopeTerminal(Builder $query): Builder { return $query->whereIn('status', [self::STATUS_COMPLETED, self::STATUS_REJECTED, self::STATUS_FAILED, self::STATUS_CANCELLED, self::STATUS_REVERSED]); }

    public function customer(): BelongsTo { return $this->belongsTo(Customer::class); }
    public function creator(): BelongsTo { return $this->belongsTo(User::class, 'created_by'); }
    public function reversedTransaction(): BelongsTo { return $this->belongsTo(self::class, 'reversed_transaction_id'); }
}
