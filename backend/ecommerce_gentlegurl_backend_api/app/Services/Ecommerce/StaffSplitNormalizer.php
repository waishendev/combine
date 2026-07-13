<?php

namespace App\Services\Ecommerce;

class StaffSplitNormalizer
{
    public const MODE_PERCENT = 'percent';

    public const MODE_AMOUNT = 'amount';

    /**
     * @param  array<int, array<string, mixed>>  $splits
     * @return array{error: ?string, splits: array<int, array{staff_id:int, share_percent:int, share_amount:?float, split_mode:string}>}
     */
    public function normalize(array $splits, float $lineTotal, ?string $splitMode = null): array
    {
        $rows = collect($splits)
            ->map(fn ($split) => self::mapIncomingRow(is_array($split) ? $split : []))
            ->values();
        if ($rows->isEmpty()) {
            return ['error' => __('At least one staff split is required.'), 'splits' => []];
        }

        $mode = $this->resolveMode($splitMode, $rows->all());
        $lineTotal = round(max(0, $lineTotal), 2);

        if ($mode === self::MODE_AMOUNT) {
            return $this->normalizeAmountMode($rows, $lineTotal);
        }

        return $this->normalizePercentMode($rows, $lineTotal);
    }

    /**
     * @param  array<int, array<string, mixed>>  $rows
     */
    protected function resolveMode(?string $explicitMode, array $rows): string
    {
        if ($explicitMode === self::MODE_AMOUNT) {
            return self::MODE_AMOUNT;
        }
        if ($explicitMode === self::MODE_PERCENT) {
            return self::MODE_PERCENT;
        }

        $rowModes = collect($rows)
            ->map(fn (array $row) => isset($row['split_mode']) ? (string) $row['split_mode'] : null)
            ->filter()
            ->unique()
            ->values();

        if ($rowModes->contains(self::MODE_AMOUNT)) {
            return self::MODE_AMOUNT;
        }
        if ($rowModes->contains(self::MODE_PERCENT)) {
            return self::MODE_PERCENT;
        }

        $hasAmount = collect($rows)->contains(function (array $row) {
            return array_key_exists('share_amount', $row)
                && $row['share_amount'] !== null
                && $row['share_amount'] !== '';
        });

        return $hasAmount ? self::MODE_AMOUNT : self::MODE_PERCENT;
    }

    /**
     * @param  \Illuminate\Support\Collection<int, array<string, mixed>>  $rows
     * @return array{error: ?string, splits: array<int, array{staff_id:int, share_percent:int, share_amount:?float, split_mode:string}>}
     */
    protected function normalizePercentMode($rows, float $lineTotal): array
    {
        $normalized = $rows->map(fn ($row) => [
            'staff_id' => (int) ($row['staff_id'] ?? 0),
            'share_percent' => (int) ($row['share_percent'] ?? 0),
        ])->values();

        $uniqueStaff = $normalized->pluck('staff_id')->unique();
        if ($uniqueStaff->count() !== $normalized->count()) {
            return ['error' => __('Duplicate staff is not allowed in split.'), 'splits' => []];
        }

        if ($normalized->contains(fn ($row) => $row['staff_id'] <= 0 || $row['share_percent'] <= 0)) {
            return ['error' => __('Each staff split must have valid staff and percent.'), 'splits' => []];
        }

        $sum = (int) $normalized->sum('share_percent');
        if ($sum !== 100) {
            return ['error' => __('Staff split total must equal 100% (current: :sum%).', ['sum' => $sum]), 'splits' => []];
        }

        $withAmount = $normalized->map(function (array $row) use ($lineTotal) {
            $shareAmount = $lineTotal > 0
                ? round($lineTotal * ($row['share_percent'] / 100), 2)
                : null;

            return [
                'staff_id' => $row['staff_id'],
                'share_percent' => $row['share_percent'],
                'share_amount' => $shareAmount,
                'split_mode' => self::MODE_PERCENT,
            ];
        })->values()->all();

        $this->fixShareAmountRounding($withAmount, $lineTotal);

        return ['error' => null, 'splits' => $withAmount];
    }

