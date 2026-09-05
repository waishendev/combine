<?php

namespace Tests\Feature;

use App\Models\Booking\Booking;
use App\Models\Booking\BookingBlock;
use App\Models\Booking\BookingService;
use App\Models\Booking\BookingStaffSchedule;
use App\Models\Booking\BookingStaffTimeoff;
use App\Models\Booking\BookingLeaveRequest;
use App\Models\Ecommerce\StoreLocation;
use App\Models\Staff;
use App\Models\User;
use App\Services\Booking\BookingAvailabilityService;
use App\Services\Booking\BookingBranchScheduleService;
use Carbon\Carbon;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Validation\ValidationException;
use Tests\TestCase;

class BookingBranchSchedulingTest extends TestCase
{
    use RefreshDatabase;

    public function test_non_overlapping_same_day_branch_schedules_are_supported(): void
    {
        [$staff, $a, $b] = $this->workplace();
        BookingStaffSchedule::create($this->schedule($staff, $a, 1, '10:00', '14:00'));
        app(BookingBranchScheduleService::class)->assertScheduleDoesNotOverlap($staff->id, 1, '15:00', '19:00', true);
        BookingStaffSchedule::create($this->schedule($staff, $b, 1, '15:00', '19:00'));
        $this->assertDatabaseCount('booking_staff_schedules', 2);
    }

    public function test_cross_branch_schedule_overlap_is_rejected(): void
    {
        [$staff, $a] = $this->workplace();
        BookingStaffSchedule::create($this->schedule($staff, $a, 1, '10:00', '15:00'));
        $this->expectException(ValidationException::class);
        app(BookingBranchScheduleService::class)->assertScheduleDoesNotOverlap($staff->id, 1, '14:00', '18:00', true);
    }

    public function test_availability_requires_schedule_at_selected_branch(): void
    {
        [$staff, $a, $b] = $this->workplace();
        $service = BookingService::create(['name'=>'Gel','service_type'=>'standard','duration_min'=>60,'buffer_min'=>0]);
        BookingStaffSchedule::create($this->schedule($staff, $a, 1, '10:00', '14:00'));
        BookingStaffSchedule::create($this->schedule($staff, $b, 1, '15:00', '19:00'));
        $availability = app(BookingAvailabilityService::class);
        $monday = Carbon::parse('next monday')->addWeeks(2);
        $this->assertTrue($availability->isWithinStaffAvailability($staff->id, $monday->copy()->setTime(11,0), $monday->copy()->setTime(12,0), $a->id));
        $this->assertFalse($availability->isWithinStaffAvailability($staff->id, $monday->copy()->setTime(11,0), $monday->copy()->setTime(12,0), $b->id));
        $this->assertTrue($availability->isWithinStaffAvailability($staff->id, $monday->copy()->setTime(16,0), $monday->copy()->setTime(17,0), $b->id));
    }

    public function test_timeoff_and_blocks_are_branch_specific_while_booking_collision_is_global(): void
    {
        [$staff, $a, $b] = $this->workplace();
        $service = BookingService::create(['name'=>'Gel','service_type'=>'standard','duration_min'=>60,'buffer_min'=>0]);
        $monday = Carbon::parse('next monday')->addWeeks(2);
        $start = $monday->copy()->setTime(11,0); $end = $monday->copy()->setTime(12,0);
        BookingStaffTimeoff::create(['staff_id'=>$staff->id,'store_location_id'=>$a->id,'start_at'=>$start,'end_at'=>$end,'reason'=>'A only']);
        BookingBlock::create(['scope'=>'STORE','store_location_id'=>$a->id,'start_at'=>$start,'end_at'=>$end]);
        $availability = app(BookingAvailabilityService::class);
        $this->assertTrue($availability->hasConflict($staff->id,$start,$end,0,null,null,BookingAvailabilityService::SCOPE_CUSTOMER,[],[],$a->id));
        $this->assertFalse($availability->hasConflict($staff->id,$start,$end,0,null,null,BookingAvailabilityService::SCOPE_CUSTOMER,[],[],$b->id));
        Booking::create(['source'=>'STAFF','staff_id'=>$staff->id,'service_id'=>$service->id,'store_location_id'=>$a->id,'start_at'=>$start,'end_at'=>$end,'status'=>'CONFIRMED']);
        $this->assertTrue($availability->hasConflict($staff->id,$start->copy()->addMinutes(30),$end->copy()->addMinutes(30),0,null,null,BookingAvailabilityService::SCOPE_CUSTOMER,[],[],$b->id));
    }

