<?php

namespace App\Services\Ecommerce;

use Illuminate\Validation\ValidationException;

class ShippingService
{
    protected const EAST_MALAYSIA_STATES = ['SABAH', 'SARAWAK', 'LABUAN'];

    public function resolveZone(?string $country, ?string $state): ?string
    {
        $normalizedCountry = $this->normalizeCountry($country);
        $normalizedState = $this->normalizeState($state);

        if ($normalizedCountry === null) {
            return null;
        }

        if ($normalizedCountry === 'SG') {
            return 'SG';
        }

        if ($normalizedCountry === 'MY') {
            if ($normalizedState && in_array($normalizedState, self::EAST_MALAYSIA_STATES, true)) {
                return 'MY_EAST';
            }

            return 'MY_WEST';
        }

        return null;
    }

    public function calculateShippingFee(float $subtotal, ?string $country, ?string $state, array $shippingSetting): array
    {
        if (empty($shippingSetting['zones']) && array_key_exists('flat_fee', $shippingSetting)) {
            $flatFee = (float) data_get($shippingSetting, 'flat_fee', 0);
            $label = data_get($shippingSetting, 'label', 'Delivery');

            return [
                'zone' => null,
                'label' => $label,
                'fee' => $flatFee,
                'is_free' => false,
                'free_threshold' => null,
            ];
        }

        $zone = $this->resolveZone($country, $state);
        $fallbackMode = data_get($shippingSetting, 'fallback.mode', 'block_checkout');
        $fallbackFee = (float) data_get($shippingSetting, 'fallback.default_fee', 0);
        $zoneLabel = null;
        $fee = 0.0;
        $zoneConfig = null;

        if ($zone) {
            $zoneConfig = data_get($shippingSetting, "zones.{$zone}");
            $fee = (float) data_get($zoneConfig, 'fee', 0);
            $zoneLabel = data_get($zoneConfig, 'label');
        } else {
            if ($fallbackMode === 'block_checkout') {
                throw ValidationException::withMessages([
                    'shipping_address' => __('Please select a country and state for delivery.'),
                ])->status(422);
            }

            $fee = $fallbackFee;
        }

        $zoneFreeShipping = data_get($zoneConfig ?? [], 'free_shipping');
        $legacyFreeShipping = data_get($shippingSetting, 'free_shipping');
        $freeShippingConfig = $zoneFreeShipping === null ? (array) $legacyFreeShipping : (array) $zoneFreeShipping;
        $freeShippingEnabled = (bool) data_get($freeShippingConfig, 'enabled', false);
        $freeShippingThresholdRaw = data_get($freeShippingConfig, 'min_order_amount');
        $freeShippingThreshold = $freeShippingThresholdRaw !== null ? (float) $freeShippingThresholdRaw : null;
        $isFree = $freeShippingEnabled && $freeShippingThreshold !== null && $subtotal >= $freeShippingThreshold;

        return [
            'zone' => $zone,
            'label' => $zoneLabel,
            'fee' => $isFree ? 0.0 : $fee,
            'is_free' => $isFree,
            'free_threshold' => ($freeShippingEnabled && $freeShippingThreshold !== null) ? $freeShippingThreshold : null,
        ];
    }

    protected function normalizeCountry(?string $country): ?string
    {
        $normalized = $country ? strtoupper(trim($country)) : null;

        if ($normalized === 'MALAYSIA') {
            return 'MY';
        }

        if ($normalized === 'SINGAPORE') {
            return 'SG';
        }

        return $normalized ?: null;
    }

    protected function normalizeState(?string $state): ?string
    {
        $normalized = $state ? strtoupper(trim($state)) : null;

        return $normalized ?: null;
    }
}
