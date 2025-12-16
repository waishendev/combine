<?php

namespace App\Services;

use App\Models\Setting;

class SettingService
{
    public static function get(string $key, $default = null)
    {
        $setting = Setting::where('key', $key)->first();

        return $setting ? $setting->value : $default;
    }

    public static function set(string $key, array $value): Setting
    {
        return Setting::updateOrCreate(
            ['key' => $key],
            ['value' => $value]
        );
    }
}
