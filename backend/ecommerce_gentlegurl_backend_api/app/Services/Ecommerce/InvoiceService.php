<?php

namespace App\Services\Ecommerce;

use App\Models\Booking\Booking;
use App\Models\Booking\BookingRefund;
use App\Models\Booking\BookingService;
use App\Models\Booking\CustomerServicePackage;
use App\Models\Booking\CustomerServicePackageUsage;
use App\Models\Ecommerce\Order;
use App\Models\Ecommerce\OrderItem;
use App\Services\SettingService;

class InvoiceService
{
    /**
     * @return array{name: string, service_context: string|null}
     */
    public function formatBookingAddonDisplayName(string $rawName): array
    {
        $name = trim($rawName);
        if ($name === '') {
            return ['name' => 'Add-on', 'service_context' => null];
        }

        if (str_contains($name, '::')) {
            [$serviceRef, $addonName] = explode('::', $name, 2);
            $addonName = trim($addonName) ?: $name;
            $serviceRef = trim($serviceRef);

            return [
                'name' => $addonName,
                'service_context' => ($serviceRef !== '' && strcasecmp($serviceRef, 'original') !== 0) ? $serviceRef : null,
            ];
        }

        foreach (['Final Settlement - ', 'Booking Deposit - ', 'Add-on - '] as $prefix) {
            if (stripos($name, $prefix) === 0) {
                return ['name' => trim(substr($name, strlen($prefix))) ?: $name, 'service_context' => null];
            }
        }

        return ['name' => $name, 'service_context' => null];
    }

    public function formatBookingReceiptLineName(string $lineType, string $rawName): string
    {
        if ($lineType === 'booking_addon') {
            $formatted = $this->formatBookingAddonDisplayName($rawName);
            $label = (string) ($formatted['name'] ?? $rawName);
            $context = trim((string) ($formatted['service_context'] ?? ''));

            return $context !== '' ? "{$label} ({$context})" : $label;
        }

        return $rawName;
    }

