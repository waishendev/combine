<?php
namespace Tests\Feature;
use App\Models\Booking\BookingService;
use App\Models\Ecommerce\StoreLocation;
use App\Models\Staff;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;
class BookingBranchFoundationTest extends TestCase {
 use RefreshDatabase;
 public function test_assignments_are_multi_branch_unique_and_independently_removable(): void {
  [$a,$b]=$this->branches(); $staff=Staff::create(['name'=>'A','email'=>'a@test.test','is_active'=>true]); $service=BookingService::create($this->service());
  $staff->storeLocations()->sync([$a->id,$b->id]); $service->storeLocations()->sync([$a->id,$b->id]);
  $this->assertTrue($staff->worksAt($a->id) && $staff->worksAt($b->id)); $this->assertTrue($service->isAvailableAt($a->id));
  $staff->storeLocations()->detach($b->id); $this->assertTrue($staff->worksAt($a->id)); $this->assertFalse($staff->worksAt($b->id));
  $this->expectException(\Illuminate\Database\QueryException::class); DB::table('booking_service_store_location')->insert(['booking_service_id'=>$service->id,'store_location_id'=>$a->id]);
 }
 public function test_service_staff_and_branch_are_additive_eligibility_conditions(): void {
  [$a,$b]=$this->branches(); $staff=Staff::create(['name'=>'A','email'=>'b@test.test','is_active'=>true]); $service=BookingService::create($this->service());
  $service->allowedStaffs()->attach($staff->id,['is_active'=>true]); $service->storeLocations()->attach($a->id); $staff->storeLocations()->attach($b->id);
  $this->assertTrue($service->isStaffAllowed($staff->id)); $this->assertFalse($staff->worksAt($a->id)); $staff->storeLocations()->attach($a->id); $this->assertTrue($service->isStaffAllowed($staff->id)&&$staff->worksAt($a->id));
 }
 public function test_backfill_dry_run_is_zero_write_and_force_is_idempotent(): void {
  [$a]=$this->branches(); Staff::create(['name'=>'Legacy','email'=>'c@test.test','is_active'=>true]); BookingService::create($this->service());
  $this->artisan('booking-branch:backfill',['--store-code'=>$a->code,'--dry-run'=>true])->assertSuccessful(); $this->assertDatabaseCount('staff_store_location',0);
  $this->artisan('booking-branch:backfill',['--store-code'=>$a->code,'--force'=>true])->assertSuccessful(); $this->artisan('booking-branch:backfill',['--store-code'=>$a->code,'--force'=>true])->assertSuccessful();
  $this->assertDatabaseCount('staff_store_location',1); $this->assertDatabaseCount('booking_service_store_location',1);
 }
 private function branches(): array { $base=['address_line1'=>'Test','city'=>'Test','state'=>'Test','postcode'=>'10000','is_active'=>true,'is_booking_available'=>true]; return [StoreLocation::create($base+['name'=>'A','code'=>'A']),StoreLocation::create($base+['name'=>'B','code'=>'B'])]; }
 private function service(): array { return ['name'=>'Gel','service_type'=>'standard','duration_min'=>30,'deposit_amount'=>0,'buffer_min'=>0,'is_active'=>true]; }
}
