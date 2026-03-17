<?php

namespace App\Support;

class FrontendUrlResolver
{
    /**
     * Resolve the correct frontend base URL for links in emails.
     *
     * Strategy:
     * - Prefer explicit workspace header from the calling frontend: X-Workspace: booking|ecommerce
     * - Fall back to configured default FRONTEND_URL (existing behavior)
     */
    public static function resolveBaseUrl(): string
    {
        $default = rtrim((string) (config('services.frontend_url') ?? config('app.url')), '/');

        try {
            if (!function_exists('request')) {
                return $default;
            }

            $workspace = (string) request()->header('X-Workspace', '');
            $workspace = strtolower(trim($workspace));

            if ($workspace === 'booking') {
                $booking = rtrim((string) (config('services.frontend_url_booking') ?? ''), '/');
                return $booking !== '' ? $booking : $default;
            }

            if ($workspace === 'ecommerce') {
                $ecommerce = rtrim((string) (config('services.frontend_url_ecommerce') ?? ''), '/');
                return $ecommerce !== '' ? $ecommerce : $default;
            }
        } catch (\Throwable $e) {
            // ignore and fall back
        }

        return $default;
    }
}

