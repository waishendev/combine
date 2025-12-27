<?php

namespace App\Models\Ecommerce;

use App\Models\BankAccount;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\Storage;

class Order extends Model
{
    use HasFactory;

    protected $fillable = [
        'order_number',
        'customer_id',
        'status',
        'payment_status',
        'payment_method',
        'payment_provider',
        'payment_reference',
        'payment_url',
        'payment_meta',
        'payment_gateway_id',
        'bank_account_id',
        'subtotal',
        'discount_total',
        'shipping_fee',
        'grand_total',
        'voucher_code_snapshot',
        'pickup_or_shipping',
        'pickup_store_id',
        'shipping_name',
        'shipping_phone',
        'shipping_address_line1',
        'shipping_address_line2',
        'shipping_city',
        'shipping_state',
        'shipping_postcode',
        'shipping_country',
        'shipping_courier',
        'shipping_tracking_no',
        'notes',
        'placed_at',
        'paid_at',
        'completed_at',
        'shipped_at',
        'pickup_ready_at',
        'refund_proof_path',
        'refunded_at',
    ];

    protected function casts(): array
    {
        return [
            'subtotal' => 'decimal:2',
            'discount_total' => 'decimal:2',
            'shipping_fee' => 'decimal:2',
            'grand_total' => 'decimal:2',
            'payment_meta' => 'array',
            'placed_at' => 'datetime',
            'paid_at' => 'datetime',
            'completed_at' => 'datetime',
            'shipped_at' => 'datetime',
            'pickup_ready_at' => 'datetime',
            'refunded_at' => 'datetime',
        ];
    }

    protected $appends = [
        'refunded_photo_url',
    ];

    public function getRefundedPhotoUrlAttribute(): ?string
    {
        if (!$this->refund_proof_path) {
            return null;
        }

        return Storage::disk('public')->url($this->refund_proof_path);
    }

    public function customer()
    {
        return $this->belongsTo(Customer::class);
    }

    public function items()
    {
        return $this->hasMany(OrderItem::class);
    }

    public function voucher()
    {
        return $this->hasOne(OrderVoucher::class);
    }

    public function vouchers()
    {
        return $this->hasMany(OrderVoucher::class);
    }

    public function uploads()
    {
        return $this->hasMany(OrderUpload::class);
    }

    public function returns()
    {
        return $this->hasMany(ReturnRequest::class);
    }

    public function paymentGateway()
    {
        return $this->belongsTo(PaymentGateway::class);
    }

    public function bankAccount()
    {
        return $this->belongsTo(BankAccount::class);
    }

    public function pickupStore()
    {
        return $this->belongsTo(StoreLocation::class, 'pickup_store_id');
    }
}
