<?php

namespace Tests\Feature;

use App\Models\Booking\BookingProduct;
use App\Models\Booking\BookingProductCategory;
use App\Models\Booking\BookingService;
use App\Models\Booking\BookingServiceCategory;
use App\Models\Ecommerce\StoreLocation;
use App\Models\Permission;
use App\Models\Role;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class BookingManagementBranchContextTest extends TestCase
{
    use RefreshDatabase;

    public function test_all_four_management_lists_follow_specific_and_all_branch_context(): void
    {
        $user = $this->actor();
        [$a, $b, $hidden] = [$this->branch('A'), $this->branch('B'), $this->branch('HIDDEN')];
        $user->storeLocations()->sync([$a->id, $b->id]);

        $serviceA = $this->service('Service A', [$a]);
        $serviceB = $this->service('Service B', [$b]);
        $serviceHidden = $this->service('Service Hidden', [$hidden]);
        $serviceCategory = BookingServiceCategory::create(['name' => 'Service Category', 'slug' => 'service-category', 'is_active' => true]);
        $serviceCategory->services()->sync([$serviceA->id, $serviceHidden->id]);

        $productA = BookingProduct::create(['name' => 'Product A', 'price' => 10, 'is_active' => true]);
        $productB = BookingProduct::create(['name' => 'Product B', 'price' => 10, 'is_active' => true]);
        $serviceA->update(['linked_booking_product_id' => $productA->id]);
        $serviceB->update(['linked_booking_product_id' => $productB->id]);
        $productCategory = BookingProductCategory::create(['name' => 'Product Category', 'sort_order' => 1, 'is_active' => true]);
        $productCategory->products()->sync([$productA->id]);

        $this->actingAs($user)->getJson('/api/admin/booking/services?branch_store_location_id='.$a->id)
            ->assertOk()->assertJsonCount(1, 'data.data')->assertJsonPath('data.data.0.name', 'Service A');
        $this->actingAs($user)->getJson('/api/admin/booking/products?branch_store_location_id='.$b->id)
            ->assertOk()->assertJsonCount(1, 'data.data')->assertJsonPath('data.data.0.name', 'Product B');
        $this->actingAs($user)->getJson('/api/admin/booking/categories?branch_store_location_id='.$a->id)
            ->assertOk()->assertJsonCount(1, 'data.data');
        $this->actingAs($user)->getJson('/api/admin/booking/product-categories?branch_store_location_id='.$a->id.'&page=1')
            ->assertOk()->assertJsonCount(1, 'data.data');

        $all = $this->actingAs($user)->getJson('/api/admin/booking/services?branch_scope=all')->assertOk();
        $this->assertEqualsCanonicalizing(['Service A', 'Service B'], collect($all->json('data.data'))->pluck('name')->all());
        $serviceARow = collect($all->json('data.data'))->firstWhere('name', 'Service A');
        $this->assertEqualsCanonicalizing(['Branch A'], collect($serviceARow['store_locations'])->pluck('name')->all());

        $this->actingAs($user)->getJson('/api/admin/booking/services?branch_store_location_id='.$hidden->id)->assertForbidden();
    }

    private function actor(): User
    {
        $role = Role::create(['name' => 'booking-branch-list-'.uniqid(), 'is_active' => true, 'is_system' => false]);
        $permission = Permission::firstOrCreate(['slug' => 'booking.services.view'], ['name' => 'View booking services']);
        $role->permissions()->attach($permission);
        $user = User::factory()->create();
        $user->roles()->attach($role);
        return $user;
    }

    private function branch(string $code): StoreLocation
    {
        return StoreLocation::create(['name' => 'Branch '.$code, 'code' => $code, 'address_line1' => 'x', 'city' => 'x', 'state' => 'x', 'postcode' => '1', 'is_active' => true, 'is_booking_available' => true]);
    }

    private function service(string $name, array $branches): BookingService
    {
        $service = BookingService::create(['name' => $name, 'service_type' => 'standard', 'duration_min' => 30, 'deposit_amount' => 0, 'buffer_min' => 0, 'is_active' => true]);
        $service->storeLocations()->sync(collect($branches)->pluck('id'));
        return $service;
    }
}