    /**
     * Same product/variant naming as PDF receipt (booking deposit, addon prefixes, etc.).
     *
     * @return array{
     *     line_type: string,
     *     product_name: string,
     *     product_cn_name: string|null,
     *     product_sku: mixed,
     *     variant_name: mixed,
     *     variant_cn_name: string|null,
     *     variant_sku: mixed,
     *     quantity: int,
     *     unit_price: float,
     *     line_total_snapshot: float,
     *     discount_type: string|null,
     *     discount_value: float,
     *     discount_amount: float,
     *     discount_remark: string|null,
     *     line_total: float,
     *     promotion_summary: mixed,
     *     is_staff_free_applied: bool,
     *     staff_free_list_line_total: float,
     *     selected_booking_product_options: array<int, array<string, mixed>>
     * }
     */
    public function mapOrderItemToInvoiceRow(OrderItem $item): array
    {
        $lineType = (string) ($item->line_type ?: 'product');
        $variantName = $item->variant_name_snapshot;
        $productName = $item->display_name_snapshot ?: $item->product_name_snapshot;
        if ($productName === null || trim((string) $productName) === '') {
            $productName = 'Item #' . $item->id;
        }
        if ($lineType === 'booking_deposit') {
            $variantName = 'Booking Deposit';
        } elseif ($lineType === 'booking_settlement') {
            $variantName = 'Final Settlement';
        } elseif ($lineType === 'booking_addon') {
            $variantName = $item->variant_name_snapshot ?: 'Booking Add-on Deposit';
            $formattedAddon = $this->formatBookingAddonDisplayName((string) $productName);
            $productName = (string) ($formattedAddon['name'] ?? $productName);
            $resolvedAddon = trim((string) $variantName);
            if (strcasecmp($resolvedAddon, 'Booking Add-on Deposit') === 0) {
                $prefix = 'Booking Deposit - ';
                if (stripos((string) $productName, $prefix) !== 0) {
                    $productName = $prefix . $productName;
                }
            } elseif (strcasecmp($resolvedAddon, 'Booking Add-on Settlement') === 0) {
                $prefix = 'Final Settlement - ';
                if (stripos((string) $productName, $prefix) !== 0) {
                    $productName = $prefix . $productName;
                }
            }
        } elseif ($lineType === 'service_package') {
            $variantName = 'Service Package';
        }

        $isStaffFree = (bool) ($item->is_staff_free_applied ?? false);
        $discountAmount = (float) ($item->discount_amount ?? 0);
        $lineTotalSnapshot = (float) ($item->line_total_snapshot ?? $item->line_total ?? 0);
        $lineTotalNet = (float) ($item->effective_line_total ?? $item->line_total_after_discount ?? $item->line_total ?? $lineTotalSnapshot);

        return [
            'line_type' => $lineType,
            'product_name' => $productName,
            'product_name_only' => (string) ($item->product_name_snapshot ?: $item->product?->name ?: $productName),
            'product_cn_name' => $item->displayCnName(),
            'product_sku' => $item->sku_snapshot,
            'variant_name' => $variantName,
            'variant_cn_name' => $item->displayVariantCnName(),
            'variant_sku' => $item->variant_sku_snapshot,
            'quantity' => (int) $item->quantity,
            'unit_price' => (float) ($item->effective_unit_price ?? $item->unit_price_snapshot ?? $item->price_snapshot),
            'line_total_snapshot' => $lineTotalSnapshot,
            'discount_type' => $item->discount_type,
            'discount_value' => (float) ($item->discount_value ?? 0),
            'discount_amount' => $discountAmount,
            'discount_remark' => $item->discount_remark,
            'line_total' => $lineTotalNet,
            'promotion_summary' => data_get($item->promotion_snapshot, 'summary'),
            'is_staff_free_applied' => $isStaffFree,
            'staff_free_list_line_total' => $isStaffFree ? (float) ($item->line_total_snapshot ?? 0) : 0.0,
            'selected_booking_product_options' => is_array($item->selected_booking_product_options) ? $item->selected_booking_product_options : [],
        ];
    }

    /**
     * Structured line for receipt emails — aligned with PDF invoice item naming.
     *
     * @return array{name: string, cn_name: string|null, variant_name: string|null, variant_cn_name: string|null}
     */
    public function mapInvoiceRowToEmailItem(array $row): array
    {
        $lineType = (string) ($row['line_type'] ?? 'product');
        $variantName = trim((string) ($row['variant_name'] ?? ''));
        $hiddenVariantLabels = [
            'Final Settlement',
            'Booking Add-on Settlement',
            'Service',
            'Booking Deposit',
            'Booking Add-on Deposit',
            'Service Package',
        ];
        $showVariant = $variantName !== ''
            && $lineType !== 'booking_addon'
            && ! in_array($variantName, $hiddenVariantLabels, true);

        $productCnName = trim((string) ($row['product_cn_name'] ?? ''));
        $variantCnName = trim((string) ($row['variant_cn_name'] ?? ''));

        $emailName = $lineType === 'product' || $lineType === ''
            ? trim((string) ($row['product_name_only'] ?? $row['product_name'] ?? ''))
            : trim((string) ($row['product_name'] ?? ''));

        return [
            'name' => $emailName,
            'cn_name' => $productCnName !== '' ? $productCnName : null,
            'variant_name' => $showVariant ? $variantName : null,
            'variant_cn_name' => $showVariant && $variantCnName !== '' ? $variantCnName : null,
        ];
    }

    /**
     * One line of text for email tables — aligned with PDF primary + variant context.
     */
    public function formatEmailLineLabelFromInvoiceRow(array $row): string
    {
        $lineType = (string) ($row['line_type'] ?? 'product');
        $productName = trim((string) ($row['product_name'] ?? ''));
        $variantName = trim((string) ($row['variant_name'] ?? ''));

        return match ($lineType) {
            'booking_addon' => $productName,
            'booking_deposit', 'booking_settlement' => $this->formatEmailLineLabelForBookingDepositOrSettlement(
                $productName,
                $variantName
            ),
            'service_package' => $variantName !== ''
                ? "{$productName} · {$variantName}"
                : $productName,
            default => $variantName !== '' && strcasecmp($variantName, $productName) !== 0
                ? "{$productName} · {$variantName}"
                : $productName,
        };
    }

