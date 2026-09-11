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

        // Include Branch-owned Roles (role_user_store_location), not only legacy role_user.
        $permissionSlugs = $user->getAllPermissions();

        // `permission:a|b` passes the whole string as one argument; treat `|` as OR.
        $required = str_contains($permission, '|')
            ? array_map('trim', explode('|', $permission))
            : [$permission];

        $allowed = collect($required)->contains(fn (string $slug) => $permissionSlugs->contains($slug));

        if (! $allowed) {
            $message = $permission === 'roles.delete'
                ? 'You do not have permission to delete Roles for this Branch.'
                : 'Forbidden';

            return response()->json([
                'success' => false,
                'message' => $message,
                'errors' => null,
                'data' => null,
            ], 403);
        }

        return $next($request);
    }
}