    /**
     * @param  \Illuminate\Support\Collection<int, array<string, mixed>>  $rows
     * @return array{error: ?string, splits: array<int, array{staff_id:int, share_percent:int, share_amount:?float, split_mode:string}>}
     */
    protected function normalizeAmountMode($rows, float $lineTotal): array
    {
        if ($lineTotal <= 0) {
            return ['error' => __('Line total must be greater than zero for amount-based staff split.'), 'splits' => []];
        }

        $normalized = $rows->map(fn ($row) => [
            'staff_id' => (int) ($row['staff_id'] ?? 0),
            'share_amount' => round(max(0, (float) ($row['share_amount'] ?? 0)), 2),
        ])->values();

        $uniqueStaff = $normalized->pluck('staff_id')->unique();
        if ($uniqueStaff->count() !== $normalized->count()) {
            return ['error' => __('Duplicate staff is not allowed in split.'), 'splits' => []];
        }

        if ($normalized->contains(fn ($row) => $row['staff_id'] <= 0 || $row['share_amount'] <= 0)) {
            return ['error' => __('Each staff split must have valid staff and amount.'), 'splits' => []];
        }

        $amountSum = round((float) $normalized->sum('share_amount'), 2);
        if (abs($amountSum - $lineTotal) > 0.01) {
            return [
                'error' => __('Staff split amounts must equal the line total (current: :current, expected: :expected).', [
                    'current' => number_format($amountSum, 2, '.', ''),
                    'expected' => number_format($lineTotal, 2, '.', ''),
                ]),
                'splits' => [],
            ];
        }

        $percents = $this->amountsToIntegerPercents(
            $normalized->pluck('share_amount')->map(fn ($amount) => (float) $amount)->all(),
            $lineTotal,
        );

        $withPercent = $normalized->values()->map(function (array $row, int $index) use ($percents) {
            return [
                'staff_id' => $row['staff_id'],
                'share_percent' => (int) ($percents[$index] ?? 0),
                'share_amount' => $row['share_amount'],
                'split_mode' => self::MODE_AMOUNT,
            ];
        })->all();

        return ['error' => null, 'splits' => $withPercent];
    }

    /**
     * Largest remainder method — integer percents that sum to 100.
     *
     * @param  array<int, float>  $amounts
     * @return array<int, int>
     */
    public function amountsToIntegerPercents(array $amounts, float $lineTotal): array
    {
        if ($lineTotal <= 0) {
            return array_fill(0, count($amounts), 0);
        }

        $exact = [];
        $floors = [];
        $remainders = [];
        foreach ($amounts as $index => $amount) {
            $raw = ($amount / $lineTotal) * 100;
            $exact[$index] = $raw;
            $floors[$index] = (int) floor($raw);
            $remainders[$index] = $raw - $floors[$index];
        }

        $result = $floors;
        $remaining = 100 - array_sum($floors);
        if ($remaining > 0) {
            $order = collect($remainders)
                ->map(fn ($remainder, $index) => ['index' => (int) $index, 'remainder' => $remainder])
                ->sortByDesc('remainder')
                ->values();
            for ($i = 0; $i < $remaining && $i < $order->count(); $i++) {
                $result[$order[$i]['index']]++;
            }
        }

        return array_values($result);
    }

    /**
     * @param  array<int, array{staff_id:int, share_percent:int, share_amount:?float, split_mode:string}>  $splits
     */
    protected function fixShareAmountRounding(array &$splits, float $lineTotal): void
    {
        if ($lineTotal <= 0 || count($splits) === 0) {
            return;
        }

        $sum = round(collect($splits)->sum(fn ($row) => (float) ($row['share_amount'] ?? 0)), 2);
        $delta = round($lineTotal - $sum, 2);
        if (abs($delta) <= 0.01) {
            $splits[0]['share_amount'] = round(((float) ($splits[0]['share_amount'] ?? 0)) + $delta, 2);
        }
    }

    public function normalizeIncoming(array $splits, float $lineTotal): array
    {
        $rows = collect($splits)
            ->map(fn ($split) => self::mapIncomingRow(is_array($split) ? $split : []))
            ->values()
            ->all();
        $splitMode = collect($rows)->pluck('split_mode')->filter()->first();

        return $this->normalize($rows, $lineTotal, is_string($splitMode) ? $splitMode : null);
    }

    public static function splitSalesSql(string $alias = 'order_item_staff_splits', ?string $lineTotalExpr = null): string
    {
        $lineTotal = $lineTotalExpr ?? "{$alias}.amount_basis";

        return "COALESCE({$alias}.share_amount, ({$lineTotal}) * ({$alias}.share_percent::numeric / 100))";
    }

