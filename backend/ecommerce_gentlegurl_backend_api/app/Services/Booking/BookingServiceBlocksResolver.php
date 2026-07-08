<?php

namespace App\Services\Booking;

use App\Models\Booking\Booking;
use App\Models\Booking\BookingService;
use Illuminate\Support\Collection;

/**
 * Builds the customer-facing "service blocks" view for a booking: the original main service
 * plus any additional main services, each with its nested add-ons and resolved pricing.
 *
 * This is the single source of truth shared by the customer "My Bookings" detail and the
 * public deposit payment link page so both render identical service/add-on breakdowns.
 */
class BookingServiceBlocksResolver
{
    public function __construct(
        protected BookingAddonQuantityService $addonQuantityService,
    ) {
    }

    /**
     * @return array<int, array<string, mixed>>
     */
    public function blocks(Booking $booking): array
    {
        $settlementItems = collect(is_array($booking->addon_items_json) ? $booking->addon_items_json : []);
        $bookingServiceId = (int) ($booking->service_id ?? 0);

        $originalMainServiceItem = $settlementItems->first(
            fn ($item) => is_array($item)
                && strtolower((string) ($item['item_kind'] ?? '')) === 'main_service'
                && (bool) ($item['is_original'] ?? false)
                && (int) ($item['linked_booking_service_id'] ?? 0) === $bookingServiceId
        );

        $extraMainServiceRows = $settlementItems
            ->filter(fn ($item) => is_array($item) && strtolower((string) ($item['item_kind'] ?? '')) === 'main_service')
            ->filter(fn ($item) => (int) ($item['linked_booking_service_id'] ?? 0) !== $bookingServiceId)
            ->values();

        $nestedOriginalAddons = is_array($originalMainServiceItem)
            ? collect((array) ($originalMainServiceItem['addon_items'] ?? []))
            : collect();

        $flatAddonItems = $settlementItems
            ->filter(fn ($item) => is_array($item) && strtolower((string) ($item['item_kind'] ?? '')) !== 'main_service')
            ->values();

        $originalAddonSource = $nestedOriginalAddons->isNotEmpty() ? $nestedOriginalAddons : $flatAddonItems;

        $addonLinkedServiceIds = $originalAddonSource
            ->merge($extraMainServiceRows->flatMap(fn (array $row) => collect($row['addon_items'] ?? [])))
            ->filter(fn ($addon) => is_array($addon))
            ->map(fn (array $addon) => (int) ($addon['linked_booking_service_id'] ?? 0))
            ->filter(fn (int $id) => $id > 0);

        $linkedIds = $extraMainServiceRows
            ->pluck('linked_booking_service_id')
            ->map(fn ($id) => (int) $id)
            ->filter(fn (int $id) => $id > 0)
            ->merge([$bookingServiceId])
            ->merge($addonLinkedServiceIds)
            ->unique()
            ->values();

        $servicesById = $linkedIds->isNotEmpty()
            ? BookingService::query()
                ->whereIn('id', $linkedIds->all())
                ->get(['id', 'name', 'cn_name', 'duration_min', 'service_price', 'price', 'price_mode', 'price_range_min', 'price_range_max'])
                ->keyBy('id')
            : collect();

        $originalItem = is_array($originalMainServiceItem) ? $originalMainServiceItem : [];
        $originalLinkedService = $servicesById->get($bookingServiceId) ?? $booking->service;

        $originalBlock = [
            'service_id' => $bookingServiceId,
            'name' => (string) ($originalItem['name'] ?? $booking->service?->name ?? 'Service'),
            'cn_name' => $originalItem['cn_name'] ?? $originalItem['linked_cn_name'] ?? $booking->service?->cn_name,
            ...$this->resolveServicePriceMeta(
                array_merge($originalItem, ['is_original' => true]),
                $originalLinkedService,
                $booking,
            ),
            'duration_min' => max(0, (int) ($originalItem['extra_duration_min'] ?? $booking->service?->duration_min ?? 0)),
            'is_original' => true,
            'add_ons' => $originalAddonSource
                ->filter(fn ($addon) => is_array($addon))
                ->map(fn (array $addon) => $this->mapAddonItem($addon, $servicesById))
                ->values()
                ->all(),
        ];

        $extraBlocks = $extraMainServiceRows
            ->map(function (array $item) use ($booking, $servicesById) {
                $linkedId = (int) ($item['linked_booking_service_id'] ?? 0);
                $linkedService = $servicesById->get($linkedId);

                return [
                    'service_id' => $linkedId > 0 ? $linkedId : null,
                    'name' => (string) ($item['name'] ?? $item['label'] ?? $linkedService?->name ?? 'Service'),
                    'cn_name' => $item['cn_name'] ?? $item['linked_cn_name'] ?? $linkedService?->cn_name,
                    ...$this->resolveServicePriceMeta($item, $linkedService, $booking),
                    'duration_min' => max(0, (int) ($item['extra_duration_min'] ?? $linkedService?->duration_min ?? 0)),
                    'is_original' => false,
                    'add_ons' => collect($item['addon_items'] ?? [])
                        ->filter(fn ($addon) => is_array($addon))
                        ->map(fn (array $addon) => $this->mapAddonItem($addon, $servicesById))
                        ->values()
                        ->all(),
                ];
            })
            ->values()
            ->all();

        if ($extraBlocks === [] && $settlementItems->filter(fn ($item) => is_array($item) && strtolower((string) ($item['item_kind'] ?? '')) === 'main_service')->isEmpty()) {
            return [$originalBlock];
        }

        return collect([$originalBlock])->concat($extraBlocks)->values()->all();
    }