    /**
     * Avoid "Final Settlement — Final Settlement - Coloring" when snapshot already uses the same prefix as the PDF line.
     */
    protected function formatEmailLineLabelForBookingDepositOrSettlement(string $productName, string $variantName): string
    {
        if ($variantName === '') {
            return $productName;
        }

        $prefix = $variantName . ' - ';
        if (stripos($productName, $prefix) === 0) {
            return $productName;
        }

        return "{$variantName} — {$productName}";
    }

    public function canCustomerDownloadInvoice(Order $order): bool
    {
        if (in_array($order->status, ['cancelled', 'draft', 'voided'], true)) {
            return false;
        }

        return $order->payment_status === 'paid' || $order->status === 'completed';
    }

    public function buildPdf(Order $order)
    {
        $order->loadMissing(['items.product', 'items.productVariant', 'items.bookingService', 'items.booking.service', 'serviceItems.bookingService', 'pickupStore', 'customer', 'payments']);

        $invoiceProfile = SettingService::get('ecommerce.invoice_profile', $this->defaultInvoiceProfile());

        $bookingIdsForPackage = $order->serviceItems
            ->pluck('booking_id')
            ->concat($order->items->pluck('booking_id'))
            ->filter()
            ->map(fn ($id) => (int) $id)
            ->unique()
            ->values()
            ->all();

        $packageNameByBooking = collect();
        $packageNameByServiceId = collect();
        $packageUsages = collect();
        if ($bookingIdsForPackage !== []) {
            $packageUsages = CustomerServicePackageUsage::query()
                ->with(['customerServicePackage.servicePackage:id,name', 'bookingService:id,name,cn_name'])
                ->whereIn('status', ['reserved', 'consumed'])
                ->where(function ($q) use ($bookingIdsForPackage) {
                    $q->whereIn('booking_id', $bookingIdsForPackage)
                        ->orWhere(function ($q2) use ($bookingIdsForPackage) {
                            $q2->where('used_from', 'POS')
                                ->whereIn('used_ref_id', $bookingIdsForPackage);
                        });
                })
                ->orderByDesc('id')
                ->get();
            $packageNameByBooking = $packageUsages
                ->groupBy(fn ($usage) => (int) ($usage->booking_id ?: $usage->used_ref_id ?: 0))
                ->map(function ($rows) {
                    $usage = $rows->first();

                    return (string) ($usage?->customerServicePackage?->servicePackage?->name ?? '');
                });
            $packageNameByServiceId = $packageUsages
                ->groupBy(fn ($usage) => (int) ($usage->booking_service_id ?? 0))
                ->map(function ($rows) {
                    $usage = $rows->first();

                    return (string) ($usage?->customerServicePackage?->servicePackage?->name ?? '');
                });
        }

        $representedBookingServiceIds = $order->items
            ->filter(fn (OrderItem $item) => in_array((string) ($item->line_type ?? ''), ['booking_settlement', 'booking_addon', 'service'], true))
            ->pluck('booking_service_id')
            ->concat($order->serviceItems->pluck('booking_service_id'))
            ->filter()
            ->map(fn ($id) => (int) $id)
            ->unique()
            ->values()
            ->all();

        $settlementBookingServiceIds = $order->items
            ->filter(fn (OrderItem $item) => in_array((string) ($item->line_type ?? ''), ['booking_settlement', 'booking_addon'], true))
            ->pluck('booking_service_id')
            ->filter()
            ->map(fn ($id) => (int) $id)
            ->unique()
            ->values();

        $mixedItems = $order->items
            ->filter(function (OrderItem $item) use ($settlementBookingServiceIds) {
                if ((string) ($item->line_type ?? '') !== 'service') {
                    return true;
                }

                $serviceId = (int) ($item->booking_service_id ?? 0);

                return $serviceId <= 0 || ! $settlementBookingServiceIds->contains($serviceId);
            })
            ->map(function (OrderItem $item) use ($packageNameByServiceId, $packageUsages) {
            $row = $this->mapOrderItemToInvoiceRow($item);
            $packageName = $this->resolvePackageNameForOrderItem($item, $packageNameByServiceId, $packageUsages);

            return $this->applyPackageCoverageToInvoiceRow($row, $item, $packageName);
        })->values();

        $serviceItems = $order->serviceItems
            ->where('item_type', 'service')
            ->map(function ($item) use ($packageNameByServiceId) {
                $bookingId = (int) ($item->booking_id ?? 0);
                $serviceId = (int) ($item->booking_service_id ?? 0);
                $packageName = $serviceId > 0
                    ? (string) ($packageNameByServiceId->get($serviceId) ?? '')
                    : '';
                return [
                    'line_type' => 'service',
                    'product_name' => $item->service_name_snapshot,
                    'product_cn_name' => $item->bookingService?->cn_name,
                    'product_sku' => null,
                    'variant_name' => 'Service',
                    'variant_sku' => null,
                    'quantity' => (int) $item->qty,
                    'unit_price' => (float) $item->price_snapshot,
                    'line_total' => (float) $item->line_total,
                    'promotion_summary' => null,
                    'is_staff_free_applied' => false,
                    'staff_free_list_line_total' => 0.0,
                    'booking_id' => $bookingId,
                    'covered_by_package' => $packageName !== '',
                    'package_applied_name' => $packageName !== '' ? $packageName : null,
                ];
            })
            ->values();

        $hasDepositLine = $mixedItems->contains(fn (array $item) => (string) ($item['line_type'] ?? '') === 'booking_deposit');
        $hasSettlementLine = $mixedItems->contains(fn (array $item) => (string) ($item['line_type'] ?? '') === 'booking_settlement');
        $coveredServiceItems = $serviceItems
            ->filter(fn (array $item) => $this->isBookingCoveredByPackage((int) ($item['booking_id'] ?? 0)))
            ->map(fn (array $item) => [
                ...$item,
                'covered_by_package' => true,
                'line_total_snapshot' => (float) ($item['line_total'] ?? 0),
                'line_total_after_discount' => 0.0,
            ])
            ->values()
            ->concat($this->buildFallbackPackageCoveredServiceItems($order, $representedBookingServiceIds))
            ->filter(function (array $item) use ($settlementBookingServiceIds, $order) {
                $serviceId = (int) ($item['booking_service_id'] ?? 0);
                $serviceName = (string) ($item['product_name'] ?? '');

                if ($this->orderAlreadyRepresentsPackageService($order, $serviceId, $serviceName)) {
                    return false;
                }

                if ($serviceId <= 0) {
                    return true;
                }

                return ! $settlementBookingServiceIds->contains($serviceId);
            })
            ->values();
        $hasPackageCoverage = $coveredServiceItems->isNotEmpty()
            || $mixedItems->contains(fn (array $item) => (bool) ($item['covered_by_package'] ?? false));
        $canRenderServiceCoverageLines = $hasPackageCoverage;
        $isPackageCoveredReceipt = ! $hasDepositLine
            && ! $hasSettlementLine
            && $mixedItems->isEmpty()
            && $hasPackageCoverage
            && (float) ($order->grand_total ?? 0) <= 0.0001;

        $packageItems = CustomerServicePackage::query()
            ->with('servicePackage:id,name,selling_price')
            ->where('purchased_from', 'POS')
            ->where('purchased_ref_id', (int) $order->id)
            ->get()
            ->groupBy('service_package_id')
            ->map(function ($rows) {
                $first = $rows->first();

                return [
                    'product_name' => (string) ($first?->servicePackage?->name ?? 'Service Package'),
                    'product_cn_name' => null,
                    'product_sku' => null,
                    'variant_name' => 'Service Package',
                    'variant_sku' => null,
                    'quantity' => (int) $rows->count(),
                    'unit_price' => (float) ($first?->servicePackage?->selling_price ?? 0),
                    'line_total' => round((float) $rows->count() * (float) ($first?->servicePackage?->selling_price ?? 0), 2),
                    'promotion_summary' => null,
                    'is_staff_free_applied' => false,
                    'staff_free_list_line_total' => 0.0,
                ];
            })
            ->values();

        $items = $mixedItems->values();

        if ($canRenderServiceCoverageLines) {
            $items = $items->concat($coveredServiceItems)->values();
        }

        if ($isPackageCoveredReceipt) {
            $items = $coveredServiceItems->values();
        }

        if ($mixedItems->where('variant_name', 'Service Package')->isEmpty()) {
            $items = $items->concat($packageItems)->values();
        }

        if ($items->isEmpty() && $serviceItems->isNotEmpty()) {
            $items = $serviceItems->values();
            $coveredServiceItems = $serviceItems->values();
            $hasPackageCoverage = true;
            $canRenderServiceCoverageLines = true;
            $isPackageCoveredReceipt = ! $hasDepositLine
                && ! $hasSettlementLine
                && $mixedItems->isEmpty()
                && (float) ($order->grand_total ?? 0) <= 0.0001;
        }

        $packageOffset = $canRenderServiceCoverageLines
            ? round((float) $items
                ->filter(fn (array $item) => (bool) ($item['covered_by_package'] ?? false))
                ->sum(fn (array $item) => (float) ($item['line_total_snapshot'] ?? $item['line_total'] ?? 0)), 2)
            : 0.0;

        $packageNames = [];
        if ($canRenderServiceCoverageLines) {
            $packageNames = $coveredServiceItems
                ->map(fn (array $item) => (string) ($item['package_applied_name'] ?? ''))
                ->filter(fn (string $name) => $name !== '')
                ->unique()
                ->values()
                ->all();
        }

        $displaySubtotal = (float) $order->subtotal;
        $displayDiscount = (float) $order->discount_total;
        $displayShipping = (float) $order->shipping_fee;
        $displayGrandTotal = (float) $order->grand_total;
        $receiptLabel = 'Receipt';

        if ($canRenderServiceCoverageLines) {
            $displaySubtotal = round((float) $items->sum(function (array $item) {
                if ((bool) ($item['covered_by_package'] ?? false)) {
                    return (float) ($item['line_total_snapshot'] ?? $item['line_total'] ?? 0);
                }

                return (float) ($item['line_total'] ?? 0);
            }), 2);
        }

        if ($hasDepositLine && $mixedItems->count() === $mixedItems->where('line_type', 'booking_deposit')->count()) {
            $receiptLabel = 'Booking Deposit Receipt';
        } elseif ($hasSettlementLine && $mixedItems->every(fn (array $item) => in_array((string) ($item['line_type'] ?? ''), ['booking_settlement', 'booking_addon', 'service'], true))) {
            $receiptLabel = 'Final Settlement Receipt';
        } elseif ($isPackageCoveredReceipt) {
            $receiptLabel = 'Package-Covered Booking Receipt';
            $displaySubtotal = (float) $packageOffset;
            $displayDiscount = 0.0;
            $displayShipping = 0.0;
            $displayGrandTotal = 0.0;
        }

        return app('snappy.pdf.wrapper')->loadView('invoices.order', [
            'order' => $order,
            'items' => $items,
            'invoiceProfile' => $invoiceProfile,
            'receiptLabel' => $receiptLabel,
            'displaySubtotal' => $displaySubtotal,
            'displayDiscount' => $displayDiscount,
            'displayShipping' => $displayShipping,
            'displayGrandTotal' => $displayGrandTotal,
            'packageCoverage' => [
                'covered' => $canRenderServiceCoverageLines,
                'offset' => $packageOffset,
                'note' => $canRenderServiceCoverageLines ? 'Covered by Package' : null,
                'package_names' => $packageNames,
            ],
        ]);
    }