    /**
     * @param  array<string, mixed>  $split
     * @return array{staff_id:int, share_percent:int, share_amount:?float, split_mode:?string}
     */
    public static function mapIncomingRow(array $split): array
    {
        return [
            'staff_id' => (int) ($split['staff_id'] ?? 0),
            'share_percent' => (int) ($split['share_percent'] ?? $split['split_percent'] ?? 0),
            'share_amount' => array_key_exists('share_amount', $split) && $split['share_amount'] !== null && $split['share_amount'] !== ''
                ? round((float) $split['share_amount'], 2)
                : null,
            'split_mode' => isset($split['split_mode']) ? (string) $split['split_mode'] : null,
        ];
    }

    /**
     * @param  iterable<int, array<string, mixed>>  $linePayloads
     */
    public static function findLineStaffSplitPayload(iterable $linePayloads, string $lineKey): ?array
    {
        $candidates = collect($linePayloads ?? []);

        $exact = $candidates->first(fn (array $line) => (string) ($line['line_key'] ?? '') === $lineKey);
        if (is_array($exact)) {
            return $exact;
        }

        $matched = $candidates->first(function (array $line) use ($lineKey) {
            $payloadKey = (string) ($line['line_key'] ?? '');
            if ($payloadKey === '' || $lineKey === '') {
                return false;
            }
            if (str_ends_with($payloadKey, ':' . $lineKey)) {
                return true;
            }
            if (str_contains($payloadKey, ':' . $lineKey . ':')) {
                return true;
            }
            if ($lineKey === 'main' && str_contains($payloadKey, ':main:')) {
                return true;
            }
            if (str_starts_with($lineKey, 'addon:')) {
                $addonRef = substr($lineKey, strlen('addon:'));
                if (str_contains($payloadKey, ':addon:') && (str_ends_with($payloadKey, ':' . $addonRef) || str_ends_with($payloadKey, ':' . $lineKey))) {
                    return true;
                }
            }
            if (str_starts_with($lineKey, 'main_service:')) {
                $serviceRef = substr($lineKey, strlen('main_service:'));

                return str_contains($payloadKey, ':main:')
                    && (str_ends_with($payloadKey, ':' . $serviceRef) || str_contains($payloadKey, $lineKey));
            }

            return false;
        });

        return is_array($matched) ? $matched : null;
    }

    public static function persistedShareAmount(array $split): ?float
    {
        if (($split['split_mode'] ?? null) !== self::MODE_AMOUNT) {
            return null;
        }

        return isset($split['share_amount']) && $split['share_amount'] !== null
            ? round((float) $split['share_amount'], 2)
            : null;
    }

    public static function persistedSplitMode(array $split): string
    {
        $mode = isset($split['split_mode']) ? (string) $split['split_mode'] : null;

        return $mode === self::MODE_AMOUNT ? self::MODE_AMOUNT : self::MODE_PERCENT;
    }

    /**
     * @param  array<string, mixed>  $split
     * @return array<string, mixed>
     */
    public static function toReportSplit(array $split, ?string $staffName = null, ?float $amountOverride = null): array
    {
        $mode = (string) ($split['split_mode'] ?? self::MODE_PERCENT);
        if ($mode !== self::MODE_AMOUNT) {
            $mode = self::MODE_PERCENT;
        }

        $shareAmount = null;
        if ($mode === self::MODE_AMOUNT) {
            if ($amountOverride !== null) {
                $shareAmount = round($amountOverride, 2);
            } elseif (isset($split['share_amount']) && $split['share_amount'] !== null && $split['share_amount'] !== '') {
                $shareAmount = round((float) $split['share_amount'], 2);
            } elseif (isset($split['split_sales_amount']) && $split['split_sales_amount'] !== null && $split['split_sales_amount'] !== '') {
                $shareAmount = round((float) $split['split_sales_amount'], 2);
            }
        }

        return [
            'staff_id' => (int) ($split['staff_id'] ?? 0),
            'staff_name' => $staffName,
            'share_percent' => (int) ($split['share_percent'] ?? $split['split_percent'] ?? 0),
            'share_amount' => $shareAmount,
            'split_mode' => $mode,
            'commission_rate_snapshot' => isset($split['commission_rate_snapshot'])
                ? (float) $split['commission_rate_snapshot']
                : null,
        ];
    }
}
