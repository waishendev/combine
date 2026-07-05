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

        $linkedIds = $extraMainServiceRows
            ->pluck('linked_booking_service_id')
            ->map(fn ($id) => (int) $id)
            ->filter(fn (int $id) => $id > 0)
            ->merge([$bookingServiceId])
            ->unique()
            ->values();

        $servicesById = $linkedIds->isNotEmpty()
            ? BookingService::query()
                ->whereIn('id', $linkedIds->all())
                ->get(['id', 'name', 'cn_name', 'duration_min', 'service_price', 'price', 'price_mode', 'price_range_min', 'price_range_max'])
                ->keyBy('id')
            : collect();

        $originalItem = is_array($originalMainServiceItem) ? $originalMainServiceItem : [];

        $originalBlock = [
            'service_id' => $bookingServiceId,
            'name' => (string) ($originalItem['name'] ?? $booking->service?->name ?? 'Service'),
            'cn_name' => $originalItem['cn_name'] ?? $originalItem['linked_cn_name'] ?? $booking->service?->cn_name,
            ...$this->resolveServicePriceMeta(
                array_merge($originalItem, ['is_original' => true]),
                $booking->service,
                $booking,
            ),
            'duration_min' => max(0, (int) ($originalItem['extra_duration_min'] ?? $booking->service?->duration_min ?? 0)),
            'is_original' => true,
            'add_ons' => $originalAddonSource
                ->filter(fn ($addon) => is_array($addon))
                ->map(fn (array $addon) => $this->mapAddonItem($addon))
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
                        ->map(fn (array $addon) => $this->mapAddonItem($addon))
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
     * @return array{name: string, cn_name: string|null, extra_duration_min: int, extra_price: float, quantity: int, line_gross_amount: float, price_mode: string|null, price_range_min: float|null, price_range_max: float|null, price_finalized: bool, id: int|null}
     */
    public function mapAddonItem(array $item): array
    {
        $quantity = $this->addonQuantityService->resolveStoredQuantity($item);
        $lineGrossAmount = $this->addonQuantityService->lineGrossAmount($item);
        $priceMode = (string) ($item['price_mode'] ?? '');
        $priceFinalized = (bool) ($item['price_finalized'] ?? $item['final_price_set'] ?? true);

        return [
            'id' => isset($item['id']) ? (int) $item['id'] : null,
            'name' => (string) ($item['name'] ?? $item['label'] ?? 'Add-on'),
            'cn_name' => $item['cn_label'] ?? $item['cn_name'] ?? $item['linked_cn_name'] ?? null,
            'extra_duration_min' => max(0, (int) ($item['extra_duration_min'] ?? 0)),
            'extra_price' => round((float) ($item['extra_price'] ?? 0), 2),
            'quantity' => $quantity,
            'line_gross_amount' => $lineGrossAmount,
            'price_mode' => $priceMode !== '' ? $priceMode : null,
            'price_range_min' => array_key_exists('price_range_min', $item) ? (float) $item['price_range_min'] : null,
            'price_range_max' => array_key_exists('price_range_max', $item) ? (float) $item['price_range_max'] : null,
            'price_finalized' => $priceFinalized,
        ];
    }

    /**
     * @param  array<string, mixed>  $item
     * @return array{amount: float, price_mode: string|null, price_range_min: float|null, price_range_max: float|null, price_finalized: bool}
     */
    protected function resolveServicePriceMeta(array $item, ?BookingService $linkedService, Booking $booking): array
    {
        $priceMode = (string) ($item['price_mode'] ?? $linkedService?->price_mode ?? $booking->service?->price_mode ?? 'fixed');
        $rangeMin = array_key_exists('price_range_min', $item)
            ? (float) $item['price_range_min']
            : ($linkedService?->price_range_min !== null ? (float) $linkedService->price_range_min : null);
        $rangeMax = array_key_exists('price_range_max', $item)
            ? (float) $item['price_range_max']
            : ($linkedService?->price_range_max !== null ? (float) $linkedService->price_range_max : null);
        $settledAmount = $booking->settled_service_amount !== null ? (float) $booking->settled_service_amount : null;
        $isOriginal = (bool) ($item['is_original'] ?? false);
        $explicitAmount = round(max(0, (float) ($item['extra_price'] ?? 0)), 2);
        $priceFinalized = (bool) ($item['price_finalized'] ?? $item['final_price_set'] ?? false);

        if ($settledAmount !== null && $settledAmount > 0.0001 && $isOriginal) {
            return [
                'amount' => round($settledAmount, 2),
                'price_mode' => $priceMode !== '' ? $priceMode : 'fixed',
                'price_range_min' => $rangeMin,
                'price_range_max' => $rangeMax,
                'price_finalized' => true,
            ];
        }

        if ($priceMode === 'range' && ! $priceFinalized && $explicitAmount <= 0.0001) {
            return [
                'amount' => 0.0,
                'price_mode' => 'range',
                'price_range_min' => $rangeMin,
                'price_range_max' => $rangeMax,
                'price_finalized' => false,
            ];
        }

        if ($explicitAmount > 0.0001) {
            return [
                'amount' => $explicitAmount,
                'price_mode' => $priceMode !== '' ? $priceMode : 'fixed',
                'price_range_min' => $rangeMin,
                'price_range_max' => $rangeMax,
                'price_finalized' => true,
            ];
        }

        $fallbackAmount = round(max(0, (float) ($linkedService?->service_price ?? $linkedService?->price ?? 0)), 2);

        return [
            'amount' => $fallbackAmount,
            'price_mode' => $priceMode !== '' ? $priceMode : 'fixed',
            'price_range_min' => $rangeMin,
            'price_range_max' => $rangeMax,
            'price_finalized' => $priceMode !== 'range' || $fallbackAmount > 0.0001,
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
