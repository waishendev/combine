<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;

class CheckPermission
{
    public function handle(Request $request, Closure $next, string $permission)
    {
        $user = Auth::user();

        if (! $user) {
            return response()->json(['error' => 'Unauthenticated'], 401);
        }

        $permissionSlugs = $user->roles()
            ->with('permissions')
            ->get()
            ->pluck('permissions')
            ->flatten()
            ->pluck('slug')
            ->unique();

        // `permission:a|b` passes the whole string as one argument; treat `|` as OR.
        $required = str_contains($permission, '|')
            ? array_map('trim', explode('|', $permission))
            : [$permission];

        $allowed = collect($required)->contains(fn (string $slug) => $permissionSlugs->contains($slug));

        if (! $allowed) {
            return response()->json(['error' => 'Forbidden'], 403);
        }

        return $next($request);
    }
}
