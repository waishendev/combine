<?php

namespace App\Services\Booking;

use App\Models\Booking\BookingServiceQuestionOption;
use Illuminate\Support\Collection;

class BookingAddonQuantityService
{
    public const MAX_QUANTITY = 99;

    public function resolveStoredQuantity(array $row): int
    {
        return max(1, min(self::MAX_QUANTITY, (int) ($row['quantity'] ?? 1)));
    }

    public function lineGrossAmount(array $row): float
    {
        if (array_key_exists('line_gross_amount', $row) && $row['line_gross_amount'] !== null) {
            return round(max(0, (float) $row['line_gross_amount']), 2);
        }

        return round(max(0, (float) ($row['extra_price'] ?? 0)) * $this->resolveStoredQuantity($row), 2);
    }

    public function lineDurationMinutes(array $row): int
    {
        return max(0, (int) ($row['extra_duration_min'] ?? 0)) * $this->resolveStoredQuantity($row);
    }

    /**
     * @param  array<int|string, mixed>  $quantitiesMap
     * @return array<int, int>
     */
    public function normalizeOptionQuantities(
        array $optionIds,
        ?array $quantitiesMap,
        Collection $availableOptionsById,
        bool $forceSingleQuantity = false,
    ): array {
        $quantitiesMap = is_array($quantitiesMap) ? $quantitiesMap : [];
        $result = [];

        foreach ($optionIds as $rawId) {
            $optionId = (int) $rawId;
            if ($optionId <= 0 || isset($result[$optionId])) {
                continue;
            }

            $option = $availableOptionsById->get($optionId);
            if (! $option instanceof BookingServiceQuestionOption) {
                continue;
            }

            $requested = max(1, (int) ($quantitiesMap[$optionId] ?? $quantitiesMap[(string) $optionId] ?? 1));
            $allowQuantity = ! $forceSingleQuantity && (bool) ($option->allow_quantity ?? true);
            $result[$optionId] = $allowQuantity
                ? min(self::MAX_QUANTITY, $requested)
                : 1;
        }

        return $result;
    }

    public function resolveUnitDuration(BookingServiceQuestionOption $option): int
    {
        return $option->linkedBookingService
            ? max(0, (int) ($option->linkedBookingService->duration_min ?? 0))
            : max(0, (int) ($option->extra_duration_min ?? 0));
    }

    public function resolveUnitPrice(BookingServiceQuestionOption $option, ?float $priceOverride = null): float
    {
        if ($priceOverride !== null) {
            return round(max(0, $priceOverride), 2);
        }

        if ($option->linkedBookingService && (string) ($option->linkedBookingService->price_mode ?? 'fixed') === 'range') {
            return 0.0;
        }

        if ($option->linkedBookingService) {
            return round(max(0, (float) ($option->linkedBookingService->service_price ?? 0)), 2);
        }

        return round(max(0, (float) ($option->extra_price ?? 0)), 2);
    }

    public function isPriceFinalized(BookingServiceQuestionOption $option, ?float $priceOverride = null): bool
    {
        if ($priceOverride !== null) {
            return true;
        }

        return ! ($option->linkedBookingService && (string) ($option->linkedBookingService->price_mode ?? 'fixed') === 'range');
    }

    public function buildSnapshotRow(
        BookingServiceQuestionOption $option,
        int $quantity,
        array $staffSplits = [],
        ?float $priceOverride = null,
        ?float $lineGrossOverride = null,
    ): array {
        $quantity = max(1, min(self::MAX_QUANTITY, $quantity));
        $unitPrice = $this->resolveUnitPrice($option, $priceOverride);

        $row = [
            'id' => (int) $option->id,
            'name' => (string) ($option->label ?: $option->linkedBookingService?->name ?: 'Add-on'),
            'cn_name' => trim((string) ($option->cn_label ?? '')) !== '' ? (string) $option->cn_label : $option->linkedBookingService?->cn_name,
            'extra_duration_min' => $this->resolveUnitDuration($option),
            'extra_price' => $unitPrice,
            'quantity' => $quantity,
            'price_finalized' => $this->isPriceFinalized($option, $priceOverride),
            'linked_booking_service_id' => $option->linkedBookingService ? (int) $option->linkedBookingService->id : null,
            'linked_cn_name' => $option->linkedBookingService?->cn_name,
            'linked_service_type' => $option->linkedBookingService ? (string) $option->linkedBookingService->service_type : null,
            'linked_deposit_amount' => $option->linkedBookingService
                ? round(max(0, (float) ($option->linkedBookingService->deposit_amount ?? 0)), 2)
                : null,
            'staff_splits' => collect($staffSplits)->values()->all(),
        ];

        if ($lineGrossOverride !== null) {
            $row['line_gross_amount'] = round(max(0, $lineGrossOverride), 2);
        } else {
            $row['line_gross_amount'] = round($unitPrice * $quantity, 2);
        }

        return $row;
    }

