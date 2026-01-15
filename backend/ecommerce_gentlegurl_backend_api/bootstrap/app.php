<?php

use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;

use Laravel\Sanctum\Http\Middleware\EnsureFrontendRequestsAreStateful;
use Illuminate\Cookie\Middleware\EncryptCookies;
use Illuminate\Cookie\Middleware\AddQueuedCookiesToResponse;
use Illuminate\Session\Middleware\StartSession;
use Illuminate\Routing\Middleware\SubstituteBindings;

return Application::configure(basePath: dirname(__DIR__))
    ->withRouting(
        web: __DIR__ . '/../routes/web.php',
        api: __DIR__ . '/../routes/api.php',
        commands: __DIR__ . '/../routes/console.php',
        health: '/up',
    )
    ->withMiddleware(function (Middleware $middleware): void {
        // 启用 CORS 支持（全局中间件，确保所有路由都支持CORS）
        $middleware->web(append: [
            \Illuminate\Http\Middleware\HandleCors::class,
        ]);
        
        $middleware->api(prepend: [
            \Illuminate\Http\Middleware\HandleCors::class,
        ]);

        // Sanctum 的 stateful API 支持（保持）
        $middleware->statefulApi();

        // ✅ 给需要 Session 的 API 用的 group（login / logout + 带 session 的受保护路由）
        $middleware->group('api.session', [
            EncryptCookies::class,
            AddQueuedCookiesToResponse::class,
            StartSession::class,
            SubstituteBindings::class,
        ]);

        // 自己的中间件 alias
        $middleware->alias([
            'permission' => \App\Http\Middleware\CheckPermission::class,
        ]);
    })
    ->withExceptions(function (Exceptions $exceptions): void {
        // 处理验证异常 - 返回 422 错误
        $exceptions->render(function (Illuminate\Validation\ValidationException $e, \Illuminate\Http\Request $request) {
            if ($request->expectsJson() || $request->is('api/*') || $request->is('public/shop*')) {
                return response()->json([
                    'success' => false,
                    'message' => 'Validation failed',
                    'errors' => $e->errors(),
                    'data' => null,
                ], 422);
            }
        });

        // 处理认证异常 - 返回 401 错误
        $exceptions->render(function (Illuminate\Auth\AuthenticationException $e, \Illuminate\Http\Request $request) {
            if ($request->expectsJson() || $request->is('api/*') || $request->is('public/shop*')) {
                return response()->json([
                    'success' => false,
                    'message' => 'Unauthenticated',
                    'errors' => null,
                    'data' => null,
                ], 401);
            }
        });

        // 处理授权异常 - 返回 403 错误
        $exceptions->render(function (Illuminate\Auth\Access\AuthorizationException $e, \Illuminate\Http\Request $request) {
            if ($request->expectsJson() || $request->is('api/*') || $request->is('public/shop*')) {
                return response()->json([
                    'success' => false,
                    'message' => 'Forbidden',
                    'errors' => null,
                    'data' => null,
                ], 403);
            }
        });

        // 处理路由未找到异常（通常由认证中间件尝试重定向到不存在的路由引起）
        $exceptions->render(function (Symfony\Component\Routing\Exception\RouteNotFoundException $e, \Illuminate\Http\Request $request) {
            if ($request->expectsJson() || $request->is('api/*') || $request->is('public/shop*')) {
                // 如果是 API 路由，返回 401 未认证错误而不是路由未找到
                return response()->json([
                    'success' => false,
                    'message' => 'Unauthenticated',
                    'errors' => null,
                    'data' => null,
                ], 401);
            }
        });

        // 处理 HTTP 异常
        $exceptions->render(function (Symfony\Component\HttpKernel\Exception\HttpExceptionInterface $e, \Illuminate\Http\Request $request) {
            if ($request->expectsJson() || $request->is('api/*') || $request->is('public/shop*')) {
                return response()->json([
                    'success' => false,
                    'message' => $e->getMessage() ?: 'HTTP Error',
                    'errors' => null,
                    'data' => null,
                ], $e->getStatusCode());
            }
        });
    })->create();
