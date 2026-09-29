<?php

use App\Models\PrintDevice;
use Illuminate\Support\Facades\Broadcast;

Broadcast::channel('print-device.{uuid}', function ($principal, string $uuid): bool {
    return $principal instanceof PrintDevice
        && $principal->isActive()
        && $principal->currentAccessToken()?->can('print-device:connect')
        && hash_equals($principal->uuid, $uuid);
});
