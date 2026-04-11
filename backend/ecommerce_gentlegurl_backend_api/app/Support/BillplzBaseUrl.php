<?php

namespace App\Support;

/**
 * Billplz docs list the host as ".../api/" but bill creation is under API v3 (e.g. POST .../api/v3/bills).
 * Misconfigured base URLs ending in "/api" yield HTTP 404 from Billplz.
 */
final class BillplzBaseUrl
{
    public static function normalize(string $url): string
    {
        $url = rtrim($url, '/');
        if ($url === '') {
            return $url;
        }

        if (preg_match('#/api$#i', $url)) {
            return $url . '/v3';
        }

        return $url;
    }
}
