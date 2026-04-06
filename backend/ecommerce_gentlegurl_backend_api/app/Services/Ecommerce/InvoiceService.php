<?php

namespace App\Services\Ecommerce;

use App\Models\Booking\CustomerServicePackage;
use App\Models\Booking\CustomerServicePackageUsage;
use App\Models\Ecommerce\Order;
use App\Services\SettingService;

class InvoiceService
{
    public function buildPdf(Order $order)
    {
        $order->loadMissing(['items', 'serviceItems', 'pickupStore', 'customer']);

        $invoiceProfile = SettingService::get('ecommerce.invoice_profile', $this->defaultInvoiceProfile());
        $mixedItems = $order->items->map(function ($item) {
            $lineType = (string) ($item->line_type ?: 'product');
            $variantName = $item->variant_name_snapshot;
            if ($lineType === 'booking_deposit') {
                $variantName = 'Booking Deposit';
            } elseif ($lineType === 'booking_settlement') {
                $variantName = 'Final Settlement';
            } elseif ($lineType === 'booking_addon') {
                $variantName = 'Booking Add-on Deposit';
            } elseif ($lineType === 'service_package') {
                $variantName = 'Service Package';
            }

            return [
                'line_type' => $lineType,
                'product_name' => $item->display_name_snapshot ?: $item->product_name_snapshot,
                'product_sku' => $item->sku_snapshot,
                'variant_name' => $variantName,
                'variant_sku' => $item->variant_sku_snapshot,
                'quantity' => (int) $item->quantity,
                'unit_price' => (float) ($item->effective_unit_price ?? $item->unit_price_snapshot ?? $item->price_snapshot),
                'line_total' => (float) ($item->effective_line_total ?? $item->line_total_snapshot ?? $item->line_total),
                'promotion_summary' => data_get($item->promotion_snapshot, 'summary'),
            ];
        })->values();

        $packageNameByBooking = CustomerServicePackageUsage::query()
            ->with('customerServicePackage.servicePackage:id,name')
            ->whereIn('booking_id', $order->serviceItems->pluck('booking_id')->filter()->map(fn ($id) => (int) $id)->values()->all())
            ->whereIn('status', ['reserved', 'consumed'])
            ->orderByDesc('id')
            ->get()
            ->groupBy('booking_id')
            ->map(function ($rows) {
                $usage = $rows->first();
                return (string) ($usage?->customerServicePackage?->servicePackage?->name ?? '');
            });

        $serviceItems = $order->serviceItems
            ->where('item_type', 'service')
            ->map(function ($item) use ($packageNameByBooking) {
                $bookingId = (int) ($item->booking_id ?? 0);
                $packageName = (string) ($packageNameByBooking->get($bookingId) ?? '');
                return [
                    'line_type' => 'service',
                    'product_name' => $item->service_name_snapshot,
                    'product_sku' => null,
                    'variant_name' => 'Service',
                    'variant_sku' => null,
                    'quantity' => (int) $item->qty,
                    'unit_price' => (float) $item->price_snapshot,
                    'line_total' => (float) $item->line_total,
                    'promotion_summary' => null,
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
                    'product_sku' => null,
                    'variant_name' => 'Service Package',
                    'variant_sku' => null,
                    'quantity' => (int) $rows->count(),
                    'unit_price' => (float) ($first?->servicePackage?->selling_price ?? 0),
                    'line_total' => round((float) $rows->count() * (float) ($first?->servicePackage?->selling_price ?? 0), 2),
                    'promotion_summary' => null,
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

    protected function isBookingCoveredByPackage(int $bookingId): bool
    {
        if ($bookingId <= 0) {
            return false;
        }

        return CustomerServicePackageUsage::query()
            ->where('booking_id', $bookingId)
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
        ];
    }
}
