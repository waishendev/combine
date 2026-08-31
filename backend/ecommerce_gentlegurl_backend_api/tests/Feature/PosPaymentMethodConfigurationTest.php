<?php
namespace Tests\Feature;
use App\Models\Ecommerce\StoreLocation;
use App\Models\PosPaymentMethod;
use App\Services\PosPaymentMethodService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;
use Tests\TestCase;
class PosPaymentMethodConfigurationTest extends TestCase {
 use RefreshDatabase;
 public function test_new_branch_has_deterministic_cash_only_safe_default(): void { $b=$this->branch('NEW'); $c=app(PosPaymentMethodService::class)->configuration($b->id); $this->assertFalse($c['is_configured']); $this->assertSame(['cash'],collect($c['methods'])->where('is_enabled',true)->pluck('key')->all()); }
 public function test_branches_are_independent_and_disabled_method_is_rejected(): void { [$a,$b]=[$this->branch('A'),$this->branch('B')]; $cash=PosPaymentMethod::where('key','cash')->firstOrFail(); $card=PosPaymentMethod::where('key','credit_card')->firstOrFail(); foreach ([[$a,$cash,true],[$a,$card,false],[$b,$cash,false],[$b,$card,true]] as [$branch,$method,$enabled]) DB::table('store_location_pos_payment_methods')->insert(['store_location_id'=>$branch->id,'pos_payment_method_id'=>$method->id,'is_enabled'=>$enabled,'sort_order'=>$method->default_sort_order,'created_at'=>now(),'updated_at'=>now()]); $s=app(PosPaymentMethodService::class); $this->assertSame(['cash'],collect($s->configuration($a->id)['methods'])->where('is_enabled',true)->pluck('key')->all()); $this->assertSame(['credit_card'],collect($s->configuration($b->id)['methods'])->where('is_enabled',true)->pluck('key')->all()); $this->expectException(ValidationException::class); $s->assertAllowed($a->id,[['method'=>'credit_card','amount'=>10]]); }
 public function test_split_payment_remains_valid_when_each_method_is_enabled(): void { $b=$this->branch('SPLIT'); foreach(PosPaymentMethod::all() as $m) DB::table('store_location_pos_payment_methods')->insert(['store_location_id'=>$b->id,'pos_payment_method_id'=>$m->id,'is_enabled'=>true,'sort_order'=>$m->default_sort_order,'created_at'=>now(),'updated_at'=>now()]); app(PosPaymentMethodService::class)->assertAllowed($b->id,[['method'=>'cash'],['method'=>'qrpay']]); $this->addToAssertionCount(1); }
 private function branch(string $code): StoreLocation { return StoreLocation::create(['name'=>"Branch $code",'code'=>$code,'is_active'=>true,'is_pickup_available'=>true,'is_booking_available'=>true,'is_pos_available'=>true,'sort_order'=>1]); }
}