    /**
     * @param  array<string, mixed>  $item
     * @param  Collection<int, BookingService>|null  $servicesById
     * @return array{name: string, cn_name: string|null, extra_duration_min: int, extra_price: float, quantity: int, line_gross_amount: float, price_mode: string|null, price_range_min: float|null, price_range_max: float|null, price_finalized: bool, id: int|null}
     */
    public function mapAddonItem(array $item, ?Collection $servicesById = null): array
    {
        $quantity = $this->addonQuantityService->resolveStoredQuantity($item);
        $linkedServiceId = (int) ($item['linked_booking_service_id'] ?? 0);
        $linkedService = $linkedServiceId > 0 ? $servicesById?->get($linkedServiceId) : null;
        $priceMeta = $this->resolveAddonPriceMeta($item, $linkedService);
        $priceFinalized = $this->resolveAddonPriceFinalized($item, $priceMeta);
        $unitPrice = $priceFinalized
            ? round(max(0, (float) ($item['final_price'] ?? $item['settled_price'] ?? $item['adjusted_price'] ?? $item['override_price'] ?? $item['extra_price'] ?? 0)), 2)
            : 0.0;
        $lineGrossAmount = $priceFinalized
            ? (array_key_exists('line_gross_amount', $item) && $item['line_gross_amount'] !== null
                ? round(max(0, (float) $item['line_gross_amount']), 2)
                : round($unitPrice * $quantity, 2))
            : 0.0;

        return [
            'id' => isset($item['id']) ? (int) $item['id'] : null,
            'name' => (string) ($item['name'] ?? $item['label'] ?? 'Add-on'),
            'cn_name' => $item['cn_label'] ?? $item['cn_name'] ?? $item['linked_cn_name'] ?? null,
            // Used by frontend to match `booking.package_claims` which is keyed by booking_service_id.
            'service_id' => $linkedServiceId > 0 ? $linkedServiceId : null,
            'extra_duration_min' => max(0, (int) ($item['extra_duration_min'] ?? 0)),
            'extra_price' => $unitPrice,
            'quantity' => $quantity,
            'line_gross_amount' => $lineGrossAmount,
            'price_mode' => $priceMeta['price_mode'],
            'price_range_min' => $priceMeta['price_range_min'],
            'price_range_max' => $priceMeta['price_range_max'],
            'price_finalized' => $priceFinalized,
        ];
    }

    protected function resolveRangeMin(array $item, ?BookingService $linkedService = null): ?float
    {
        foreach (['price_range_min', 'linked_price_range_min', 'service_price_range_min'] as $key) {
            if (! isset($item[$key]) || $item[$key] === null || $item[$key] === '') {
                continue;
            }

            return (float) $item[$key];
        }

        return $linkedService?->price_range_min !== null ? (float) $linkedService->price_range_min : null;
    }

    protected function resolveRangeMax(array $item, ?BookingService $linkedService = null): ?float
    {
        foreach (['price_range_max', 'linked_price_range_max', 'service_price_range_max'] as $key) {
            if (! isset($item[$key]) || $item[$key] === null || $item[$key] === '') {
                continue;
            }

            return (float) $item[$key];
        }

        return $linkedService?->price_range_max !== null ? (float) $linkedService->price_range_max : null;
    }

    /**
     * @param  array<string, mixed>  $item
     */
    protected function resolveServicePriceMode(array $item, ?BookingService $linkedService, Booking $booking): string
    {
        foreach (['price_mode', 'linked_price_mode', 'service_price_mode'] as $key) {
            $mode = $item[$key] ?? null;
            if (is_string($mode) && trim($mode) !== '') {
                return strtolower(trim($mode));
            }
        }

        $linkedMode = $linkedService?->price_mode ?? $booking->service?->price_mode ?? 'fixed';

        return strtolower(trim((string) $linkedMode));
    }

    /**
     * @param  array<string, mixed>  $item
     * @return array{price_mode: string|null, price_range_min: float|null, price_range_max: float|null}
     */
    protected function resolveAddonPriceMeta(array $item, ?BookingService $linkedService = null): array
    {
        if ($linkedService && (string) ($linkedService->price_mode ?? 'fixed') !== '') {
            return [
                'price_mode' => (string) ($linkedService->price_mode ?? 'fixed'),
                'price_range_min' => $this->resolveRangeMin($item, $linkedService),
                'price_range_max' => $this->resolveRangeMax($item, $linkedService),
            ];
        }

        $mode = $item['linked_price_mode'] ?? $item['price_mode'] ?? null;
        if (! is_string($mode) || trim($mode) === '') {
            return [
                'price_mode' => null,
                'price_range_min' => null,
                'price_range_max' => null,
            ];
        }

        return [
            'price_mode' => (string) $mode,
            'price_range_min' => $this->resolveRangeMin($item, $linkedService),
            'price_range_max' => $this->resolveRangeMax($item, $linkedService),
        ];
    }