    public function test_booking_disabled_branch_schedule_remains_listed_and_readable_but_cannot_be_created_active(): void
    {
        [$staff, $branch] = $this->workplace();
        $actor = User::factory()->create();
        $actor->storeLocations()->attach($branch->id);
        $schedule = BookingStaffSchedule::create($this->schedule($staff, $branch, 1, '10:00', '18:00'));
        $branch->update(['is_booking_available' => false]);

        $this->actingAs($actor)->getJson('/api/admin/booking/staff-schedules?branch_store_location_id='.$branch->id)
            ->assertOk()->assertJsonPath('data.data.0.id', $schedule->id)
            ->assertJsonPath('data.data.0.store_location.is_booking_available', false);
        $this->actingAs($actor)->getJson('/api/admin/booking/staff-schedules/'.$schedule->id)
            ->assertOk()->assertJsonPath('data.id', $schedule->id);
        $this->actingAs($actor)->putJson('/api/admin/booking/staff-schedules/'.$schedule->id, ['is_active' => false])
            ->assertOk()->assertJsonPath('data.is_active', false);
        $this->actingAs($actor)->putJson('/api/admin/booking/staff-schedules/'.$schedule->id, ['is_active' => true])
            ->assertUnprocessable()->assertJsonValidationErrors('store_location_id');
        $this->actingAs($actor)->postJson('/api/admin/booking/staff-schedules', $this->schedule($staff, $branch, 2, '10:00', '18:00'))
            ->assertUnprocessable()->assertJsonValidationErrors('store_location_id');

        $prepared = $this->actingAs($actor)->postJson('/api/admin/booking/staff-schedules', array_merge(
            $this->schedule($staff, $branch, 2, '10:00', '18:00'),
            ['is_active' => false],
        ))->assertCreated()->assertJsonPath('data.is_active', false)->json('data');

        $branch->update(['is_booking_available' => true]);
        $this->actingAs($actor)->putJson('/api/admin/booking/staff-schedules/'.$prepared['id'], ['is_active' => true])
            ->assertOk()->assertJsonPath('data.is_active', true);
    }

    public function test_inactive_schedules_do_not_participate_in_overlap_validation_or_slots(): void
    {
        [$staff, $a, $b] = $this->workplace();
        $active = BookingStaffSchedule::create($this->schedule($staff, $a, 1, '10:00', '15:00'));
        $inactive = BookingStaffSchedule::create(array_merge($this->schedule($staff, $b, 1, '14:00', '18:00'), ['is_active' => false]));
        $service = app(BookingBranchScheduleService::class);

        $service->assertScheduleDoesNotOverlap($staff->id, 1, '11:00', '17:00', false);
        $service->assertScheduleDoesNotOverlap($staff->id, 1, '15:00', '18:00', true);
        try {
            $service->assertScheduleDoesNotOverlap($staff->id, 1, '14:30', '17:00', true, $inactive->id);
            $this->fail('Activating an overlapping inactive schedule should fail.');
        } catch (ValidationException) {
            $this->assertTrue(true);
        }
        $service->assertScheduleDoesNotOverlap($staff->id, 1, '10:00', '15:00', true, $active->id);

        $bookingService = BookingService::create(['name'=>'Gel','service_type'=>'standard','duration_min'=>60,'buffer_min'=>0]);
        $monday = Carbon::parse('next monday')->addWeeks(2);
        $this->assertFalse(app(BookingAvailabilityService::class)->isWithinStaffAvailability($staff->id, $monday->copy()->setTime(16, 0), $monday->copy()->setTime(17, 0), $b->id));
        $this->assertSame([], app(BookingAvailabilityService::class)->getAvailableSlots($bookingService, $staff->id, $monday->toDateString(), 15, 0, true, $b->id));
    }

    public function test_booking_disabled_branch_never_generates_public_slots(): void
    {
        [$staff, $branch] = $this->workplace();
        BookingStaffSchedule::create($this->schedule($staff, $branch, 1, '10:00', '18:00'));
        $service = BookingService::create(['name'=>'Gel','service_type'=>'standard','duration_min'=>60,'buffer_min'=>0]);
        $branch->update(['is_booking_available' => false]);
        $monday = Carbon::parse('next monday')->addWeeks(2);
        $this->assertSame([], app(BookingAvailabilityService::class)->getAvailableSlots($service, $staff->id, $monday->toDateString(), 15, 0, true, $branch->id));
    }

