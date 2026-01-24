<?php

return [
    'pdf' => [
        'enabled' => true,
        'binary' => env('WKHTMLTOPDF_BINARY', '/usr/bin/wkhtmltopdf'),
        'timeout' => false,
        'options' => [
            'encoding' => 'UTF-8',
            'page-size' => 'A4',
            'print-media-type' => true,
            'enable-local-file-access' => true,
        ],
        'env' => [],
    ],
    'image' => [
        'enabled' => true,
        'binary' => env('WKHTMLTOIMAGE_BINARY', '/usr/bin/wkhtmltoimage'),
        'timeout' => false,
        'options' => [],
        'env' => [],
    ],
];
