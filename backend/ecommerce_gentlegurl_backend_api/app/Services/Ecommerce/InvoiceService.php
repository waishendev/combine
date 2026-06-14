<?php

namespace App\Services\Ecommerce;

use App\Models\Booking\Booking;
use App\Models\Booking\CustomerServicePackage;
use App\Models\Booking\CustomerServicePackageUsage;
use App\Models\Ecommerce\Order;
use App\Models\Ecommerce\OrderItem;
use App\Services\SettingService;

class InvoiceService
{
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

    public function buildPdf(Order $order)
    {
        $order->loadMissing(['items.product', 'items.productVariant', 'items.bookingService', 'items.booking.service', 'serviceItems.bookingService', 'pickupStore', 'customer']);

        $invoiceProfile = SettingService::get('ecommerce.invoice_profile', $this->defaultInvoiceProfile());
        $mixedItems = $order->items->map(fn (OrderItem $item) => $this->mapOrderItemToInvoiceRow($item))->values();

        $bookingIdsForPackage = $order->serviceItems
            ->pluck('booking_id')
            ->concat($order->items->pluck('booking_id'))
            ->filter()
            ->map(fn ($id) => (int) $id)
            ->unique()
            ->values()
            ->all();

        $packageNameByBooking = collect();
        if ($bookingIdsForPackage !== []) {
            $packageNameByBooking = CustomerServicePackageUsage::query()
                ->with('customerServicePackage.servicePackage:id,name')
                ->whereIn('status', ['reserved', 'consumed'])
                ->where(function ($q) use ($bookingIdsForPackage) {
                    $q->whereIn('booking_id', $bookingIdsForPackage)
                        ->orWhere(function ($q2) use ($bookingIdsForPackage) {
                            $q2->where('used_from', 'POS')
                                ->whereIn('used_ref_id', $bookingIdsForPackage);
                        });
                })
                ->orderByDesc('id')
                ->get()
                ->groupBy(fn ($usage) => (int) ($usage->booking_id ?: $usage->used_ref_id ?: 0))
                ->map(function ($rows) {
                    $usage = $rows->first();

                    return (string) ($usage?->customerServicePackage?->servicePackage?->name ?? '');
                });
        }

        $serviceItems = $order->serviceItems
            ->where('item_type', 'service')
            ->map(function ($item) use ($packageNameByBooking) {
                $bookingId = (int) ($item->booking_id ?? 0);
                $packageName = (string) ($packageNameByBooking->get($bookingId) ?? '');
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
            ->concat($this->buildFallbackPackageCoveredServiceItems(
                $order,
                $packageNameByBooking,
                $serviceItems->pluck('booking_id')->map(fn ($id) => (int) $id)->all(),
            ))
            ->values();
        $hasPackageCoverage = $coveredServiceItems->isNotEmpty();
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
            ? round((float) $coveredServiceItems->sum(fn (array $item) => (float) ($item['line_total'] ?? 0)), 2)
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
            $displaySubtotal = round((float) $items->sum(fn (array $item) => (float) ($item['line_total'] ?? 0)), 2);
        }

        if ($hasDepositLine && $mixedItems->count() === $mixedItems->where('line_type', 'booking_deposit')->count()) {
            $receiptLabel = 'Booking Deposit Receipt';
        } elseif ($hasSettlementLine && $mixedItems->count() === $mixedItems->where('line_type', 'booking_settlement')->count()) {
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


    protected function buildFallbackPackageCoveredServiceItems(Order $order, $packageNameByBooking, array $existingBookingIds)
    {
        $existing = collect($existingBookingIds)->map(fn ($id) => (int) $id)->filter()->values();
        $bookingIds = $order->items
            ->pluck('booking_id')
            ->filter()
            ->map(fn ($id) => (int) $id)
            ->unique()
            ->reject(fn (int $id) => $existing->contains($id))
            ->filter(fn (int $id) => $this->isBookingCoveredByPackage($id))
            ->values();

        if ($bookingIds->isEmpty()) {
            return collect();
        }

        $loadedBookings = $order->items
            ->pluck('booking')
            ->filter()
            ->keyBy(fn ($booking) => (int) $booking->id);
        $missingBookingIds = $bookingIds
            ->reject(fn (int $id) => $loadedBookings->has($id))
            ->values();

        if ($missingBookingIds->isNotEmpty()) {
            Booking::query()
                ->with('service:id,name,cn_name,service_price,price')
                ->whereIn('id', $missingBookingIds->all())
                ->get()
                ->each(function (Booking $booking) use ($loadedBookings) {
                    $loadedBookings->put((int) $booking->id, $booking);
                });
        }

        return $bookingIds
            ->map(function (int $bookingId) use ($loadedBookings, $packageNameByBooking) {
                $booking = $loadedBookings->get($bookingId);
                if (! $booking) {
                    return null;
                }

                $serviceAmount = $booking->settled_service_amount !== null
                    ? (float) $booking->settled_service_amount
                    : (float) ($booking->service?->service_price ?? $booking->service?->price ?? 0);
                $serviceAmount = round(max(0, $serviceAmount), 2);
                $packageName = (string) ($packageNameByBooking->get($bookingId) ?? '');

                return [
                    'line_type' => 'service',
                    'product_name' => (string) ($booking->service?->name ?? 'Service'),
                    'product_cn_name' => $booking->service?->cn_name,
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
                    'covered_by_package' => true,
                    'package_applied_name' => $packageName !== '' ? $packageName : null,
                ];
            })
            ->filter()
            ->values();
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
