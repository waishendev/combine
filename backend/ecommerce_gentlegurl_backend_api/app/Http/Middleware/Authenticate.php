<?php

namespace App\Http\Middleware;

use Illuminate\Auth\Middleware\Authenticate as Middleware;
use Illuminate\Http\Request;

class Authenticate extends Middleware
{
    /**
     * Get the path the user should be redirected to when they are not authenticated.
     */
    protected function redirectTo(Request $request): ?string
    {
        // For API routes, return null to throw AuthenticationException instead of redirecting
        if ($request->expectsJson() || $request->is('api/*')) {
            return null;
        }

        // For web routes, you can define a login route here if needed
        // return route('login');
        return null;
    }
}

