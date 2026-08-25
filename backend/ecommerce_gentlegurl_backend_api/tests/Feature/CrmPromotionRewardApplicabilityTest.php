<?php

namespace Tests\Feature;

use App\Http\Controllers\Ecommerce\LoyaltyRewardController;
use App\Http\Controllers\Ecommerce\PromotionController;
use App\Models\Ecommerce\LoyaltyReward;
use App\Models\Ecommerce\Product;
use App\Models\Ecommerce\StoreLocation;
use App\Models\Promotion;
use App\Models\User;
use App\Services\StoreLocationAccessService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\Request;
use Tests\TestCase;

class CrmPromotionRewardApplicabilityTest extends TestCase
{
    use RefreshDatabase;

    public function test_promotion_list_exposes_only_accessible_applicability_and_scopes_specific_branch(): void
    {
        [$png, $branchB, $hidden] = [$this->branch('PNG'), $this->branch('B'), $this->branch('HIDDEN')];
        $user = User::factory()->create();
        $user->storeLocations()->attach([$png->id, $branchB->id]);

        $online = Promotion::create(['title' => 'Online only', 'name' => 'Online only', 'is_active' => true, 'is_online_enabled' => true]);
        $mixed = Promotion::create(['title' => 'Mixed', 'name' => 'Mixed', 'is_active' => true, 'is_online_enabled' => true]);
        $mixed->offlineStoreLocations()->sync([$png->id, $hidden->id]);
        $other = Promotion::create(['title' => 'B only', 'name' => 'B only', 'is_active' => true, 'is_online_enabled' => false]);
        $other->offlineStoreLocations()->sync([$branchB->id]);

        $all = $this->promotionIndex($user);
        $mixedPayload = collect($all)->firstWhere('id', $mixed->id);
        $this->assertSame(['PNG'], collect($mixedPayload['offline_store_locations'])->pluck('name')->all());
        $this->assertTrue(collect($all)->contains('id', $online->id));

        $pngRows = $this->promotionIndex($user, $png->id);
        $this->assertEqualsCanonicalizing([$online->id, $mixed->id], collect($pngRows)->pluck('id')->all());
        $this->assertFalse(collect($pngRows)->contains('id', $other->id));
    }

    public function test_reward_identity_stays_global_and_availability_comes_from_product_pivot(): void
    {
        [$png, $branchB, $hidden] = [$this->branch('PNG'), $this->branch('B'), $this->branch('HIDDEN')];
        $user = User::factory()->create();
        $user->storeLocations()->attach([$png->id, $branchB->id]);
        $product = Product::create(['name' => 'Hair dryer', 'slug' => 'hair-dryer', 'sku' => 'HD', 'type' => 'single', 'price' => 1, 'stock' => 3, 'is_active' => true]);
        $product->storeLocations()->sync([
            $png->id => ['is_available' => true],
            $branchB->id => ['is_available' => true],
            $hidden->id => ['is_available' => true],
        ]);
        $reward = LoyaltyReward::create(['title' => 'Reward Hair Dryer', 'type' => 'product', 'points_required' => 10, 'product_id' => $product->id, 'is_active' => true]);

        $all = $this->rewardIndex($user);
        $payload = collect($all)->firstWhere('id', $reward->id);
        $this->assertEqualsCanonicalizing(['PNG', 'Branch B'], collect($payload['product']['store_locations'])->pluck('name')->all());
        $this->assertTrue($payload['product']['available_at_all_accessible_branches']);
        $this->assertFalse(\Schema::hasColumn('loyalty_rewards', 'store_location_id'));

        $this->assertCount(1, $this->rewardIndex($user, $png->id));
        $product->storeLocations()->updateExistingPivot($png->id, ['is_available' => false]);
        $this->assertCount(0, $this->rewardIndex($user, $png->id));
    }

    private function promotionIndex(User $user, ?int $branchId = null): array
    {
        $request = Request::create('/promotions', 'GET', array_filter(['branch_store_location_id' => $branchId]));
        $request->setUserResolver(fn () => $user);
        return app(PromotionController::class)->index($request, app(StoreLocationAccessService::class))->getData(true)['data']['data'];
    }

    private function rewardIndex(User $user, ?int $branchId = null): array
    {
        $request = Request::create('/loyalty/rewards', 'GET', array_filter(['type' => 'product', 'branch_store_location_id' => $branchId]));
        $request->setUserResolver(fn () => $user);
        return app(LoyaltyRewardController::class)->index($request, app(StoreLocationAccessService::class))->getData(true)['data']['data'];
    }

    private function branch(string $code): StoreLocation
    {
        return StoreLocation::create(['name' => $code === 'B' ? 'Branch B' : $code, 'code' => $code, 'address_line1' => 'x', 'city' => 'x', 'state' => 'x', 'postcode' => '1', 'is_active' => true, 'is_pos_available' => true]);
    }
}
