<?php

namespace App\Models\Ecommerce;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class NotificationLog extends Model
{
    use HasFactory;

    protected $fillable = [
        'notification_channel_id',
        'type',
        'recipient',
        'subject',
        'message',
        'status',
        'provider_message_id',
        'provider_payload',
        'sent_at',
    ];

    protected function casts(): array
    {
        return [
            'provider_payload' => 'array',
            'sent_at' => 'datetime',
        ];
    }

    public function channel()
    {
        return $this->belongsTo(NotificationChannel::class, 'notification_channel_id');
    }
}