    /**
     * @param  array<string, mixed>  $item
     * @param  array{price_mode: string|null, price_range_min: float|null, price_range_max: float|null}  $priceMeta
     */
    protected function resolveAddonPriceFinalized(array $item, array $priceMeta): bool
    {
        if (($priceMeta['price_mode'] ?? null) !== 'range') {
            return (bool) ($item['price_finalized'] ?? $item['final_price_set'] ?? true);
        }

        if ((bool) ($item['price_finalized'] ?? $item['final_price_set'] ?? false)) {
            return true;
        }

        foreach (['final_price', 'settled_price', 'adjusted_price', 'override_price', 'price_override'] as $field) {
            if (array_key_exists($field, $item) && $item[$field] !== null && $item[$field] !== '') {
                return true;
            }
        }

        // Match POS: placeholder extra_price / line totals must not finalize range addons.
        return false;
    }

    /**
     * @param  array<string, mixed>  $item
     */
    protected function resolveServicePriceFinalized(array $item, Booking $booking, bool $isOriginal, bool $isRange): bool
    {
        if (! $isRange) {
            return (bool) ($item['price_finalized'] ?? $item['final_price_set'] ?? true);
        }

        if ((bool) ($item['price_finalized'] ?? $item['final_price_set'] ?? false)) {
            return true;
        }

        if ($isOriginal && $booking->settled_service_amount !== null && (float) $booking->settled_service_amount > 0.0001) {
            return true;
        }

        foreach (['final_price', 'settled_price', 'adjusted_price', 'override_price', 'price_override'] as $field) {
            if (array_key_exists($field, $item) && $item[$field] !== null && $item[$field] !== '') {
                return true;
            }
        }

        return false;
    }

    /**
     * @param  array<string, mixed>  $item
     */
    protected function resolveExplicitFinalAmount(array $item): float
    {
        foreach (['final_price', 'settled_price', 'adjusted_price', 'override_price', 'price_override', 'extra_price'] as $field) {
            if (array_key_exists($field, $item) && $item[$field] !== null && $item[$field] !== '') {
                return round(max(0, (float) $item[$field]), 2);
            }
        }

        return 0.0;
    }

    public function hasPendingRangePricing(Booking $booking): bool
    {
        foreach ($this->blocks($booking) as $block) {
            if (($block['price_mode'] ?? null) === 'range' && ($block['price_finalized'] ?? false) === false) {
                return true;
            }

            foreach ($block['add_ons'] ?? [] as $addon) {
                if (is_array($addon) && ($addon['price_mode'] ?? null) === 'range' && ($addon['price_finalized'] ?? false) === false) {
                    return true;
                }
            }
        }

        return false;
    }

    /**
     * @param  array<string, mixed>  $item
     * @return array{amount: float, price_mode: string|null, price_range_min: float|null, price_range_max: float|null, price_finalized: bool}
     */
    protected function resolveServicePriceMeta(array $item, ?BookingService $linkedService, Booking $booking): array
    {
        $priceMode = $this->resolveServicePriceMode($item, $linkedService, $booking);
        $rangeMin = $this->resolveRangeMin($item, $linkedService);
        $rangeMax = $this->resolveRangeMax($item, $linkedService);
        $settledAmount = $booking->settled_service_amount !== null ? (float) $booking->settled_service_amount : null;
        $isOriginal = (bool) ($item['is_original'] ?? false);
        $isRange = $priceMode === 'range';
        $isFinalized = $this->resolveServicePriceFinalized($item, $booking, $isOriginal, $isRange);

        if ($isRange && ! $isFinalized) {
            return [
                'amount' => 0.0,
                'price_mode' => 'range',
                'price_range_min' => $rangeMin,
                'price_range_max' => $rangeMax,
                'price_finalized' => false,
            ];
        }

        if ($settledAmount !== null && $settledAmount > 0.0001 && $isOriginal) {
            $amount = round($settledAmount, 2);
        } else {
            $explicitAmount = $this->resolveExplicitFinalAmount($item);
            $amount = $explicitAmount > 0.0001
                ? $explicitAmount
                : round(max(0, (float) ($linkedService?->service_price ?? $linkedService?->price ?? 0)), 2);
        }

        return [
            'amount' => $amount,
            'price_mode' => $priceMode !== '' ? $priceMode : 'fixed',
            'price_range_min' => $rangeMin,
            'price_range_max' => $rangeMax,
            'price_finalized' => true,
        ];
    }

    /**
     * Total add-on count across all service blocks.
     *
     * @param  array<int, array<string, mixed>>  $blocks
     */
    public function totalAddonCount(array $blocks): int
    {
        return (new Collection($blocks))->sum(fn ($block) => count($block['add_ons'] ?? []));
    }
}