    public function buildFallbackPackageCoveredServiceItems(Order $order, array $representedBookingServiceIds = [])
    {
        $bookingIds = $order->items
            ->pluck('booking_id')
            ->filter()
            ->map(fn ($id) => (int) $id)
            ->unique()
            ->values()
            ->all();

        if ($bookingIds === []) {
            return collect();
        }

        $represented = collect($representedBookingServiceIds)
            ->map(fn ($id) => (int) $id)
            ->filter(fn (int $id) => $id > 0)
            ->unique()
            ->values();

        $usages = CustomerServicePackageUsage::query()
            ->with([
                'customerServicePackage.servicePackage:id,name',
                'bookingService:id,name,cn_name,service_price,price',
            ])
            ->whereIn('status', ['reserved', 'consumed'])
            ->where(function ($q) use ($bookingIds) {
                $q->whereIn('booking_id', $bookingIds)
                    ->orWhere(function ($q2) use ($bookingIds) {
                        $q2->where('used_from', 'POS')
                            ->whereIn('used_ref_id', $bookingIds);
                    });
            })
            ->orderByDesc('id')
            ->get();

        if ($usages->isEmpty()) {
            return collect();
        }

        $bookings = Booking::query()
            ->with('service:id,name,cn_name,service_price,price')
            ->whereIn('id', $bookingIds)
            ->get()
            ->keyBy('id');

        return $usages
            ->unique(fn (CustomerServicePackageUsage $usage) => (int) $usage->booking_service_id)
            ->map(function (CustomerServicePackageUsage $usage) use ($represented, $bookings, $bookingIds, $order) {
                $serviceId = (int) $usage->booking_service_id;
                if ($serviceId <= 0 || $represented->contains($serviceId)) {
                    return null;
                }

                $serviceName = (string) ($usage->bookingService?->name ?? 'Service');
                if ($this->orderAlreadyRepresentsPackageService($order, $serviceId, $serviceName)) {
                    return null;
                }

                $bookingId = collect([(int) ($usage->booking_id ?? 0), (int) ($usage->used_ref_id ?? 0)])
                    ->filter(fn (int $id) => $id > 0 && in_array($id, $bookingIds, true))
                    ->first()
                    ?? (int) ($usage->booking_id ?: $usage->used_ref_id ?: 0);
                $booking = $bookings->get($bookingId);
                $serviceAmount = $this->resolveMainServiceAmountForBooking($booking, $serviceId, $usage->bookingService);
                $serviceAmount = round(max(0, $serviceAmount), 2);
                if ($serviceAmount <= 0.0001) {
                    return null;
                }

                $packageName = (string) ($usage->customerServicePackage?->servicePackage?->name ?? '');

                return [
                    'line_type' => 'service',
                    'product_name' => (string) ($usage->bookingService?->name ?? 'Service'),
                    'product_cn_name' => $usage->bookingService?->cn_name,
                    'product_sku' => null,
                    'variant_name' => 'Service',
                    'variant_sku' => null,
                    'quantity' => 1,
                    'unit_price' => $serviceAmount,
                    'line_total_snapshot' => $serviceAmount,
                    'discount_type' => null,
                    'discount_value' => 0.0,
                    'discount_amount' => 0.0,
                    'discount_remark' => null,
                    'line_total' => $serviceAmount,
                    'line_total_after_discount' => 0.0,
                    'promotion_summary' => null,
                    'is_staff_free_applied' => false,
                    'staff_free_list_line_total' => 0.0,
                    'booking_id' => $bookingId,
                    'booking_service_id' => $serviceId,
                    'covered_by_package' => true,
                    'package_applied_name' => $packageName !== '' ? $packageName : null,
                ];
            })
            ->filter()
            ->values();
    }

