<?php
namespace App\Http\Middleware;
use App\Models\PrintDevice;
use Closure;
use Illuminate\Http\Request;
class EnsurePrintDevice
{
    public function handle(Request $request, Closure $next, ?string $ability = null)
    {
        $device = $request->user();
        if (! $device instanceof PrintDevice || ! $device->isActive()) return response()->json(['message'=>'Unauthenticated'],401);
        if ($ability && (! $device->currentAccessToken() || ! $device->tokenCan($ability))) return response()->json(['message'=>'Token ability denied'],403);
        return $next($request);
    }
}
