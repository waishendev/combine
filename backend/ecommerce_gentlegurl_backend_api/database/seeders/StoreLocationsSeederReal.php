<?php

namespace Database\Seeders;

use App\Models\Ecommerce\StoreLocation;
use App\Models\Ecommerce\StoreLocationImage;
use Illuminate\Database\Seeder;

class StoreLocationsSeederReal extends Seeder
{

    public function run(): void
    {
        $stores = [
            [
                'name' => 'Gentlegurls Nail Salon',
                'code' => 'PNG',
                'address_line1' => '14, Lebuh Cintra,',
                'city' => 'Pulau Pinang,',
                'state' => 'George Town,',
                'postcode' => '10200',
                'country' => 'Malaysia',
                'phone' => '+6017-637 5513',
                'is_active' => true,
                'opening_hours' => [
                    'Monday' => '11am - 8:00pm',
                    'Tuesday' => '11am - 8:00pm',
                    'Wednesday' => '11am - 8:00pm',
                    'Thursday' => '11am - 8:00pm',
                    'Friday' => '11am - 8:00pm',
                    'Saturday' => '11am - 8:00pm',
                    'Sunday ' => '11am - 8:00pm',
                ],
            ],
        ];

        foreach ($stores as $store) {
            $storeModel = StoreLocation::updateOrCreate(
                ['code' => $store['code']],
                $store
            );

            $images = [
                "/images/stores/{$store['code']}-1.jpg",
                "/images/stores/{$store['code']}-2.jpg",
            ];

            foreach ($images as $index => $imagePath) {
                StoreLocationImage::updateOrCreate(
                    [
                        'store_location_id' => $storeModel->id,
                        'image_path' => $imagePath,
                    ],
                    ['sort_order' => $index]
                );
            }
        }
    } 
}
