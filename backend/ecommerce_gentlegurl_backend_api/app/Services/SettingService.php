<?php

namespace App\Services;

use App\Models\Setting;

class SettingService
{
    public static function get(string $key, $default = null)
    {
        $setting = Setting::where('key', $key)->first();

        if ($setting) {
            return $setting->value;
        }

        $defaultValue = self::defaultValue($key, $default);

        if ($defaultValue !== null) {
            return self::set($key, $defaultValue)->value;
        }

        return $defaultValue;
    }

    public static function set(string $key, array $value): Setting
    {
        return Setting::updateOrCreate(
            ['key' => $key],
            ['value' => $value]
        );
    }

    public static function defaultValue(string $key, $fallback = null)
    {
        $defaults = config('ecommerce.settings_defaults', []);

        return $defaults[$key] ?? $fallback;
    }
}
