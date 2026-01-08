<?php

return [
    'product_media' => [
        'image_max_mb' => env('PRODUCT_IMAGE_MAX_MB', 10),
        'video_max_mb' => env('PRODUCT_VIDEO_MAX_MB', 50),
        'video_max_seconds' => env('PRODUCT_VIDEO_MAX_SECONDS', 30),
        'video_max_width' => env('PRODUCT_VIDEO_MAX_WIDTH', 1920),
        'video_max_height' => env('PRODUCT_VIDEO_MAX_HEIGHT', 1080),
        'video_enabled' => filter_var(env('PRODUCT_VIDEO_ENABLED', true), FILTER_VALIDATE_BOOLEAN),
        'image_extensions' => ['jpg', 'jpeg', 'png', 'webp'],
        'video_extensions' => ['mp4', 'mov'],
        'image_mime_types' => ['image/jpeg', 'image/png', 'image/webp'],
        'video_mime_types' => ['video/mp4', 'video/quicktime'],
    ],
    'return_media' => [
        'image_max_mb' => env('RETURN_IMAGE_MAX_MB', 10),
        'video_max_mb' => env('RETURN_VIDEO_MAX_MB', 50),
        'video_enabled' => filter_var(env('RETURN_VIDEO_ENABLED', true), FILTER_VALIDATE_BOOLEAN),
        'image_extensions' => ['jpg', 'jpeg', 'png', 'webp'],
        'video_extensions' => ['mp4', 'mov', 'webm', 'm4v', 'ogv'],
    ],
];
