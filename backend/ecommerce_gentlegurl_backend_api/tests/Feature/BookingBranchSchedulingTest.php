<?php

namespace Tests\Feature;

use App\Models\Booking\Booking;
use App\Models\Booking\BookingBlock;
use App\Models\Booking\BookingService;
use App\Models\Booking\BookingStaffSchedule;
use App\Models\Booking\BookingStaffTimeoff;
use App\Models\Ecommerce\StoreLocation;
use App\Models\Staff;
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
        app(BookingBranchScheduleService::class)->assertScheduleDoesNotOverlap($staff->id, 1, '15:00', '19:00');
        BookingStaffSchedule::create($this->schedule($staff, $b, 1, '15:00', '19:00'));
        $this->assertDatabaseCount('booking_staff_schedules', 2);
    }

    public function test_cross_branch_schedule_overlap_is_rejected(): void
    {
        [$staff, $a] = $this->workplace();
        BookingStaffSchedule::create($this->schedule($staff, $a, 1, '10:00', '15:00'));
        $this->expectException(ValidationException::class);
        app(BookingBranchScheduleService::class)->assertScheduleDoesNotOverlap($staff->id, 1, '14:00', '18:00');
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