    protected function resolveMainServiceAmountForBooking(?Booking $booking, int $bookingServiceId, ?BookingService $bookingService = null): float
    {
        if ($booking && (int) ($booking->service_id ?? 0) === $bookingServiceId) {
            if ($booking->settled_service_amount !== null) {
                return (float) $booking->settled_service_amount;
            }

            return (float) ($booking->service?->service_price ?? $booking->service?->price ?? 0);
        }

        if ($booking) {
            foreach ((array) ($booking->addon_items_json ?? []) as $item) {
                $itemKind = strtolower((string) ($item['item_kind'] ?? 'addon'));

                if ($itemKind === 'main_service') {
                    if ((int) ($item['linked_booking_service_id'] ?? 0) === $bookingServiceId) {
                        return (float) ($item['final_price'] ?? $item['settled_price'] ?? $item['adjusted_price'] ?? $item['override_price'] ?? $item['extra_price'] ?? 0);
                    }

                    foreach ((array) ($item['addon_items'] ?? []) as $addon) {
                        if ((int) ($addon['linked_booking_service_id'] ?? 0) !== $bookingServiceId) {
                            continue;
                        }

                        return (float) ($addon['line_gross_amount'] ?? $addon['final_price'] ?? $addon['settled_price'] ?? $addon['adjusted_price'] ?? $addon['override_price'] ?? $addon['extra_price'] ?? 0);
                    }

                    continue;
                }

                if ((int) ($item['linked_booking_service_id'] ?? 0) === $bookingServiceId) {
                    return (float) ($item['line_gross_amount'] ?? $item['final_price'] ?? $item['settled_price'] ?? $item['adjusted_price'] ?? $item['override_price'] ?? $item['extra_price'] ?? 0);
                }
            }
        }

        return (float) ($bookingService?->service_price ?? $bookingService?->price ?? 0);
    }

