<?php

namespace App\Support;

use Illuminate\Http\Request;

class WorkspaceType
{
    public const ECOMMERCE = 'ecommerce';
    public const BOOKING = 'booking';

    /**
     * @return self::ECOMMERCE|self::BOOKING
     */
    public static function fromRequest(Request $request, string $fallback = self::ECOMMERCE): string
    {
        $type = strtolower((string) $request->query('type', $request->input('type', $fallback)));

        return in_array($type, [self::ECOMMERCE, self::BOOKING], true) ? $type : $fallback;
    }
}
