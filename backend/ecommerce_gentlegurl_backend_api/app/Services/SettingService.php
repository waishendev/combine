<?php

namespace App\Services;

use App\Models\Setting;

class SettingService
{
    public static function get(string $key, $default = null, string $type = 'ecommerce')
    {
        $setting = Setting::where('type', $type)
            ->where('key', $key)
            ->first();

        return $setting ? $setting->value : $default;
    }

    public static function set(string $key, $value, string $type = 'ecommerce'): Setting
    {
        return Setting::updateOrCreate(
            ['type' => $type, 'key' => $key],
            ['value' => $value]
        );
    }
}
