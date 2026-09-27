<?php

namespace App\Services\PrintPlatform;

use App\Models\PrintDevice;
use App\Models\PrintDevicePairingCode;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

class PairingService
{
    public function issue(PrintDevice $device, User $actor): string
    {
        $device->pairingCodes()->whereNull('consumed_at')->update(['consumed_at' => now()]);
        $alphabet = '23456789ABCDEFGHJKMNPQRSTUVWXYZ';
        $code = collect(range(1, 8))->map(fn () => $alphabet[random_int(0, strlen($alphabet) - 1)])->implode('');
        PrintDevicePairingCode::create([
            'print_device_id' => $device->id,
            'code_hash' => hash_hmac('sha256', $code, config('app.key')),
            'expires_at' => now()->addMinutes(10),
            'created_by_user_id' => $actor->id,
        ]);
        return $code;
    }

    public function pair(string $code, array $metadata, string $ip): array
    {
        $hash = hash_hmac('sha256', strtoupper(preg_replace('/\s+/', '', $code)), config('app.key'));
        return DB::transaction(function () use ($hash, $metadata, $ip) {
            $pairing = PrintDevicePairingCode::query()->where('code_hash', $hash)->lockForUpdate()->first();
            if (! $pairing || $pairing->consumed_at || $pairing->expires_at->isPast()) {
                throw ValidationException::withMessages(['pairing_code' => ['Pairing code is invalid, expired, or already used.']]);
            }
            $device = PrintDevice::query()->with('storeLocation')->lockForUpdate()->findOrFail($pairing->print_device_id);
            if (! $device->isActive()) abort(403, 'This print device has been revoked.');
            $pairing->update(['consumed_at' => now(), 'consumed_ip' => $ip]);
            $device->update([
                'name' => $metadata['device_name'],
                'app_version' => $metadata['app_version'] ?? null,
                'installation_id_hash' => isset($metadata['installation_id']) ? hash('sha256', $metadata['installation_id']) : null,
                'paired_at' => now(), 'last_seen_at' => now(), 'last_seen_ip' => $ip,
            ]);
            $device->tokens()->delete();
            $token = $device->createToken('android-'.Str::limit($metadata['installation_id'] ?? Str::uuid(), 30), ['print-device:connect','print-device:jobs','print-device:heartbeat'])->plainTextToken;
            return ['token' => $token, 'device' => $device->fresh('storeLocation')];
        });
    }
}
