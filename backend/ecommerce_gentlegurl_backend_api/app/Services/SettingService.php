<?php

namespace App\Services;

use App\Models\Setting;

class SettingService
{
    /**
     * Request-scoped memo for SettingService::get (cleared automatically with the HTTP request).
     * Avoids repeat SELECT for the same type+key within one request (branding, branch_limit, etc.).
     */
    private static function memoKey(string $type, string $key): string
    {
        return 'setting_service.get.'.$type.'.'.$key;
    }

    public static function get(string $key, $default = null, string $type = 'ecommerce')
    {
        $request = app()->bound('request') ? request() : null;
        $memoKey = self::memoKey($type, $key);

        if ($request !== null && $request->attributes->has($memoKey)) {
            return $request->attributes->get($memoKey);
        }

        $setting = Setting::where('type', $type)
            ->where('key', $key)
            ->first();

        $value = $setting ? $setting->value : $default;

        if ($request !== null) {
            $request->attributes->set($memoKey, $value);
        }

        return $value;
    }

    public static function set(string $key, $value, string $type = 'ecommerce'): Setting
    {
        $setting = Setting::updateOrCreate(
            ['type' => $type, 'key' => $key],
            ['value' => $value]
        );

        $request = app()->bound('request') ? request() : null;
        if ($request !== null) {
            $request->attributes->set(self::memoKey($type, $key), $value);
        }

        return $setting;
    }
}
