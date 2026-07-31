<?php

namespace App\Support;

use Carbon\Carbon;
use Illuminate\Database\Eloquent\Builder as EloquentBuilder;
use Illuminate\Database\Query\Builder as QueryBuilder;

/**
 * Sargable start_at day/month filters that match Laravel whereDate() on
 * timestamp-without-time-zone columns storing business-timezone wall clocks.
 */
class PosAppointmentStartAtFilter
{
    /**
     * Half-open [startInclusive, endExclusive) wall-clock bounds as Y-m-d H:i:s.
     *
     * @return array{0: string, 1: string}|null
     */
    public static function bounds(
        ?string $fromDate,
        ?string $toDate,
        ?string $singleDate = null,
        ?string $timezone = null,
    ): ?array {
        $timezone = (string) ($timezone ?: config('app.timezone'));

        if ($fromDate !== null && $fromDate !== '' && $toDate !== null && $toDate !== '') {
            $rangeStart = Carbon::parse($fromDate, $timezone)->startOfDay();
            $rangeEndExclusive = Carbon::parse($toDate, $timezone)->startOfDay()->addDay();

            return [
                $rangeStart->format('Y-m-d H:i:s'),
                $rangeEndExclusive->format('Y-m-d H:i:s'),
            ];
        }

        if ($singleDate !== null && $singleDate !== '') {
            $dayStart = Carbon::parse($singleDate, $timezone)->startOfDay();

            return [
                $dayStart->format('Y-m-d H:i:s'),
                $dayStart->copy()->addDay()->format('Y-m-d H:i:s'),
            ];
        }

        return null;
    }

    /**
     * Apply the sargable filter used by POS appointmentSearch.
     */
    public static function apply(
        EloquentBuilder|QueryBuilder $builder,
        ?string $fromDate,
        ?string $toDate,
        ?string $singleDate = null,
        ?string $timezone = null,
        string $column = 'start_at',
    ): EloquentBuilder|QueryBuilder {
        $bounds = self::bounds($fromDate, $toDate, $singleDate, $timezone);
        if ($bounds === null) {
            return $builder;
        }

        return $builder
            ->where($column, '>=', $bounds[0])
            ->where($column, '<', $bounds[1]);
    }

    /**
     * Legacy whereDate filter (pre-optimization) for equivalence checks.
     */
    public static function applyWhereDate(
        EloquentBuilder|QueryBuilder $builder,
        ?string $fromDate,
        ?string $toDate,
        ?string $singleDate = null,
        string $column = 'start_at',
    ): EloquentBuilder|QueryBuilder {
        if ($fromDate !== null && $fromDate !== '' && $toDate !== null && $toDate !== '') {
            return $builder
                ->whereDate($column, '>=', $fromDate)
                ->whereDate($column, '<=', $toDate);
        }

        if ($singleDate !== null && $singleDate !== '') {
            return $builder->whereDate($column, $singleDate);
        }

        return $builder;
    }
}
