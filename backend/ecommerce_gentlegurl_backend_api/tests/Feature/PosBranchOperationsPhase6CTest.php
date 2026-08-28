<?php

namespace Tests\Feature;

use App\Models\Ecommerce\BranchInventoryCutoverState;
use App\Models\Ecommerce\PosCashPoolAccount;
use App\Models\Ecommerce\PosCashShift;
use App\Models\Ecommerce\StoreLocation;
use App\Models\Permission;
use App\Models\Role;
use App\Models\Staff;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class PosBranchOperationsPhase6CTest extends TestCase
{
    use RefreshDatabase;

    public function test_current_shift_is_scoped_to_the_requested_branch(): void
    {
        $actor = $this->actor(); [$a, $b] = [$this->branch('A'), $this->branch('B')];
        $actor->storeLocations()->sync([$a->id, $b->id]);
        $staff = Staff::create(['name' => 'Cashier', 'email' => 'cashier@example.test', 'is_active' => true]);
        $this->actingAs($actor)->postJson('/api/pos/cash-shifts/open', [
            'store_location_id' => $a->id, 'opened_staff_id' => $staff->id, 'opening_amount' => 100,
        ])->assertOk()->assertJsonPath('data.shift.store_location_id', $a->id);
        $this->actingAs($actor)->getJson('/api/pos/cash-shifts/current?store_location_id='.$b->id)
            ->assertOk()->assertJsonPath('data.shift', null);
        $this->actingAs($actor)->postJson('/api/pos/cash-shifts/close', [
            'store_location_id' => $b->id, 'closed_staff_id' => $staff->id, 'closing_amount' => 100,
        ])->assertUnprocessable()->assertJsonValidationErrors('store_location_id');
        $this->assertDatabaseHas('pos_cash_shifts', ['store_location_id' => $a->id, 'event_type' => 'OPEN']);
        $this->actingAs($actor)->postJson('/api/pos/cash-shifts/open', [
            'store_location_id' => $b->id, 'opened_staff_id' => $staff->id, 'opening_amount' => 50,
        ])->assertOk()->assertJsonPath('data.shift.store_location_id', $b->id);
        $this->actingAs($actor)->getJson('/api/pos/cash-shifts/current?store_location_id='.$a->id)
            ->assertOk()->assertJsonPath('data.shift.opening_amount', 100);
        $this->actingAs($actor)->getJson('/api/pos/cash-shifts/current?store_location_id='.$b->id)
            ->assertOk()->assertJsonPath('data.shift.opening_amount', 50);
        $this->assertDatabaseCount('pos_cash_shifts', 2);
    }

    public function test_inaccessible_inactive_and_pos_disabled_branches_cannot_open_shift(): void
    {
        $actor = $this->actor(); $staff = Staff::create(['name' => 'Cashier', 'email' => 'cashier2@example.test', 'is_active' => true]);
        $accessible = $this->branch('A'); $actor->storeLocations()->attach($accessible);
        $inaccessible = $this->branch('B');
        $inactive = $this->branch('C', ['is_active' => false]); $actor->storeLocations()->attach($inactive);
        $disabled = $this->branch('D', ['is_pos_available' => false]); $actor->storeLocations()->attach($disabled);
        foreach ([[$inaccessible, 403], [$inactive, 403], [$disabled, 422]] as [$branch, $status]) {
            $this->actingAs($actor)->postJson('/api/pos/cash-shifts/open?store_location_id='.$branch->id, ['opened_staff_id' => $staff->id, 'opening_amount' => 0])->assertStatus($status);
        }
        $this->actingAs($actor)->getJson('/api/pos/cash-shifts/current?store_location_id='.$inaccessible->id)->assertForbidden();
        $this->actingAs($actor)->getJson('/api/pos/cash-shifts/current')->assertUnprocessable()->assertJsonValidationErrors('store_location_id');
        $this->actingAs($actor)->postJson('/api/pos/cash-shifts/open', ['opened_staff_id' => $staff->id, 'opening_amount' => 0])->assertUnprocessable();
    }

    public function test_cash_pools_and_printer_settings_are_independent_per_branch(): void
    {
        $actor = $this->actor(); [$a, $b] = [$this->branch('A'), $this->branch('B')]; $actor->storeLocations()->sync([$a->id, $b->id]);
        PosCashPoolAccount::query()->where('store_location_id', $a->id)->update(['total_initial_cash' => 25]);
        $this->assertSame('0.00', PosCashPoolAccount::query()->where('store_location_id', $b->id)->value('total_initial_cash'));
        $base = ['printer_name' => 'Front', 'connection_type' => 'network', 'ip_address' => '127.0.0.1', 'port' => 9100, 'paper_width' => 80, 'auto_print_receipt' => true];
        $this->actingAs($actor)->putJson('/api/ecommerce/thermal-printer-settings?store_location_id='.$a->id, $base + ['is_enabled' => true, 'copies' => 2])->assertOk();
        $this->actingAs($actor)->putJson('/api/ecommerce/thermal-printer-settings?store_location_id='.$b->id, $base + ['is_enabled' => false, 'copies' => 1])->assertOk();
        $this->actingAs($actor)->getJson('/api/ecommerce/thermal-printer-settings?store_location_id='.$a->id)->assertJsonPath('data.copies', 2)->assertJsonPath('data.is_enabled', true);
        $this->actingAs($actor)->getJson('/api/ecommerce/thermal-printer-settings?store_location_id='.$b->id)->assertJsonPath('data.copies', 1)->assertJsonPath('data.is_enabled', false);
        $this->actingAs($actor)->putJson('/api/ecommerce/thermal-printer-settings', $base + ['is_enabled' => true, 'copies' => 3])->assertUnprocessable();
    }

    public function test_missing_new_branch_pool_is_initialized_without_claiming_legacy_cash(): void
    {
        $actor = $this->actor();
        [$legacyBranch, $newBranch] = [$this->branch('PNG'), $this->branch('NEW')];
        $actor->storeLocations()->sync([$legacyBranch->id, $newBranch->id]);
        PosCashPoolAccount::query()->where('store_location_id', $newBranch->id)->delete();
        $legacy = PosCashPoolAccount::query()->create([
            'store_location_id' => null, 'code' => 'legacy-unresolved',
            'total_initial_cash' => 91, 'total_withdraw' => 17,
        ]);

        $this->actingAs($actor)->getJson('/api/pos/cash-shifts/current?store_location_id='.$newBranch->id)
            ->assertOk()->assertJsonPath('data.shift', null)
            ->assertJsonPath('data.pool_balances.total_initial_cash', 0);

        $this->assertDatabaseHas('pos_cash_pool_accounts', [
            'store_location_id' => $newBranch->id, 'code' => 'default',
            'total_initial_cash' => 0, 'total_withdraw' => 0,
        ]);
        $this->assertNull($legacy->fresh()->store_location_id);
        $this->assertSame('91.00', $legacy->fresh()->total_initial_cash);
    }

    public function test_cutover_visibility_never_activates_and_backfill_preserves_conflicts(): void
    {
        $actor = $this->actor(); $branch = $this->branch('A'); $actor->storeLocations()->attach($branch);
        BranchInventoryCutoverState::create(['store_location_id' => $branch->id, 'status' => BranchInventoryCutoverState::RECONCILED, 'reconciled_at' => now()]);
        $this->actingAs($actor)->getJson('/api/me/store-locations')->assertJsonPath('data.0.inventory_is_authoritative', false)
            ->assertJsonPath('data.0.inventory_cutover_status', 'reconciled');
        $legacy = PosCashShift::create(['opening_amount' => 10, 'opened_at' => now(), 'status' => 'OPEN', 'event_type' => 'OPEN']);
        $this->artisan('pos-branch:backfill', ['--store-code' => 'A', '--dry-run' => true])->assertSuccessful();
        $this->assertNull($legacy->fresh()->store_location_id);
        $this->artisan('pos-branch:backfill', ['--store-code' => 'A', '--force' => true])->assertSuccessful();
        $this->artisan('pos-branch:backfill', ['--store-code' => 'A', '--force' => true])->assertSuccessful();
        $this->assertSame($branch->id, $legacy->fresh()->store_location_id);
        $this->assertDatabaseMissing('branch_inventory_cutover_states', ['store_location_id' => $branch->id, 'status' => 'active']);
    }

    private function actor(): User
    {
        $role = Role::create(['name' => 'phase6c-admin-'.uniqid(), 'is_active' => true, 'is_system' => false]);
        foreach (['pos.checkout', 'ecommerce.thermal-printer-settings.view', 'ecommerce.thermal-printer-settings.update'] as $slug) {
            $permission = Permission::firstOrCreate(['slug' => $slug], ['name' => $slug]); $role->permissions()->attach($permission);
        }
        $user = User::factory()->create(); $user->roles()->attach($role); return $user;
    }
    private function branch(string $code, array $overrides = []): StoreLocation
    {
        return StoreLocation::create(array_merge(['name' => 'Branch '.$code, 'code' => $code, 'address_line1' => 'x', 'city' => 'x', 'state' => 'x', 'postcode' => '1', 'is_active' => true, 'is_pos_available' => true], $overrides));
    }
}
