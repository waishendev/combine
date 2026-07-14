<?php

namespace App\Models\Ecommerce;

use App\Models\User;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class CustomerWalletTransaction extends Model
{
    protected $fillable = [
        'customer_id','transaction_no','type','direction','amount','balance_before','balance_after','workspace_type',
        'payment_gateway_key','payment_method_label','source_type','source_id','reference_no','status','remark','created_by',
        'completed_at','reversed_transaction_id','metadata',
    ];

    protected function casts(): array
    {
        return ['amount'=>'decimal:2','balance_before'=>'decimal:2','balance_after'=>'decimal:2','completed_at'=>'datetime','metadata'=>'array'];
    }

    public function customer(): BelongsTo { return $this->belongsTo(Customer::class); }
    public function creator(): BelongsTo { return $this->belongsTo(User::class, 'created_by'); }
    public function reversedTransaction(): BelongsTo { return $this->belongsTo(self::class, 'reversed_transaction_id'); }
}
