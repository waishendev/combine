<?php

namespace Database\Seeders;

use App\Models\Ecommerce\SeoGlobal;
use Illuminate\Database\Seeder;

class GlobalSeoSeedeer extends Seeder
{
    public function run(): void
    {
        SeoGlobal::firstOrCreate([], [
            'default_title' => 'My Shop',
            'default_description' => 'Default SEO description',
            'default_keywords' => 'shop, ecommerce',
            'default_og_image' => null,
        ]);
    }   
}
