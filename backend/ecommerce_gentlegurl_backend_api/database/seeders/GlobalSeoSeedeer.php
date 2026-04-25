<?php

namespace Database\Seeders;

use App\Models\Ecommerce\SeoGlobal;
use Illuminate\Database\Seeder;

class GlobalSeoSeedeer extends Seeder
{
    public function run(): void
    {
        $defaults = [
            'default_description' => 'Default SEO description',
            'default_keywords' => 'shop, ecommerce',
            'default_og_image' => null,
        ];

        $byType = [
            'ecommerce' => [
                'default_title' => 'Gentlegurls',
            ],
            'booking' => [
                'default_title' => 'Gentlegurls Nail Salon',
            ],
        ];

        foreach ($byType as $type => $overrides) {
            SeoGlobal::updateOrCreate(
                ['type' => $type],
                [...$defaults, ...$overrides],
            );
        }
    }
}