    public function normalizeReceiptServiceName(string $rawName): string
    {
        $name = trim($rawName);
        if ($name === '') {
            return '';
        }

        foreach (['Final Settlement - ', 'Booking Deposit - ', 'Add-on - '] as $prefix) {
            if (str_starts_with(strtolower($name), strtolower($prefix))) {
                $name = trim(substr($name, strlen($prefix)));
            }
        }

        if (str_contains($name, '::')) {
            [, $name] = explode('::', $name, 2);
            $name = trim($name);
        }

        return $name;
    }

    public function orderAlreadyRepresentsPackageService(Order $order, int $bookingServiceId, string $serviceName): bool
    {
        $normalizedTarget = strtolower($this->normalizeReceiptServiceName($serviceName));

        foreach ($order->items as $item) {
            if (! in_array((string) ($item->line_type ?? ''), ['booking_settlement', 'booking_addon', 'service'], true)) {
                continue;
            }

            $itemServiceId = (int) ($item->booking_service_id ?? 0);
            if ($bookingServiceId > 0 && $itemServiceId === $bookingServiceId) {
                return true;
            }

            foreach ([$item->product_name_snapshot, $item->display_name_snapshot] as $raw) {
                $normalizedItem = strtolower($this->normalizeReceiptServiceName((string) ($raw ?? '')));
                if ($normalizedTarget !== '' && $normalizedItem === $normalizedTarget) {
                    return true;
                }
            }
        }

        foreach ($order->serviceItems as $serviceItem) {
            $itemServiceId = (int) ($serviceItem->booking_service_id ?? 0);
            if ($bookingServiceId > 0 && $itemServiceId === $bookingServiceId) {
                return true;
            }

            $normalizedItem = strtolower($this->normalizeReceiptServiceName((string) ($serviceItem->service_name_snapshot ?? '')));
            if ($normalizedTarget !== '' && $normalizedItem === $normalizedTarget) {
                return true;
            }
        }

        return false;
    }

