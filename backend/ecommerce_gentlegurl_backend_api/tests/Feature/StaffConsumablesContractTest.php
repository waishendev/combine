<?php

namespace Tests\Feature;

use Tests\TestCase;

class StaffConsumablesContractTest extends TestCase
{
    public function test_dedicated_routes_have_permission_middleware(): void
    {
        $routes = collect(app('router')->getRoutes()->getRoutes())->keyBy(
            fn ($route) => implode('|', $route->methods()).' '.$route->uri()
        );

        $catalog = $routes->first(fn ($route) => $route->uri() === 'api/admin/staff-consumables/catalog');
        $checkout = $routes->first(fn ($route) => $route->uri() === 'api/admin/staff-consumables/checkout');

        $this->assertNotNull($catalog);
        $this->assertNotNull($checkout);
        $this->assertContains('permission:pos.staff_consumables.access', $catalog->gatherMiddleware());
        $this->assertContains('permission:pos.staff_consumables.checkout', $checkout->gatherMiddleware());
    }

    public function test_workspace_contract_does_not_depend_on_a_role_name_or_staff_identity(): void
    {
        $controller = file_get_contents(app_path('Http/Controllers/Ecommerce/PosController.php'));
        $methodStart = strpos($controller, 'public function staffConsumableCheckout');
        $methodEnd = strpos($controller, 'protected function serializeStaffConsumableProduct', $methodStart);
        $checkout = substr($controller, $methodStart, $methodEnd - $methodStart);

        $this->assertStringNotContainsString('Only staff accounts can claim consumables', $checkout);
        $this->assertStringContainsString("'created_by_user_id' => \$request->user()->id", $checkout);
        $this->assertStringContainsString("'staff_id' => \$request->user()->staff_id ?", $checkout);
        $this->assertStringContainsString('StoreLocationAccessService::class', $checkout);
        $this->assertStringContainsString('PosBranchInventoryService::class', $checkout);
    }
}
