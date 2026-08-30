<?php

namespace Tests\Feature;

use App\Models\Booking\Booking;
use App\Models\Booking\BookingService;
use App\Models\Ecommerce\PosCashShift;
use App\Models\Ecommerce\StoreLocation;
use App\Models\Permission;
use App\Models\Role;
use App\Models\Staff;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class PosAppointmentBranchScopeCompatibilityTest extends TestCase
{
    use RefreshDatabase;

    public function test_pos_appointment_list_is_specific_or_accessible_all_branch_scoped(): void
    {
        $actor = $this->actor();
        [$a, $b, $inaccessible] = [$this->branch('A'), $this->branch('B'), $this->branch('C')];
        $actor->storeLocations()->sync([$a->id, $b->id]);
        [$service, $staff] = $this->eligibleServiceAndStaff([$a, $b, $inaccessible]);
        $bookingA = $this->booking('A-BOOKING', $a->id, $service, $staff);
        $bookingB = $this->booking('B-BOOKING', $b->id, $service, $staff);
        $this->booking('C-BOOKING', $inaccessible->id, $service, $staff);
        $legacy = $this->booking('LEGACY-BOOKING', null, $service, $staff);

        $this->actingAs($actor)->getJson('/api/pos/appointments?store_location_id='.$a->id)
            ->assertOk()->assertJsonCount(1, 'data.data')->assertJsonPath('data.data.0.id', $bookingA->id);
        $this->actingAs($actor)->getJson('/api/pos/appointments?store_location_id='.$b->id)
            ->assertOk()->assertJsonCount(1, 'data.data')->assertJsonPath('data.data.0.id', $bookingB->id);

        $allIds = collect($this->actingAs($actor)->getJson('/api/pos/appointments?include_terminal_statuses=1')
            ->assertOk()->json('data.data'))->pluck('id');
        $this->assertEqualsCanonicalizing([$bookingA->id, $bookingB->id, $legacy->id], $allIds->all());
    }

    public function test_direct_appointment_access_enforces_persisted_branch_and_context(): void
    {
        $actor = $this->actor();
        [$a, $b] = [$this->branch('A'), $this->branch('B')];
        $actor->storeLocations()->attach($a);
        [$service, $staff] = $this->eligibleServiceAndStaff([$a, $b]);
        $bookingA = $this->booking('A-DETAIL', $a->id, $service, $staff);
        $bookingB = $this->booking('B-DETAIL', $b->id, $service, $staff);

        $this->actingAs($actor)->getJson('/api/pos/appointments/'.$bookingA->id.'?store_location_id='.$a->id)
            ->assertOk()->assertJsonPath('data.store_location_id', $a->id);
        $this->actingAs($actor)->getJson('/api/pos/appointments/'.$bookingA->id.'?store_location_id='.$b->id)
            ->assertForbidden();
        $this->actingAs($actor)->getJson('/api/pos/appointments/'.$bookingB->id)->assertForbidden();
    }

    public function test_lightweight_calendar_pushes_filters_and_pagination_to_sql(): void
    {
        config(['app.debug' => true]);
        $actor = $this->actor();
        [$a, $inaccessible] = [$this->branch('CAL-A'), $this->branch('CAL-X')];
        $actor->storeLocations()->attach($a);
        [$service, $staff] = $this->eligibleServiceAndStaff([$a, $inaccessible]);
        $first = $this->booking('CAL-SEARCH-ONE', $a->id, $service, $staff);
        $second = $this->booking('CAL-SEARCH-TWO', $a->id, $service, $staff);
        $this->booking('CAL-SEARCH-HIDDEN', $inaccessible->id, $service, $staff);
        $from = now()->addDay()->toDateString();

        $response = $this->actingAs($actor)->getJson('/api/pos/appointments/calendar?'.http_build_query([
            'store_location_id' => $a->id,
            'from_date' => $from,
            'to_date' => $from,
            'staff_id' => $staff->id,
            'q' => 'CAL-SEARCH',
            'per_page' => 1,
            'page' => 1,
            'profile' => 1,
        ]))->assertOk();

        $this->assertSame(2, $response->json('data.total'));
        $this->assertSame(1, $response->json('data.per_page'));
        $this->assertCount(1, $response->json('data.data'));
        $this->assertContains($response->json('data.data.0.id'), [$first->id, $second->id]);
        $this->assertLessThanOrEqual(8, $response->json('data.profile.query_count'));
        $this->assertSame(1, $response->json('data.profile.rows_hydrated'));
        $this->assertSame(0, $response->json('data.profile.financial_calculations'));

        $this->actingAs($actor)->getJson('/api/pos/appointments/calendar?store_location_id='.$inaccessible->id)
            ->assertForbidden();
        $this->actingAs($actor)->getJson('/api/pos/appointments/calendar?store_location_id='.$a->id.'&customer_id=999999')
            ->assertOk()->assertJsonCount(0, 'data.data');
    }

    public function test_lightweight_calendar_all_scope_returns_only_accessible_branches_with_metadata_and_explicit_legacy_null(): void
    {
        $actor = $this->actor();
        [$a, $b, $inaccessible] = [$this->branch('ALL-A'), $this->branch('ALL-B'), $this->branch('ALL-X')];
        $actor->storeLocations()->sync([$a->id, $b->id]);
        [$service, $staff] = $this->eligibleServiceAndStaff([$a, $b, $inaccessible]);
        $bookingA = $this->booking('ALL-A-BOOKING', $a->id, $service, $staff);
        $bookingB = $this->booking('ALL-B-BOOKING', $b->id, $service, $staff);
        $this->booking('ALL-HIDDEN-BOOKING', $inaccessible->id, $service, $staff);
        $legacy = $this->booking('ALL-LEGACY-BOOKING', null, $service, $staff);

        $rows = collect($this->actingAs($actor)->getJson('/api/pos/appointments/calendar?include_terminal_statuses=1&per_page=20')
            ->assertOk()->json('data.data'));

        $this->assertEqualsCanonicalizing([$bookingA->id, $bookingB->id, $legacy->id], $rows->pluck('id')->all());
        $this->assertSame($a->id, $rows->firstWhere('id', $bookingA->id)['store_location_id']);
        $this->assertSame('Branch ALL-A', $rows->firstWhere('id', $bookingA->id)['store_location']['name']);
        $this->assertSame('ALL-A', $rows->firstWhere('id', $bookingA->id)['store_location']['code']);
        $this->assertNull($rows->firstWhere('id', $legacy->id)['store_location']);
    }

    public function test_mark_completed_uses_the_persisted_appointment_branch_shift_in_specific_and_all_scope(): void
    {
        $actor = $this->actor();
        [$png, $branchB] = [$this->branch('PNG'), $this->branch('B')];
        $actor->storeLocations()->sync([$png->id, $branchB->id]);
        [$service, $staff] = $this->eligibleServiceAndStaff([$png, $branchB]);

        $allWithoutShift = $this->booking('ALL-NO-SHIFT', $png->id, $service, $staff);
        $specificWithoutShift = $this->booking('PNG-NO-SHIFT', $png->id, $service, $staff);
        $this->actingAs($actor)->postJson('/api/pos/appointments/'.$allWithoutShift->id.'/mark-completed')
            ->assertUnprocessable()->assertJsonValidationErrors('store_location_id');
        $this->actingAs($actor)->postJson('/api/pos/appointments/'.$specificWithoutShift->id.'/mark-completed?store_location_id='.$png->id)
            ->assertUnprocessable()->assertJsonValidationErrors('store_location_id');

        $guardedSettlement = $this->booking('ALL-GUARDED-SETTLEMENT', $png->id, $service, $staff);
        $this->actingAs($actor)->postJson('/api/pos/appointments/'.$guardedSettlement->id.'/collect-payment', [
            'payment_method' => 'cash',
        ])->assertUnprocessable()->assertJsonValidationErrors('store_location_id');
        $this->actingAs($actor)->postJson('/api/pos/appointments/'.$guardedSettlement->id.'/finalize-zero-settlement', [
            'payment_method' => 'qrpay',
        ])->assertUnprocessable()->assertJsonValidationErrors('store_location_id');
        $this->actingAs($actor)->postJson('/api/pos/appointments/'.$guardedSettlement->id.'/apply-package')
            ->assertUnprocessable()->assertJsonValidationErrors('store_location_id');

        // Detail historically has no shift gate and remains available in ALL.
        $this->actingAs($actor)->getJson('/api/pos/appointments/'.$guardedSettlement->id)
            ->assertOk()->assertJsonPath('data.store_location_id', $png->id);

        $this->openShift($branchB, $actor, $staff);
        $pngWithOnlyBranchBShift = $this->booking('PNG-WRONG-SHIFT', $png->id, $service, $staff);
        $this->actingAs($actor)->postJson('/api/pos/appointments/'.$pngWithOnlyBranchBShift->id.'/mark-completed')
            ->assertUnprocessable()
            ->assertJsonValidationErrors('store_location_id')
            ->assertJsonPath('errors.store_location_id.0', 'No open cash shift for PNG. Open a PNG cash shift before checkout.');

        $this->openShift($png, $actor, $staff);
        $allWithShift = $this->booking('ALL-WITH-SHIFT', $png->id, $service, $staff);
        $specificWithShift = $this->booking('PNG-WITH-SHIFT', $png->id, $service, $staff);
        $this->actingAs($actor)->postJson('/api/pos/appointments/'.$allWithShift->id.'/mark-completed')
            ->assertOk()->assertJsonPath('data.appointment.status', 'COMPLETED');
        $this->actingAs($actor)->postJson('/api/pos/appointments/'.$specificWithShift->id.'/mark-completed?store_location_id='.$png->id)
            ->assertOk()->assertJsonPath('data.appointment.status', 'COMPLETED');

        $legacy = $this->booking('LEGACY-NO-BRANCH', null, $service, $staff);
        $this->actingAs($actor)->postJson('/api/pos/appointments/'.$legacy->id.'/mark-completed')
            ->assertUnprocessable()->assertJsonValidationErrors('store_location_id');
    }

    public function test_direct_pos_appointment_creation_requires_and_persists_an_eligible_concrete_branch(): void
    {
        $actor = $this->actor();
        [$a, $b] = [$this->branch('CREATE-A'), $this->branch('CREATE-B')];
        $actor->storeLocations()->sync([$a->id, $b->id]);
        [$service, $staff] = $this->eligibleServiceAndStaff([$a]);
        $payload = [
            'booking_service_id' => $service->id,
            'assigned_staff_id' => $staff->id,
            'guest_name' => 'Branch Guest',
            'start_at' => now()->addDays(2)->startOfHour()->toIso8601String(),
            'staff_splits' => [['staff_id' => $staff->id, 'share_percent' => 100]],
        ];

        $this->actingAs($actor)->postJson('/api/pos/appointments', $payload)
            ->assertUnprocessable()->assertJsonValidationErrors('store_location_id');

        $created = $this->actingAs($actor)->postJson('/api/pos/appointments', $payload + ['store_location_id' => $a->id])
            ->assertOk();
        $bookingId = (int) $created->json('data.booking_id');
        $this->assertDatabaseHas('bookings', ['id' => $bookingId, 'store_location_id' => $a->id]);

        $this->actingAs($actor)->postJson('/api/pos/appointments', $payload + ['store_location_id' => $b->id])
            ->assertUnprocessable()->assertJsonValidationErrors('booking_service_id');
    }

    public function test_pos_booking_write_contract_propagates_cart_or_booking_branch_to_every_parent(): void
    {
        $source = file_get_contents(app_path('Http/Controllers/Ecommerce/PosController.php'));

        $this->assertStringContainsString("'store_location_id' => (int) \$cart->store_location_id,\n                    'booking_code'", $source);
        $this->assertGreaterThanOrEqual(3, substr_count($source, "'store_location_id' => (int) \$booking->store_location_id"));
        $this->assertStringContainsString('Appointment settlement must use the persisted Booking Branch.', $source);
        $this->assertStringContainsString('getStaffAvailabilityDiagnostics((int) $serviceItem->assigned_staff_id, $startAt, $endAt, (int) $cart->store_location_id)', $source);
    }

    private function actor(): User
    {
        $role = Role::create(['name' => 'appointment-branch-'.uniqid(), 'is_active' => true, 'is_system' => false]);
        $permissions = collect([
            Permission::firstOrCreate(['slug' => 'pos.appointments.manage'], ['name' => 'POS appointments manage']),
            Permission::firstOrCreate(['slug' => 'pos.appointments.checkout'], ['name' => 'POS appointments checkout']),
        ]);
        $role->permissions()->attach($permissions->pluck('id'));
        $user = User::factory()->create();
        $user->roles()->attach($role);
        return $user;
    }

    private function branch(string $code): StoreLocation
    {
        return StoreLocation::create(['name' => 'Branch '.$code, 'code' => $code, 'address_line1' => 'x', 'city' => 'x', 'state' => 'x', 'postcode' => '1', 'is_active' => true, 'is_booking_available' => true, 'is_pos_available' => true]);
    }

    private function eligibleServiceAndStaff(array $branches): array
    {
        $service = BookingService::create(['name' => 'Gel', 'service_type' => 'standard', 'duration_min' => 30, 'deposit_amount' => 0, 'buffer_min' => 0, 'is_active' => true]);
        $staff = Staff::create(['name' => 'Staff', 'email' => 'staff-'.uniqid().'@test.test', 'is_active' => true]);
        $ids = collect($branches)->pluck('id')->all();
        $service->storeLocations()->sync($ids);
        $staff->storeLocations()->sync($ids);
        $service->allowedStaffs()->attach($staff->id, ['is_active' => true]);
        return [$service, $staff];
    }

    private function booking(string $code, ?int $branchId, BookingService $service, Staff $staff): Booking
    {
        return Booking::create(['booking_code' => $code, 'source' => 'STAFF', 'store_location_id' => $branchId, 'staff_id' => $staff->id, 'service_id' => $service->id, 'start_at' => now()->addDay(), 'end_at' => now()->addDay()->addMinutes(30), 'status' => 'CONFIRMED', 'deposit_amount' => 0, 'payment_status' => 'UNPAID']);
    }

    private function openShift(StoreLocation $branch, User $actor, Staff $staff): PosCashShift
    {
        return PosCashShift::create([
            'store_location_id' => $branch->id,
            'event_type' => PosCashShift::EVENT_OPEN,
            'opening_amount' => 0,
            'opened_by' => $actor->id,
            'opened_staff_id' => $staff->id,
            'opened_at' => now(),
            'status' => PosCashShift::STATUS_OPEN,
        ]);
    }
}