    /**
     * @param  \Illuminate\Support\Collection<int, string>  $packageNameByServiceId
     * @param  \Illuminate\Support\Collection<int, CustomerServicePackageUsage>  $packageUsages
     */
    public function resolvePackageNameForOrderItem(OrderItem $item, $packageNameByServiceId, $packageUsages): string
    {
        $lineType = (string) ($item->line_type ?? '');
        $itemName = strtolower($this->normalizeReceiptServiceName(
            (string) ($item->product_name_snapshot ?? $item->display_name_snapshot ?? '')
        ));

        if ($itemName !== '') {
            foreach ($packageUsages as $usage) {
                $usageName = strtolower($this->normalizeReceiptServiceName((string) ($usage->bookingService?->name ?? '')));
                if ($usageName !== '' && $usageName === $itemName) {
                    return (string) ($usage->customerServicePackage?->servicePackage?->name ?? '');
                }
            }
        }

        // Legacy booking_addon rows may store the parent main service id — rely on name match above.
        if ($lineType === 'booking_addon') {
            return '';
        }

        $serviceId = (int) ($item->booking_service_id ?? 0);
        if ($serviceId > 0) {
            return (string) ($packageNameByServiceId->get($serviceId) ?? '');
        }

        return '';
    }

    /**
     * @return array<string, mixed>
     */
    public function applyPackageCoverageToInvoiceRow(array $row, OrderItem $item, string $packageName): array
    {
        if ($packageName === '') {
            return $row;
        }

        return [
            ...$row,
            'covered_by_package' => true,
            'package_applied_name' => $packageName,
            'line_total_snapshot' => (float) ($item->line_total_snapshot ?? $item->line_total ?? $row['line_total_snapshot'] ?? $row['line_total'] ?? 0),
            'line_total' => 0.0,
            'line_total_after_discount' => 0.0,
        ];
    }

