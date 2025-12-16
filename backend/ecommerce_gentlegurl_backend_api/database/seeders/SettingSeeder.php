<?php

namespace Database\Seeders;

use App\Models\Setting;
use Illuminate\Database\Seeder;

class SettingSeeder extends Seeder
{
    public function run(): void
    {
        $defaults = config('ecommerce.settings_defaults', []);

        foreach (['shop_contact_widget', 'homepage_products', 'shipping', 'footer'] as $key) {
            if (array_key_exists($key, $defaults)) {
                Setting::updateOrCreate(
                    ['key' => $key],
                    ['value' => $defaults[$key]]
                );
            }
        }
    }
}
