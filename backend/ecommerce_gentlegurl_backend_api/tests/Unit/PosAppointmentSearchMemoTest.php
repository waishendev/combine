<?php

namespace Tests\Unit;

use App\Http\Controllers\Ecommerce\PosController;
use PHPUnit\Framework\TestCase;
use ReflectionClass;
use ReflectionMethod;

class PosAppointmentSearchMemoTest extends TestCase
{
    public function test_remember_is_disabled_outside_appointment_search(): void
    {
        $controller = $this->controllerWithoutConstructor();
        $calls = 0;

        $first = $this->invokeRemember($controller, 'k', function () use (&$calls) {
            $calls++;

            return 'a';
        });
        $second = $this->invokeRemember($controller, 'k', function () use (&$calls) {
            $calls++;

            return 'b';
        });

        $this->assertSame('a', $first);
        $this->assertSame('b', $second);
        $this->assertSame(2, $calls);
    }

    public function test_remember_reuses_value_while_memo_enabled_and_clears_after_end(): void
    {
        $controller = $this->controllerWithoutConstructor();
        $calls = 0;

        $this->invokeVoid($controller, 'beginAppointmentSearchMemo');

        $first = $this->invokeRemember($controller, 'k', function () use (&$calls) {
            $calls++;

            return ['ids' => [1, 2]];
        });
        $second = $this->invokeRemember($controller, 'k', function () use (&$calls) {
            $calls++;

            return ['ids' => [9]];
        });

        $this->assertSame(['ids' => [1, 2]], $first);
        $this->assertSame(['ids' => [1, 2]], $second);
        $this->assertSame(1, $calls);

        $this->invokeVoid($controller, 'endAppointmentSearchMemo');

        $third = $this->invokeRemember($controller, 'k', function () use (&$calls) {
            $calls++;

            return ['ids' => [3]];
        });

        $this->assertSame(['ids' => [3]], $third);
        $this->assertSame(2, $calls);
    }

    public function test_staff_splits_memo_key_includes_fallback_staff_id(): void
    {
        $controller = $this->controllerWithoutConstructor();
        $this->invokeVoid($controller, 'beginAppointmentSearchMemo');

        $method = new ReflectionMethod(PosController::class, 'rememberAppointmentSearch');
        $method->setAccessible(true);

        $seen = [];
        $method->invoke($controller, 'staff_splits:10:fallback:1', function () use (&$seen) {
            $seen[] = 'fallback-1';

            return [['staff_id' => 1, 'share_percent' => 100]];
        });
        $method->invoke($controller, 'staff_splits:10:fallback:2', function () use (&$seen) {
            $seen[] = 'fallback-2';

            return [['staff_id' => 2, 'share_percent' => 100]];
        });
        $method->invoke($controller, 'staff_splits:10:fallback:1', function () use (&$seen) {
            $seen[] = 'fallback-1-again';

            return [['staff_id' => 99, 'share_percent' => 100]];
        });

        $this->assertSame(['fallback-1', 'fallback-2'], $seen);
        $this->invokeVoid($controller, 'endAppointmentSearchMemo');
    }

    public function test_package_claims_memo_key_includes_service_and_addon_fingerprint(): void
    {
        $controller = $this->controllerWithoutConstructor();
        $this->invokeVoid($controller, 'beginAppointmentSearchMemo');

        $method = new ReflectionMethod(PosController::class, 'rememberAppointmentSearch');
        $method->setAccessible(true);

        $keyA = 'pkg_claims:5:svc:9:addons:' . md5(json_encode([['id' => 1]]));
        $keyB = 'pkg_claims:5:svc:9:addons:' . md5(json_encode([['id' => 2]]));

        $calls = 0;
        $method->invoke($controller, $keyA, function () use (&$calls) {
            $calls++;

            return [['usage_id' => 1]];
        });
        $method->invoke($controller, $keyB, function () use (&$calls) {
            $calls++;

            return [['usage_id' => 2]];
        });
        $method->invoke($controller, $keyA, function () use (&$calls) {
            $calls++;

            return [['usage_id' => 99]];
        });

        $this->assertSame(2, $calls);
        $this->invokeVoid($controller, 'endAppointmentSearchMemo');
    }

    private function controllerWithoutConstructor(): PosController
    {
        return (new ReflectionClass(PosController::class))->newInstanceWithoutConstructor();
    }

    private function invokeRemember(PosController $controller, string $key, callable $resolver): mixed
    {
        $method = new ReflectionMethod(PosController::class, 'rememberAppointmentSearch');
        $method->setAccessible(true);

        return $method->invoke($controller, $key, $resolver);
    }

    private function invokeVoid(PosController $controller, string $methodName): void
    {
        $method = new ReflectionMethod(PosController::class, $methodName);
        $method->setAccessible(true);
        $method->invoke($controller);
    }
}
