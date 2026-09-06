<?php

namespace Tests\Feature;

use App\Models\Ecommerce\PosCashPoolAccount;
use App\Models\Ecommerce\PosCashShift;
use App\Models\Ecommerce\StoreLocation;
use App\Models\Permission;
use App\Models\Role;
use App\Models\Staff;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class CashShiftReportBranchAvailabilityTest extends TestCase
{
    use RefreshDatabase;

    public function test_specific_report_accepts_accessible_branches_regardless_of_current_availability(): void
    {
        $actor = $this->actor();
        $available = $this->branch('AVAILABLE');
        $posDisabled = $this->branch('POS-OFF', ['is_pos_available' => false]);
        $bookingDisabled = $this->branch('BOOKING-OFF', ['is_booking_available' => false]);
        $actor->storeLocations()->sync([$available->id, $posDisabled->id, $bookingDisabled->id]);

        foreach ([$available, $posDisabled, $bookingDisabled] as $branch) {
            $this->closedShift($branch);

            $this->actingAs($actor)
                ->getJson('/api/ecommerce/reports/cash-shifts/summary?store_location_id='.$branch->id)
                ->assertOk();
            $this->actingAs($actor)
                ->getJson('/api/ecommerce/reports/cash-shifts?branch_store_location_id='.$branch->id)
                ->assertOk()
                ->assertJsonPath('data.total', 1)
                ->assertJsonPath('data.data.0.store_location_id', $branch->id);
        }
    }

    public function test_specific_report_rejects_inaccessible_and_invalid_branches(): void
    {
        $actor = $this->actor();
        $inaccessible = $this->branch('DENIED', ['is_pos_available' => false]);

        $this->actingAs($actor)
            ->getJson('/api/ecommerce/reports/cash-shifts/summary?store_location_id='.$inaccessible->id)
            ->assertForbidden();
        $this->actingAs($actor)
            ->getJson('/api/ecommerce/reports/cash-shifts?branch_store_location_id='.$inaccessible->id)
            ->assertForbidden();
        $this->actingAs($actor)
            ->getJson('/api/ecommerce/reports/cash-shifts/summary?store_location_id=0')
            ->assertUnprocessable()
            ->assertJsonValidationErrors('store_location_id');
        $this->actingAs($actor)
            ->getJson('/api/ecommerce/reports/cash-shifts?branch_store_location_id=999999')
            ->assertForbidden();
        $this->actingAs($actor)
            ->getJson('/api/ecommerce/reports/cash-shifts?branch_store_location_id=0')
            ->assertUnprocessable()
            ->assertJsonValidationErrors('branch_store_location_id');
    }

    public function test_all_report_is_the_accessible_branch_union_including_pos_disabled_history(): void
    {
        $actor = $this->actor();
        $available = $this->branch('AVAILABLE');
        $historical = $this->branch('HISTORICAL', ['is_pos_available' => false, 'is_booking_available' => false]);
        $inaccessible = $this->branch('DENIED');
        $actor->storeLocations()->sync([$available->id, $historical->id]);
        foreach ([$available, $historical, $inaccessible] as $branch) {
            $this->closedShift($branch);
            PosCashPoolAccount::query()->updateOrCreate(
                ['store_location_id' => $branch->id, 'code' => 'default'],
                ['total_initial_cash' => $branch->id, 'total_withdraw' => 0],
            );
        }
        PosCashShift::create([
            'store_location_id' => null,
            'event_type' => PosCashShift::EVENT_CLOSE,
            'status' => PosCashShift::STATUS_CLOSED,
            'opened_at' => now()->subHour(),
            'closed_at' => now(),
            'opening_amount' => 0,
            'closing_amount' => 0,
            'cash_sales_snapshot' => 0,
        ]);

        $response = $this->actingAs($actor)->getJson('/api/ecommerce/reports/cash-shifts?per_page=100')
            ->assertOk()
            ->assertJsonPath('data.total', 2);

        $ids = collect($response->json('data.data'))->pluck('store_location_id')->all();
        $this->assertEqualsCanonicalizing([$available->id, $historical->id], $ids);

        $summary = $this->actingAs($actor)->getJson('/api/ecommerce/reports/cash-shifts/summary')
            ->assertOk()
            ->assertJsonPath('data.scope', 'all_accessible_branches');
        $summaryIds = collect($summary->json('data.branch_pool_breakdown'))->pluck('store_location_id')->all();
        $this->assertEqualsCanonicalizing([$available->id, $historical->id], $summaryIds);
    }

    public function test_live_cash_shift_operations_still_require_pos_availability(): void
    {
        $actor = $this->actor();
        $branch = $this->branch('POS-OFF', ['is_pos_available' => false]);
        $actor->storeLocations()->attach($branch);
        $staff = Staff::create(['name' => 'Cashier', 'email' => 'cashier-report@example.test', 'is_active' => true]);

        $this->actingAs($actor)
            ->postJson('/api/pos/cash-shifts/open', [
                'store_location_id' => $branch->id,
                'opened_staff_id' => $staff->id,
                'opening_amount' => 0,
            ])
            ->assertUnprocessable()
            ->assertJsonValidationErrors('store_location_id');
    }

    private function actor(): User
    {
        $role = Role::create(['name' => 'cash-shift-report-'.uniqid(), 'is_active' => true, 'is_system' => false]);
        foreach (['ecommerce.reports.sales.view', 'pos.checkout'] as $slug) {
            $permission = Permission::firstOrCreate(['slug' => $slug], ['name' => $slug]);
            $role->permissions()->attach($permission);
        }
        $user = User::factory()->create();
        $user->roles()->attach($role);

        return $user;
    }

    private function branch(string $code, array $overrides = []): StoreLocation
    {
        return StoreLocation::create(array_merge([
            'name' => 'Branch '.$code,
            'code' => $code,
            'address_line1' => 'x',
            'city' => 'x',
            'state' => 'x',
            'postcode' => '1',
            'is_active' => true,
            'is_pos_available' => true,
            'is_booking_available' => true,
        ], $overrides));
    }

    private function closedShift(StoreLocation $branch): PosCashShift
    {
        return PosCashShift::create([
            'store_location_id' => $branch->id,
            'event_type' => PosCashShift::EVENT_CLOSE,
            'status' => PosCashShift::STATUS_CLOSED,
            'opened_at' => now()->subHour(),
            'closed_at' => now(),
            'opening_amount' => 10,
            'closing_amount' => 10,
            'cash_sales_snapshot' => 0,
        ]);
    }
}
