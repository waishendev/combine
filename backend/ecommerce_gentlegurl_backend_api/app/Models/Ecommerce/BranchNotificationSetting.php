<?php

namespace App\Models\Ecommerce;

use Illuminate\Database\Eloquent\Model;

class BranchNotificationSetting extends Model
{
    public const INITIAL_RECIPIENT = 'gentlegurls@gmail.com';

    protected $fillable = [
        'store_location_id', 'booking_reminder_enabled', 'booking_reminder_send_at',
        'booking_feedback_enabled', 'booking_feedback_send_at', 'booking_payment_proof_enabled',
        'booking_payment_proof_recipients', 'daily_order_summary_enabled', 'daily_order_summary_send_at',
        'daily_order_summary_recipients', 'daily_low_stock_enabled', 'daily_low_stock_send_at',
        'daily_low_stock_recipients',
    ];

    protected function casts(): array
    {
        return [
            'booking_reminder_enabled' => 'boolean', 'booking_feedback_enabled' => 'boolean',
            'booking_payment_proof_enabled' => 'boolean', 'daily_order_summary_enabled' => 'boolean',
            'daily_low_stock_enabled' => 'boolean', 'booking_payment_proof_recipients' => 'array',
            'daily_order_summary_recipients' => 'array', 'daily_low_stock_recipients' => 'array',
        ];
    }

    public static function initialValues(): array
    {
        return [
            'booking_reminder_enabled' => true, 'booking_reminder_send_at' => '10:00',
            'booking_feedback_enabled' => true, 'booking_feedback_send_at' => '10:00',
            'booking_payment_proof_enabled' => true,
            'booking_payment_proof_recipients' => [self::INITIAL_RECIPIENT],
            'daily_order_summary_enabled' => true, 'daily_order_summary_send_at' => '10:00',
            'daily_order_summary_recipients' => [self::INITIAL_RECIPIENT],
            'daily_low_stock_enabled' => true, 'daily_low_stock_send_at' => '10:00',
            'daily_low_stock_recipients' => [self::INITIAL_RECIPIENT],
        ];
    }

    public function storeLocation() { return $this->belongsTo(StoreLocation::class); }
}
