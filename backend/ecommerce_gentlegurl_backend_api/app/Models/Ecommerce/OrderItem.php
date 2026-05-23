<?php

namespace App\Models\Ecommerce;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class OrderItem extends Model
{
    use HasFactory;

    protected $fillable = [
        'order_id',
        'line_type',
        'product_id',
        'product_variant_id',
        'product_name_snapshot',
        'display_name_snapshot',
        'sku_snapshot',
        'variant_name_snapshot',
        'variant_sku_snapshot',
        'price_snapshot',
        'selected_booking_product_options',
        'unit_price_snapshot',
        'variant_price_snapshot',
        'variant_cost_snapshot',
        'cost_price_snapshot',
        'cost_amount_snapshot',
        'quantity',
        'line_total',
        'line_total_snapshot',
        'effective_unit_price',
        'effective_line_total',
        'is_staff_free_applied',
        'discount_type',
        'discount_value',
        'discount_remark',
        'discount_amount',
        'line_total_after_discount',
        'promotion_id',
        'promotion_name_snapshot',
        'promotion_type_snapshot',
        'promotion_discount_amount',
        'promotion_applied',
        'promotion_snapshot',
        'staff_id',
        'is_package',
        'parent_package_item_id',
        'is_reward',
        'reward_redemption_id',
        'locked',
        'booking_id',
        'booking_service_id',
        'service_package_id',
        'customer_service_package_id',
    ];

    protected function casts(): array
    {
        return [
            'price_snapshot' => 'decimal:2',
            'variant_price_snapshot' => 'decimal:2',
            'variant_cost_snapshot' => 'decimal:2',
            'cost_price_snapshot' => 'decimal:2',
            'cost_amount_snapshot' => 'decimal:2',
            'unit_price_snapshot' => 'decimal:2',
            'line_total_snapshot' => 'decimal:2',
            'effective_unit_price' => 'decimal:2',
            'effective_line_total' => 'decimal:2',
            'quantity' => 'integer',
            'line_total' => 'decimal:2',
            'is_package' => 'boolean',
            'booking_id' => 'integer',
            'booking_service_id' => 'integer',
            'service_package_id' => 'integer',
            'customer_service_package_id' => 'integer',
            'is_reward' => 'boolean',
            'is_staff_free_applied' => 'boolean',
            'discount_value' => 'decimal:2',
            'discount_remark' => 'string',
            'selected_booking_product_options' => 'array',
            'discount_amount' => 'decimal:2',
            'line_total_after_discount' => 'decimal:2',
            'promotion_discount_amount' => 'decimal:2',
            'promotion_applied' => 'boolean',
            'promotion_snapshot' => 'array',
            'locked' => 'boolean',
        ];
    }

    public function order()
    {
        return $this->belongsTo(Order::class);
    }

    public function product()
    {
        return $this->belongsTo(Product::class);
    }

    public function productVariant()
    {
        return $this->belongsTo(ProductVariant::class);
    }

    public function parentPackageItem()
    {
        return $this->belongsTo(OrderItem::class, 'parent_package_item_id');
    }

    public function childItems()
    {
        return $this->hasMany(OrderItem::class, 'parent_package_item_id');
    }

    public function redemption()
    {
        return $this->belongsTo(LoyaltyRedemption::class, 'reward_redemption_id');
    }

    public function review()
    {
        return $this->hasOne(ProductReview::class);
    }

    public function staff()
    {
        return $this->belongsTo(\App\Models\Staff::class);
    }

    public function staffSplits()
    {
        return $this->hasMany(OrderItemStaffSplit::class);
    }

    public function booking()
    {
        return $this->belongsTo(\App\Models\Booking\Booking::class);
    }

    public function bookingService()
    {
        return $this->belongsTo(\App\Models\Booking\BookingService::class, 'booking_service_id');
    }

    public function displayCnName(): ?string
    {
        if ((string) ($this->line_type ?? '') === 'booking_addon') {
            return $this->resolveBookingAddonCnName();
        }

        $cnName = trim((string) ($this->bookingService?->cn_name ?? ''));

        return $cnName !== '' ? $cnName : null;
    }

    protected function resolveBookingAddonCnName(): ?string
    {
        $addonItems = $this->booking?->addon_items_json;
        if (! is_array($addonItems)) {
            return null;
        }

        $candidates = collect([
            $this->display_name_snapshot,
            $this->product_name_snapshot,
        ])
            ->filter(fn ($value) => trim((string) $value) !== '')
            ->flatMap(function ($value) {
                $name = trim((string) $value);
                $parts = [$name];

                if (str_contains($name, '::')) {
                    $parts[] = trim((string) str($name)->afterLast('::'));
                }

                foreach (['Booking Deposit - ', 'Final Settlement - '] as $prefix) {
                    if (stripos($name, $prefix) === 0) {
                        $parts[] = trim(substr($name, strlen($prefix)));
                    }
                }

                return $parts;
            })
            ->map(fn ($value) => mb_strtolower(trim((string) $value)))
            ->filter()
            ->unique()
            ->values();

        if ($candidates->isEmpty()) {
            return null;
        }

        foreach ($addonItems as $addon) {
            if (! is_array($addon)) {
                continue;
            }

            $addonName = trim((string) ($addon['name'] ?? $addon['label'] ?? ''));
            if ($addonName === '' || ! $candidates->contains(mb_strtolower($addonName))) {
                continue;
            }

            $cnName = trim((string) ($addon['cn_label'] ?? $addon['cn_name'] ?? $addon['linked_cn_name'] ?? ''));

            return $cnName !== '' ? $cnName : null;
        }

        return null;
    }
}
