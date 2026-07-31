<?php

namespace Tests\Unit;

use App\Support\PosAppointmentStartAtFilter;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Tests\TestCase;

/**
 * Proves the sargable start_at range returns the same IDs as Laravel whereDate()
 * for timestamp-without-time-zone / datetime wall-clock storage.
 */
class PosAppointmentStartAtFilterEquivalenceTest extends TestCase
{
    private const TABLE = 'pos_start_at_filter_probe';

    protected function setUp(): void
    {
        parent::setUp();

        config(['app.timezone' => 'Asia/Shanghai']);

        Schema::dropIfExists(self::TABLE);
        Schema::create(self::TABLE, function (Blueprint $table) {
            $table->id();
            $table->string('label');
            $table->dateTime('start_at');
        });
    }

    protected function tearDown(): void
    {
        Schema::dropIfExists(self::TABLE);
        parent::tearDown();
    }

    public function test_bounds_match_business_timezone_wall_clock_half_open_day(): void
    {
        $this->assertSame(
            ['2026-07-01 00:00:00', '2026-08-01 00:00:00'],
            PosAppointmentStartAtFilter::bounds('2026-07-01', '2026-07-31', null, 'Asia/Shanghai')
        );
        $this->assertSame(
            ['2026-07-31 00:00:00', '2026-08-01 00:00:00'],
            PosAppointmentStartAtFilter::bounds(null, null, '2026-07-31', 'Asia/Shanghai')
        );
        // Asia/Kuala_Lumpur is also UTC+8 with no DST — same wall-clock bounds.
        $this->assertSame(
            PosAppointmentStartAtFilter::bounds('2026-07-01', '2026-07-31', null, 'Asia/Shanghai'),
            PosAppointmentStartAtFilter::bounds('2026-07-01', '2026-07-31', null, 'Asia/Kuala_Lumpur')
        );
    }

    public function test_midnight_and_end_of_day_appointments_match_wheredate(): void
    {
        $this->seedRows([
            ['label' => 'july1_0000', 'start_at' => '2026-07-01 00:00:00'],
            ['label' => 'july1_2359', 'start_at' => '2026-07-01 23:59:00'],
            ['label' => 'june30_2359', 'start_at' => '2026-06-30 23:59:00'],
            ['label' => 'july2_0000', 'start_at' => '2026-07-02 00:00:00'],
        ]);

        $this->assertFilterIdsMatch(
            from: '2026-07-01',
            to: '2026-07-01',
            single: null,
            expectedLabels: ['july1_0000', 'july1_2359'],
        );
    }

    public function test_first_and_last_day_of_month_match_wheredate(): void
    {
        $this->seedRows([
            ['label' => 'june30_2359', 'start_at' => '2026-06-30 23:59:00'],
            ['label' => 'july1_0000', 'start_at' => '2026-07-01 00:00:00'],
            ['label' => 'july15_1200', 'start_at' => '2026-07-15 12:00:00'],
            ['label' => 'july31_0000', 'start_at' => '2026-07-31 00:00:00'],
            ['label' => 'july31_2359', 'start_at' => '2026-07-31 23:59:00'],
            ['label' => 'aug1_0000', 'start_at' => '2026-08-01 00:00:00'],
        ]);

        $this->assertFilterIdsMatch(
            from: '2026-07-01',
            to: '2026-07-31',
            single: null,
            expectedLabels: ['july1_0000', 'july15_1200', 'july31_0000', 'july31_2359'],
        );
    }

    public function test_utc_plus08_date_boundary_stored_wall_clock_matches_wheredate(): void
    {
        // Business storage is wall-clock in app TZ (UTC+8), not UTC instants.
        // A value that looks like "UTC evening before" is still calendar June 30 for DATE(start_at).
        $this->seedRows([
            ['label' => 'stored_as_june30_1630', 'start_at' => '2026-06-30 16:30:00'],
            ['label' => 'stored_as_july1_0030', 'start_at' => '2026-07-01 00:30:00'],
            ['label' => 'stored_as_july1_0800', 'start_at' => '2026-07-01 08:00:00'],
        ]);

        $this->assertFilterIdsMatch(
            from: null,
            to: null,
            single: '2026-07-01',
            expectedLabels: ['stored_as_july1_0030', 'stored_as_july1_0800'],
        );

        $this->assertFilterIdsMatch(
            from: null,
            to: null,
            single: '2026-06-30',
            expectedLabels: ['stored_as_june30_1630'],
        );
    }

    public function test_single_day_and_month_filters_never_diverge_across_seeded_matrix(): void
    {
        $this->seedRows([
            ['label' => 'a', 'start_at' => '2026-06-30 00:00:00'],
            ['label' => 'b', 'start_at' => '2026-06-30 23:59:59'],
            ['label' => 'c', 'start_at' => '2026-07-01 00:00:00'],
            ['label' => 'd', 'start_at' => '2026-07-01 12:00:00'],
            ['label' => 'e', 'start_at' => '2026-07-01 23:59:59'],
            ['label' => 'f', 'start_at' => '2026-07-31 00:00:00'],
            ['label' => 'g', 'start_at' => '2026-07-31 23:59:59'],
            ['label' => 'h', 'start_at' => '2026-08-01 00:00:00'],
            ['label' => 'i', 'start_at' => '2026-08-01 00:00:01'],
        ]);

        foreach (['2026-06-30', '2026-07-01', '2026-07-31', '2026-08-01'] as $day) {
            $this->assertFilterIdsMatch(from: null, to: null, single: $day, expectedLabels: null);
        }

        $this->assertFilterIdsMatch(from: '2026-07-01', to: '2026-07-31', single: null, expectedLabels: null);
        $this->assertFilterIdsMatch(from: '2026-06-30', to: '2026-08-01', single: null, expectedLabels: null);
    }

    /**
     * @param  list<array{label: string, start_at: string}>  $rows
     */
    private function seedRows(array $rows): void
    {
        DB::table(self::TABLE)->delete();
        foreach ($rows as $row) {
            DB::table(self::TABLE)->insert($row);
        }
    }

    /**
     * @param  list<string>|null  $expectedLabels
     */
    private function assertFilterIdsMatch(?string $from, ?string $to, ?string $single, ?array $expectedLabels): void
    {
        $legacy = PosAppointmentStartAtFilter::applyWhereDate(DB::table(self::TABLE), $from, $to, $single)
            ->orderBy('id')
            ->pluck('id')
            ->map(fn ($id) => (int) $id)
            ->values()
            ->all();

        $sargable = PosAppointmentStartAtFilter::apply(DB::table(self::TABLE), $from, $to, $single)
            ->orderBy('id')
            ->pluck('id')
            ->map(fn ($id) => (int) $id)
            ->values()
            ->all();

        $this->assertSame(
            $legacy,
            $sargable,
            sprintf(
                'whereDate and sargable filters diverged for from=%s to=%s date=%s (legacy=%s sargable=%s)',
                $from ?? 'null',
                $to ?? 'null',
                $single ?? 'null',
                json_encode($legacy),
                json_encode($sargable),
            )
        );

        if ($expectedLabels !== null) {
            $labels = PosAppointmentStartAtFilter::apply(DB::table(self::TABLE), $from, $to, $single)
                ->orderBy('id')
                ->pluck('label')
                ->values()
                ->all();
            $this->assertSame($expectedLabels, $labels);
        }
    }
}