    protected function isBookingCoveredByPackage(int $bookingId): bool
    {
        if ($bookingId <= 0) {
            return false;
        }

        return CustomerServicePackageUsage::query()
            ->where(function ($q) use ($bookingId) {
                $q->where('booking_id', $bookingId)
                    ->orWhere(function ($q2) use ($bookingId) {
                        $q2->where('used_from', 'POS')
                            ->where('used_ref_id', $bookingId);
                    });
            })
            ->whereIn('status', ['reserved', 'consumed'])
            ->exists();
    }

    public function buildRefundPdf(BookingRefund $refund)
    {
        $refund->loadMissing(['booking.customer', 'processor:id,name']);
        $invoiceProfile = SettingService::get('ecommerce.invoice_profile', $this->defaultInvoiceProfile());
        $methodLabels = [
            'cash' => 'Cash Refund',
            'customer_credit' => 'Customer Credit',
        ];

        $booking = $refund->booking;
        $customerName = (string) ($booking?->customer?->name ?? $booking?->guest_name ?? '');
        $customerPhone = (string) ($booking?->customer?->phone ?? $booking?->guest_phone ?? '');
        $customerEmail = (string) ($booking?->customer?->email ?? $booking?->guest_email ?? '');

        return app('snappy.pdf.wrapper')->loadView('invoices.refund', [
            'refund' => $refund,
            'invoiceProfile' => $invoiceProfile,
            'bookingCode' => (string) ($booking?->booking_code ?? ''),
            'customerName' => $customerName !== '' ? $customerName : 'Walk-in / Guest',
            'customerPhone' => $customerPhone,
            'customerEmail' => $customerEmail,
            'methodLabel' => $methodLabels[(string) $refund->method] ?? ucfirst(str_replace('_', ' ', (string) $refund->method)),
        ]);
    }

    protected function defaultInvoiceProfile(): array
    {
        return [
            'company_logo_url' => null,
            'company_name' => 'Gentlegurl Shop',
            'company_reg_no' => null,
            'company_address' => "123 Gentle Lane\nKuala Lumpur\nMalaysia",
            'company_phone' => null,
            'company_email' => null,
            'company_website' => null,
            'footer_note' => 'This is a computer-generated invoice.',
            'currency' => 'MYR',
            /** Shown on POS invoices when checkout has no member and no guest details. */
            'pos_walk_in_bill_to' => [
                'name' => 'UNKNOWN',
                'phone' => null,
                'email' => null,
            ],
        ];
    }
}
