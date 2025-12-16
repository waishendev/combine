<?php

return [
    'settings_defaults' => [
        'shop_contact_widget' => [
            'whatsapp' => [
                'enabled' => false,
                'phone' => null,
                'default_message' => null,
            ],
        ],
        'homepage_products' => [
            'new_products_days' => 30,
            'best_sellers_days' => 60,
        ],
        'shipping' => [
            'enabled' => true,
            'flat_fee' => 0,
            'currency' => 'MYR',
            'label' => 'Flat Rate Shipping',
        ],
        'footer' => [
            'enabled' => true,
            'about_text' => null,
            'contact' => [
                'whatsapp' => null,
                'email' => null,
                'address' => null,
            ],
            'social' => [
                'instagram' => null,
                'facebook' => null,
                'tiktok' => null,
            ],
            'links' => [
                'shipping_policy' => '/shipping-policy',
                'return_refund' => '/return-refund',
                'privacy' => '/privacy-policy',
                'terms' => '/terms',
            ],
        ],
    ],
];
