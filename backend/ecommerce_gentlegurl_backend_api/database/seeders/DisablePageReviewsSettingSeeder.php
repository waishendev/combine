<?php

namespace Database\Seeders;

use App\Models\Setting;
use Illuminate\Database\Seeder;

/**
 * Production-safe one-off: disable Store Reviews (page_reviews) without re-running SettingSeeder.
 *
 * php artisan db:seed --class=DisablePageReviewsSettingSeeder
 */
class DisablePageReviewsSettingSeeder extends Seeder
{
    public function run(): void
    {
        $value = ['enabled' => false];

        foreach (['ecommerce', 'booking'] as $type) {
            $setting = Setting::updateOrCreate(
                ['type' => $type, 'key' => 'page_reviews'],
                ['value' => $value],
            );

            $this->command?->info(sprintf(
                'page_reviews (%s) id=%d enabled=%s',
                $type,
                (int) $setting->id,
                data_get($setting->value, 'enabled') ? 'true' : 'false',
            ));
        }
    }
}
