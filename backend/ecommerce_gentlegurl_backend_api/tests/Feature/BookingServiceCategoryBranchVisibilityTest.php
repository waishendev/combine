<?php

namespace Tests\Feature;

use App\Models\Booking\BookingService;
use App\Models\Booking\BookingServiceCategory;
use App\Models\Ecommerce\StoreLocation;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class BookingServiceCategoryBranchVisibilityTest extends TestCase
{
    use RefreshDatabase;

    public function test_categories_and_counts_are_derived_from_active_services_at_the_selected_branch(): void
    {
        $branchOne = $this->branch('ONE');
        $branchTwo = $this->branch('TWO');

        $oneOnly = $this->category('One only');
        $both = $this->category('Both');
        $inactiveOnly = $this->category('Inactive only');
        $this->category('Empty');

        $this->attachService($oneOnly, 'One service', [$branchOne]);
        $this->attachService($both, 'Both service', [$branchOne, $branchTwo]);
        $this->attachService($both, 'Two service', [$branchTwo]);
        $this->attachService($inactiveOnly, 'Inactive service', [$branchTwo], false);

        $one = $this->getJson('/api/booking/service-categories?store_location_id='.$branchOne->id)->assertOk();
        $this->assertEqualsCanonicalizing(['One only', 'Both'], collect($one->json('data'))->pluck('name')->all());
        $this->assertSame(1, collect($one->json('data'))->firstWhere('name', 'Both')['service_count']);

        $two = $this->getJson('/api/booking/service-categories?store_location_id='.$branchTwo->id)->assertOk();
        $this->assertEqualsCanonicalizing(['Both'], collect($two->json('data'))->pluck('name')->all());
        $this->assertSame(2, collect($two->json('data'))->firstWhere('name', 'Both')['service_count']);
    }

    public function test_branch_is_required_valid_and_authorized_for_crm_users(): void
    {
        $this->getJson('/api/booking/service-categories')->assertUnprocessable();

        $branch = $this->branch('PRIVATE');
        $user = User::factory()->create();
        $this->actingAs($user)->getJson('/api/booking/service-categories?store_location_id='.$branch->id)
            ->assertForbidden();
    }

    public function test_service_list_and_detail_cannot_expose_an_unrelated_or_inactive_service(): void
    {
        $branchOne = $this->branch('ONE');
        $branchTwo = $this->branch('TWO');
        $category = $this->category('Nails');
        $branchOneService = $this->attachService($category, 'One service', [$branchOne]);
        $inactive = $this->attachService($category, 'Inactive', [$branchTwo], false);

        $this->getJson('/api/booking/services?store_location_id='.$branchTwo->id.'&category_id='.$category->id)
            ->assertOk()->assertJsonCount(0, 'data');
        $this->getJson('/api/booking/services/'.$branchOneService->id.'?store_location_id='.$branchTwo->id)
            ->assertNotFound();
        $this->getJson('/api/booking/services/'.$inactive->id.'?store_location_id='.$branchTwo->id)
            ->assertNotFound();
    }

    private function branch(string $code): StoreLocation
    {
        return StoreLocation::create([
            'name' => 'Branch '.$code, 'code' => $code, 'address_line1' => 'x', 'city' => 'x',
            'state' => 'x', 'postcode' => '1', 'is_active' => true, 'is_booking_available' => true,
        ]);
    }

    private function category(string $name): BookingServiceCategory
    {
        return BookingServiceCategory::create([
            'name' => $name, 'slug' => str($name)->slug(), 'is_active' => true,
        ]);
    }

    private function attachService(BookingServiceCategory $category, string $name, array $branches, bool $active = true): BookingService
    {
        $service = BookingService::create([
            'name' => $name, 'service_type' => 'standard', 'duration_min' => 30,
            'deposit_amount' => 0, 'buffer_min' => 0, 'is_active' => $active,
        ]);
        $service->storeLocations()->sync(collect($branches)->pluck('id'));
        $category->services()->attach($service);

        return $service;
    }
}