    /**
     * @return array<int, array<string, mixed>>
     */
    public function buildSnapshotRowsFromSelection(
        array $optionIds,
        ?array $quantitiesMap,
        Collection $availableOptionsById,
        array $addonStaffSplits = [],
        array $addonPriceOverrides = [],
        array $addonLineTotalOverrides = [],
        bool $forceSingleQuantity = false,
    ): array {
        $normalized = $this->normalizeOptionQuantities($optionIds, $quantitiesMap, $availableOptionsById, $forceSingleQuantity);

        return collect($normalized)
            ->map(function (int $quantity, int $optionId) use ($availableOptionsById, $addonStaffSplits, $addonPriceOverrides, $addonLineTotalOverrides) {
                $option = $availableOptionsById->get($optionId);
                if (! $option instanceof BookingServiceQuestionOption) {
                    return null;
                }

                $priceOverride = array_key_exists($optionId, $addonPriceOverrides)
                    ? round(max(0, (float) $addonPriceOverrides[$optionId]), 2)
                    : null;

                $lineGrossOverride = array_key_exists($optionId, $addonLineTotalOverrides)
                    ? round(max(0, (float) $addonLineTotalOverrides[$optionId]), 2)
                    : null;

                return $this->buildSnapshotRow(
                    $option,
                    $quantity,
                    (array) ($addonStaffSplits[$optionId] ?? $addonStaffSplits[(string) $optionId] ?? []),
                    $priceOverride,
                    $lineGrossOverride,
                );
            })
            ->filter()
            ->values()
            ->all();
    }

    public function sumSnapshotPrice(array $rows): float
    {
        return round((float) collect($rows)->sum(fn (array $row) => $this->lineGrossAmount($row)), 2);
    }

    public function sumSnapshotDuration(array $rows): int
    {
        return (int) collect($rows)->sum(fn (array $row) => $this->lineDurationMinutes($row));
    }

    public function formatOptionPayload(BookingServiceQuestionOption $option): array
    {
        return [
            'id' => (int) $option->id,
            'label' => (string) $option->label,
            'cn_label' => trim((string) ($option->cn_label ?? '')) !== '' ? (string) $option->cn_label : $option->linkedBookingService?->cn_name,
            'linked_booking_service_id' => $option->linkedBookingService ? (int) $option->linkedBookingService->id : null,
            'linked_cn_name' => $option->linkedBookingService?->cn_name,
            'extra_duration_min' => $this->resolveUnitDuration($option),
            'extra_price' => $this->resolveUnitPrice($option),
            'linked_price_mode' => $option->linkedBookingService ? (string) ($option->linkedBookingService->price_mode ?? 'fixed') : null,
            'linked_price_range_min' => $option->linkedBookingService && $option->linkedBookingService->price_range_min !== null
                ? (float) $option->linkedBookingService->price_range_min
                : null,
            'linked_price_range_max' => $option->linkedBookingService && $option->linkedBookingService->price_range_max !== null
                ? (float) $option->linkedBookingService->price_range_max
                : null,
            'allow_quantity' => (bool) ($option->allow_quantity ?? true),
        ];
    }

    /**
     * @return array<string, int>
     */
    public function buildQuantitiesPayload(array $normalizedQuantities): array
    {
        return collect($normalizedQuantities)
            ->mapWithKeys(fn (int $qty, int $optionId) => [(string) $optionId => $qty])
            ->all();
    }
}
