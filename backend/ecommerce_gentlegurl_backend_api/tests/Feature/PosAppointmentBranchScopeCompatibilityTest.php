<?php

namespace Tests\Feature;

use App\Models\Booking\Booking;
use App\Models\Booking\BookingService;
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

    private function actor(): User
    {
        $role = Role::create(['name' => 'appointment-branch-'.uniqid(), 'is_active' => true, 'is_system' => false]);
        $permission = Permission::firstOrCreate(['slug' => 'pos.appointments.manage'], ['name' => 'POS appointments manage']);
        $role->permissions()->attach($permission);
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
}