    public function test_public_pooled_slots_apply_every_branch_availability_gate(): void
    {
        Carbon::setTestNow('2026-09-07 08:00:00');
        [$staff, $branchA, $branchB] = $this->workplace();
        $otherStaff = Staff::create(['name'=>'Bob','email'=>'bob@test.test','is_active'=>true]);
        $otherStaff->storeLocations()->sync([$branchB->id]);
        $service = BookingService::create(['name'=>'Gel','service_type'=>'standard','duration_min'=>60,'buffer_min'=>0]);
        $service->storeLocations()->sync([$branchA->id]);
        $service->allowedStaffs()->attach($staff->id, ['is_active'=>true]);
        $service->allowedStaffs()->attach($otherStaff->id, ['is_active'=>true]);
        BookingStaffSchedule::create($this->schedule($staff, $branchA, 1, '10:00', '14:00'));
        BookingStaffSchedule::create($this->schedule($otherStaff, $branchB, 1, '10:00', '14:00'));
        $date = '2026-09-14';

        $response = $this->getJson("/api/booking/availability/pooled?service_id={$service->id}&date={$date}&store_location_id={$branchA->id}")
            ->assertOk();
        $this->assertSame([$staff->id], $response->json('data.visible_slots.0.available_staff_ids'));
        $this->assertSame('2026-09-14T10:00:00+08:00', $response->json('data.visible_slots.0.start_at'));

        $this->getJson("/api/booking/availability/pooled?service_id={$service->id}&date={$date}&store_location_id={$branchB->id}")
            ->assertUnprocessable();

        BookingStaffTimeoff::create(['staff_id'=>$staff->id,'store_location_id'=>$branchB->id,'start_at'=>'2026-09-14 10:00:00','end_at'=>'2026-09-14 11:00:00']);
        BookingLeaveRequest::create(['staff_id'=>$staff->id,'store_location_id'=>$branchB->id,'leave_type'=>'off_day','day_type'=>'full_day','start_date'=>$date,'end_date'=>$date,'days'=>1,'status'=>'approved']);
        $this->getJson("/api/booking/availability/pooled?service_id={$service->id}&date={$date}&store_location_id={$branchA->id}")
            ->assertOk()->assertJsonPath('data.visible_slots.0.start_at', '2026-09-14T10:00:00+08:00');

        $sameBranchTimeoff = BookingStaffTimeoff::create(['staff_id'=>$staff->id,'store_location_id'=>$branchA->id,'start_at'=>'2026-09-14 10:00:00','end_at'=>'2026-09-14 11:00:00']);
        $this->getJson("/api/booking/availability/pooled?service_id={$service->id}&date={$date}&store_location_id={$branchA->id}")
            ->assertOk()->assertJsonMissing(['start_at'=>'2026-09-14T10:00:00+08:00']);
        $sameBranchTimeoff->delete();

        $sameBranchLeave = BookingLeaveRequest::create(['staff_id'=>$staff->id,'store_location_id'=>$branchA->id,'leave_type'=>'off_day','day_type'=>'full_day','start_date'=>$date,'end_date'=>$date,'days'=>1,'status'=>'approved']);
        $this->getJson("/api/booking/availability/pooled?service_id={$service->id}&date={$date}&store_location_id={$branchA->id}")
            ->assertOk()->assertJsonMissing(['start_at'=>'2026-09-14T10:00:00+08:00']);
        $sameBranchLeave->delete();

        $legacyUnattributedTimeoff = BookingStaffTimeoff::create(['staff_id'=>$staff->id,'store_location_id'=>null,'start_at'=>'2026-09-14 10:00:00','end_at'=>'2026-09-14 11:00:00']);
        $this->getJson("/api/booking/availability/pooled?service_id={$service->id}&date={$date}&store_location_id={$branchA->id}")
            ->assertOk()->assertJsonPath('data.visible_slots.0.start_at', '2026-09-14T10:00:00+08:00');
        $legacyUnattributedTimeoff->delete();

        Booking::create(['source'=>'STAFF','staff_id'=>$staff->id,'service_id'=>$service->id,'store_location_id'=>$branchA->id,'start_at'=>'2026-09-14 10:00:00','end_at'=>'2026-09-14 11:00:00','status'=>'CONFIRMED']);
        $this->getJson("/api/booking/availability/pooled?service_id={$service->id}&date={$date}&store_location_id={$branchA->id}")
            ->assertOk()->assertJsonMissing(['start_at'=>'2026-09-14T10:00:00+08:00']);

        Carbon::setTestNow();
    }

    private function workplace(): array
    {
        $base=['address_line1'=>'Test','city'=>'Test','state'=>'Test','postcode'=>'10000','is_active'=>true,'is_booking_available'=>true];
        $a=StoreLocation::create($base+['name'=>'A','code'=>'A']); $b=StoreLocation::create($base+['name'=>'B','code'=>'B']);
        $staff=Staff::create(['name'=>'Alice','email'=>'alice@test.test','is_active'=>true]); $staff->storeLocations()->sync([$a->id,$b->id]);
        return [$staff,$a,$b];
    }

    private function schedule(Staff $staff, StoreLocation $branch, int $day, string $start, string $end): array
    {
        return ['staff_id'=>$staff->id,'store_location_id'=>$branch->id,'day_of_week'=>$day,'start_time'=>$start,'end_time'=>$end,'is_active'=>true];
    }
}
