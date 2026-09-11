<?php

namespace Tests\Feature;

use App\Models\Booking\BookingProduct;
use App\Models\Booking\BookingProductCategory;
use App\Models\Booking\BookingService;
use App\Models\Ecommerce\Category;
use App\Models\Ecommerce\Product;
use App\Models\Ecommerce\StoreLocation;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

class PosProductCategoryBranchVisibilityTest extends TestCase
{
    use RefreshDatabase;

    public function test_product_categories_use_the_same_branch_eligibility_as_the_pos_catalogue(): void
    {
        [$one, $two] = [$this->branch('ONE'), $this->branch('TWO')];
        $oneOnly = $this->category('One only');
        $both = $this->category('Both');
        $inactiveOnly = $this->category('Inactive only');

        $this->product('One product', [$one], [$oneOnly]);
        $this->product('Shared product', [$one, $two], [$both]);
        $this->product('Inactive product', [$two], [$inactiveOnly], false);

        $oneIds = Category::query()->whereHas('products', fn ($products) => $products->posEligibleAtBranch($one->id))->pluck('id');
        $twoIds = Category::query()->whereHas('products', fn ($products) => $products->posEligibleAtBranch($two->id))->pluck('id');

        $this->assertEqualsCanonicalizing([$oneOnly->id, $both->id], $oneIds->all());
        $this->assertSame([$both->id], $twoIds->all());
        $this->assertSame(
            Product::query()->posEligibleAtBranch($two->id)->whereHas('categories', fn ($query) => $query->whereKey($both->id))->count(),
            $both->products()->posEligibleAtBranch($two->id)->count(),
        );
    }

    public function test_booking_product_categories_cover_standalone_and_service_linked_effective_availability(): void
    {
        [$one, $two] = [$this->branch('ONE'), $this->branch('TWO')];
        $standaloneCategory = BookingProductCategory::create(['name' => 'Standalone', 'is_active' => true]);
        $linkedCategory = BookingProductCategory::create(['name' => 'Linked', 'is_active' => true]);
        $inactiveCategory = BookingProductCategory::create(['name' => 'Inactive item', 'is_active' => true]);

        $standalone = BookingProduct::create(['name' => 'Standalone product', 'price' => 10, 'is_active' => true]);
        $standalone->categories()->attach($standaloneCategory);
        $standalone->storeLocations()->attach($one);

        $linked = BookingProduct::create(['name' => 'Linked product', 'price' => 20, 'is_active' => true]);
        $linked->categories()->attach($linkedCategory);
        $service = BookingService::create(['name' => 'Linked service', 'duration_min' => 30, 'is_active' => true]);
        $service->linked_booking_product_id = $linked->id;
        $service->save();
        $service->storeLocations()->attach($two);

        $inactive = BookingProduct::create(['name' => 'Inactive product', 'price' => 30, 'is_active' => false]);
        $inactive->categories()->attach($inactiveCategory);
        $inactive->storeLocations()->attach($two);

        $this->assertSame([$standaloneCategory->id], BookingProductCategory::query()->visibleAtPosBranch($one->id)->pluck('id')->all());
        $this->assertSame([$linkedCategory->id], BookingProductCategory::query()->visibleAtPosBranch($two->id)->pluck('id')->all());
        $this->assertTrue(BookingProduct::query()->posEligibleAtBranch($two->id)->whereKey($linked->id)->exists());
    }

    public function test_category_discovery_query_count_is_constant_as_categories_grow(): void
    {
        $branch = $this->branch('ONE');
        $this->product('First', [$branch], [$this->category('First')]);

        DB::flushQueryLog();
        DB::enableQueryLog();
        Category::query()->whereHas('products', fn ($products) => $products->posEligibleAtBranch($branch->id))->get();
        $initialQueries = count(DB::getQueryLog());

        foreach (range(2, 12) as $number) {
            $this->product('Product '.$number, [$branch], [$this->category('Category '.$number)]);
        }

        DB::flushQueryLog();
        Category::query()->whereHas('products', fn ($products) => $products->posEligibleAtBranch($branch->id))->get();
        $this->assertSame($initialQueries, count(DB::getQueryLog()));
        $this->assertSame(1, $initialQueries);
        DB::disableQueryLog();
    }

    private function branch(string $code): StoreLocation
    {
        return StoreLocation::create([
            'name' => 'Branch '.$code, 'code' => $code, 'address_line1' => 'x', 'city' => 'x',
            'state' => 'x', 'postcode' => '1', 'is_active' => true, 'is_pos_available' => true,
        ]);
    }

    private function category(string $name): Category
    {
        return Category::create(['name' => $name, 'slug' => str($name)->slug().'-'.uniqid(), 'is_active' => true]);
    }

    private function product(string $name, array $branches, array $categories, bool $active = true): Product
    {
        $product = Product::create(['name' => $name, 'slug' => str($name)->slug().'-'.uniqid(), 'price' => 10, 'is_active' => $active, 'is_reward_only' => false]);
        $product->categories()->attach(collect($categories)->pluck('id'));
        foreach ($branches as $branch) {
            $product->storeLocations()->attach($branch->id, ['is_available' => true]);
        }

        return $product;
    }
}
