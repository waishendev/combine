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
            'disable-smart-shrinking' => true,
            'load-error-handling' => 'ignore',
            'load-media-error-handling' => 'ignore',
            'no-stop-slow-scripts' => true,
            'disable-javascript' => true,
        ],
        'env' => [
            'LD_LIBRARY_PATH' => '/usr/local/wkhtmltox/lib',
            'FONTCONFIG_PATH' => '/etc/fonts',
            'FONTCONFIG_FILE' => '/etc/fonts/fonts.conf',
            'FONTCONFIG_CACHEDIR' => '/var/cache/fontconfig',
            'FC_DEBUG' => '0',
            'QT_QPA_PLATFORM' => 'offscreen',
        ],
    ],
    'image' => [
        'enabled' => true,
        'binary' => env('WKHTMLTOIMAGE_BINARY', '/usr/bin/wkhtmltoimage'),
        'timeout' => false,
        'options' => [],
        'env' => [],
    ],
];
