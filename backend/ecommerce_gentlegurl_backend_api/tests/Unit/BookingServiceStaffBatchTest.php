<?php

namespace Tests\Unit;

use App\Http\Controllers\Booking\ServiceController;
use App\Models\Booking\BookingService;
use App\Models\Booking\BookingServiceStaff;
use App\Models\Staff;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use ReflectionMethod;
use Tests\TestCase;

class BookingServiceStaffBatchTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();

        foreach ([
            'booking_service_question_options',
            'booking_service_questions',
            'booking_service_primary_slots',
            'booking_service_category_service',
            'booking_service_categories',
            'booking_service_staff',
            'booking_services',
            'staffs',
        ] as $table) {
            Schema::dropIfExists($table);
        }

        Schema::create('staffs', function (Blueprint $table) {
            $table->id();
            $table->string('name');
            $table->string('position')->nullable();
            $table->text('description')->nullable();
            $table->string('avatar_path')->nullable();
            $table->boolean('is_active')->default(true);
            $table->timestamps();
        });

        Schema::create('booking_services', function (Blueprint $table) {
            $table->id();
            $table->string('name');
            $table->string('cn_name')->nullable();
            $table->text('description')->nullable();
            $table->string('service_type')->nullable();
            $table->decimal('service_price', 12, 2)->default(0);
            $table->decimal('price', 12, 2)->nullable();
            $table->string('price_mode')->default('fixed');
            $table->decimal('price_range_min', 12, 2)->nullable();
            $table->decimal('price_range_max', 12, 2)->nullable();
            $table->boolean('is_package_eligible')->default(true);
            $table->boolean('allow_photo_upload')->default(false);
            $table->unsignedInteger('duration_min')->default(60);
            $table->decimal('deposit_amount', 12, 2)->default(0);
            $table->unsignedInteger('buffer_min')->default(0);
            $table->boolean('is_active')->default(true);
            $table->string('image_path')->nullable();
            $table->timestamps();
        });

        Schema::create('booking_service_staff', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('service_id');
            $table->unsignedBigInteger('staff_id');
            $table->boolean('is_active')->default(true);
            $table->timestamps();
        });

        Schema::create('booking_service_categories', function (Blueprint $table) {
            $table->id();
            $table->string('name')->nullable();
            $table->string('cn_name')->nullable();
            $table->boolean('is_active')->default(true);
            $table->timestamps();
        });

        Schema::create('booking_service_category_service', function (Blueprint $table) {
            $table->unsignedBigInteger('booking_service_id');
            $table->unsignedBigInteger('booking_service_category_id');
            $table->timestamps();
        });

        Schema::create('booking_service_questions', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('booking_service_id');
            $table->string('title')->nullable();
            $table->string('cn_title')->nullable();
            $table->text('description')->nullable();
            $table->text('cn_description')->nullable();
            $table->string('question_type')->nullable();
            $table->boolean('is_required')->default(false);
            $table->boolean('is_active')->default(true);
            $table->unsignedInteger('sort_order')->default(0);
            $table->timestamps();
        });

        Schema::create('booking_service_question_options', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('booking_service_question_id');
            $table->string('label')->nullable();
            $table->string('cn_label')->nullable();
            $table->unsignedBigInteger('linked_booking_service_id')->nullable();
            $table->integer('extra_duration_min')->default(0);
            $table->decimal('extra_price', 12, 2)->default(0);
            $table->boolean('is_active')->default(true);
            $table->unsignedInteger('sort_order')->default(0);
            $table->timestamps();
        });

        Schema::create('booking_service_primary_slots', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('booking_service_id');
            $table->string('start_time')->nullable();
            $table->boolean('is_active')->default(true);
            $table->unsignedInteger('sort_order')->default(0);
            $table->timestamps();
        });
    }

    protected function tearDown(): void
    {
        foreach ([
            'booking_service_question_options',
            'booking_service_questions',
            'booking_service_primary_slots',
            'booking_service_category_service',
            'booking_service_categories',
            'booking_service_staff',
            'booking_services',
            'staffs',
        ] as $table) {
            Schema::dropIfExists($table);
        }

        parent::tearDown();
    }

    public function test_batch_staff_payloads_match_per_service_lookups(): void
    {
        $alice = $this->insertStaff('Alice', true);
        $bob = $this->insertStaff('Bob', true);
        $carol = $this->insertStaff('Carol', true);
        $inactiveStaff = $this->insertStaff('Inactive', false);

        $svcA = $this->insertService('Alpha Cut');
        $svcB = $this->insertService('Beta Color');
        $svcC = $this->insertService('Gamma Spa');

        // A: Alice + Bob (active) + inactive staff on pivot (excluded) + inactive pivot row for Carol (excluded)
        $this->attachStaff($svcA, $bob, true);
        $this->attachStaff($svcA, $alice, true);
        $this->attachStaff($svcA, $inactiveStaff, true);
        $this->attachStaff($svcA, $carol, false);

        // B: Carol only
        $this->attachStaff($svcB, $carol, true);

        // C: no staff

        $controller = app(ServiceController::class);
        $batchMethod = new ReflectionMethod(ServiceController::class, 'loadStaffPayloadsByServiceIds');
        $batchMethod->setAccessible(true);
        $mapMethod = new ReflectionMethod(ServiceController::class, 'mapService');
        $mapMethod->setAccessible(true);

        $batched = $batchMethod->invoke($controller, [$svcA, $svcB, $svcC]);

        foreach ([$svcA, $svcB, $svcC] as $serviceId) {
            $service = BookingService::query()->findOrFail($serviceId);
            $legacy = $mapMethod->invoke($controller, $service, false, null);
            $this->assertSame(
                $legacy['staffs'],
                $batched[$serviceId] ?? [],
                "Batched staffs must match legacy mapService for service {$serviceId}"
            );
            $this->assertSame($legacy['staffs'], $legacy['allowed_staffs']);
            $this->assertSame(count($legacy['staffs']), $legacy['allowed_staff_count']);
        }

        // Name order: Alice before Bob
        $this->assertSame(['Alice', 'Bob'], array_column($batched[$svcA], 'name'));
        $this->assertSame(['Carol'], array_column($batched[$svcB], 'name'));
        $this->assertSame([], $batched[$svcC] ?? []);
    }

    public function test_index_payload_matches_legacy_per_service_staff_mapping(): void
    {
        $alice = $this->insertStaff('Alice', true);
        $bob = $this->insertStaff('Zed', true);
        $svcA = $this->insertService('Alpha');
        $svcB = $this->insertService('Beta');
        $this->attachStaff($svcA, $bob, true);
        $this->attachStaff($svcA, $alice, true);
        $this->attachStaff($svcB, $alice, true);

        $controller = app(ServiceController::class);
        $mapMethod = new ReflectionMethod(ServiceController::class, 'mapService');
        $mapMethod->setAccessible(true);

        // Legacy expected: map each service without preload (original path).
        $services = BookingService::query()
            ->where('is_active', true)
            ->orderBy('name')
            ->get();
        $legacyPayload = $services->map(fn (BookingService $service) => $mapMethod->invoke($controller, $service, false, null))->values()->all();

        $response = $controller->index(Request::create('/booking/services', 'GET'));
        $body = $response->getData(true);
        $indexPayload = $body['data'] ?? $body;

        $this->assertSame(
            $this->normalizeForCompare($legacyPayload),
            $this->normalizeForCompare($indexPayload),
            'index() batched staff must produce the same service JSON as legacy per-service staff queries'
        );
    }

    public function test_index_uses_constant_staff_queries_not_per_service(): void
    {
        for ($i = 1; $i <= 5; $i++) {
            $staffId = $this->insertStaff("Staff {$i}", true);
            $serviceId = $this->insertService("Service {$i}");
            $this->attachStaff($serviceId, $staffId, true);
        }

        $controller = app(ServiceController::class);
        DB::flushQueryLog();
        DB::enableQueryLog();
        $controller->index(Request::create('/booking/services', 'GET'));
        $log = DB::getQueryLog();
        DB::disableQueryLog();

        $staffPivotQueries = 0;
        $staffTableQueries = 0;
        foreach ($log as $entry) {
            $sql = strtolower($entry['query'] ?? '');
            if (str_contains($sql, 'booking_service_staff')) {
                $staffPivotQueries++;
            }
            if (preg_match('/\bfrom ["`]?staffs["`]?/', $sql)) {
                $staffTableQueries++;
            }
        }

        $this->assertSame(1, $staffPivotQueries, 'Expected a single batched booking_service_staff query');
        $this->assertSame(1, $staffTableQueries, 'Expected a single batched staffs query');
    }

    private function normalizeForCompare(mixed $value): mixed
    {
        return json_decode(json_encode($value), true);
    }

    private function insertStaff(string $name, bool $active): int
    {
        return (int) DB::table('staffs')->insertGetId([
            'name' => $name,
            'position' => 'Stylist',
            'description' => null,
            'avatar_path' => null,
            'is_active' => $active,
            'created_at' => now(),
            'updated_at' => now(),
        ]);
    }

    private function insertService(string $name): int
    {
        return (int) DB::table('booking_services')->insertGetId([
            'name' => $name,
            'cn_name' => null,
            'description' => null,
            'service_type' => 'STANDARD',
            'service_price' => 10,
            'price' => 10,
            'price_mode' => 'fixed',
            'price_range_min' => null,
            'price_range_max' => null,
            'is_package_eligible' => true,
            'allow_photo_upload' => false,
            'duration_min' => 60,
            'deposit_amount' => 0,
            'buffer_min' => 0,
            'is_active' => true,
            'image_path' => null,
            'created_at' => now(),
            'updated_at' => now(),
        ]);
    }

    private function attachStaff(int $serviceId, int $staffId, bool $active): void
    {
        DB::table('booking_service_staff')->insert([
            'service_id' => $serviceId,
            'staff_id' => $staffId,
            'is_active' => $active,
            'created_at' => now(),
            'updated_at' => now(),
        ]);
    }
}
