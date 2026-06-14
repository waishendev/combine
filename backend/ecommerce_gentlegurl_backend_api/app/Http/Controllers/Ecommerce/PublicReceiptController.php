<?php

namespace App\Http\Controllers\Ecommerce;

use App\Http\Controllers\Controller;
use App\Models\Booking\Booking;
use App\Models\Ecommerce\Order;
use App\Models\Ecommerce\OrderItem;
use App\Models\Ecommerce\OrderReceiptToken;
use App\Models\Booking\CustomerServicePackageUsage;
use App\Services\Ecommerce\InvoiceService;
use Carbon\Carbon;

class PublicReceiptController extends Controller
{
    public function __construct(
        protected InvoiceService $invoiceService,
    ) {
    }

    public function show(string $token)
    {
        $receiptToken = OrderReceiptToken::query()
            ->where('token', $token)
            ->with(['order.items.bookingService:id,name,cn_name', 'order.items.booking.service:id,name,cn_name,service_price,price', 'order.serviceItems.bookingService:id,cn_name', 'order.payments'])
            ->first();

        if (!$receiptToken) {
            return $this->respondError(__('Receipt not found.'), 404);
        }

        if ($receiptToken->expires_at && Carbon::parse($receiptToken->expires_at)->isPast()) {
            return $this->respondError(__('Receipt has expired.'), 410);
        }

        $order = $receiptToken->order;

        $mixedItems = $order->items
            ->reject(fn ($item) => $this->isFakeMainServiceBookingAddon($item))
            ->values();
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
        $serviceItems = $order->serviceItems->where('item_type', 'service')->values();
        $orderServiceCoverageLines = $serviceItems
            ->filter(fn ($item) => $this->isBookingCoveredByPackage((int) ($item->booking_id ?? 0)))
            ->map(function ($item) use ($packageNameByBooking) {
                $bookingId = (int) ($item->booking_id ?? 0);
                $packageName = (string) ($packageNameByBooking->get($bookingId) ?? '');

                return [
                    'type' => 'service',
                    'name' => $item->service_name_snapshot,
                    'cn_name' => $item->bookingService?->cn_name,
                    'qty' => (int) $item->qty,
                    'unit_price' => (float) $item->price_snapshot,
                    'line_total' => (float) $item->line_total,
                    'line_total_snapshot' => (float) $item->line_total,
                    'line_total_after_discount' => 0.0,
                    'booking_id' => $bookingId,
                    'covered_by_package' => true,
                    'package_applied_name' => $packageName !== '' ? $packageName : null,
                ];
            })
            ->values();
        $serviceCoverageLines = $orderServiceCoverageLines
            ->concat($this->buildFallbackPackageCoveredServiceLines(
                $order,
                $packageNameByBooking,
                $orderServiceCoverageLines->pluck('booking_id')->map(fn ($id) => (int) $id)->all(),
            ))
            ->values();
        $hasDepositLine = $mixedItems->contains(fn ($item) => (string) $item->line_type === 'booking_deposit');
        $hasSettlementLine = $mixedItems->contains(fn ($item) => (string) $item->line_type === 'booking_settlement');
        $hasPackageCoverage = $serviceCoverageLines->isNotEmpty();
        $canRenderServiceCoverageLines = $hasPackageCoverage;
        $isPackageCoveredReceipt = ! $hasDepositLine
            && ! $hasSettlementLine
            && $hasPackageCoverage
            && $mixedItems->every(fn ($item) => in_array((string) ($item->line_type ?? ''), ['', 'booking_addon', 'service_package'], true));

        $packageOffset = $canRenderServiceCoverageLines
            ? (float) $serviceCoverageLines->sum(fn (array $item) => (float) ($item['line_total'] ?? 0))
            : 0.0;
        $packageNames = $canRenderServiceCoverageLines
            ? $serviceCoverageLines
                ->map(fn (array $item) => (string) ($item['package_applied_name'] ?? ''))
                ->filter(fn (string $name) => $name !== '')
                ->unique()
                ->values()
                ->all()
            : [];


        $hasOnlyDepositLines = $hasDepositLine
            && $mixedItems->count() > 0
            && $mixedItems->count() === $mixedItems->where('line_type', 'booking_deposit')->count();
        $hasOnlySettlementLines = $hasSettlementLine
            && $mixedItems->count() > 0
            && $mixedItems->count() === $mixedItems->where('line_type', 'booking_settlement')->count();

        $receiptStage = $isPackageCoveredReceipt
            ? 'package_covered_booking'
            : ($hasOnlyDepositLines
                ? 'booking_deposit'
                : ($hasOnlySettlementLines ? 'final_settlement' : 'regular'));

        $displayItems = $mixedItems;
        if ($hasOnlyDepositLines) {
            $displayItems = $mixedItems->where('line_type', 'booking_deposit')->values();
        } elseif ($hasOnlySettlementLines) {
            $displayItems = $mixedItems->where('line_type', 'booking_settlement')->values();
        }


        $displayItemsForResponse = $displayItems->map(function (OrderItem $item) {
            $row = $this->invoiceService->mapOrderItemToInvoiceRow($item);
            $discountAmount = (float) ($item->discount_amount ?? 0);
            $lineTotalSnapshot = (float) ($item->line_total_snapshot
                ?? $item->line_total
                ?? (($item->unit_price_snapshot ?? 0) * max(1, (int) ($item->quantity ?? 1))));
            $lineTotalNet = (float) ($item->line_total_after_discount
                ?? $item->effective_line_total
                ?? $item->line_total
                ?? max(0, $lineTotalSnapshot - $discountAmount));

            return [
                'type' => (string) ($item->line_type ?: 'product'),
                'name' => $row['product_name'],
                'cn_name' => $item->displayCnName(),
                'selected_booking_product_options' => is_array($item->selected_booking_product_options) ? $item->selected_booking_product_options : [],
                'variant_name' => $row['variant_name'],
                'variant_cn_name' => $row['variant_cn_name'] ?? $item->displayVariantCnName(),
                'sku' => $item->variant_sku_snapshot ?: $item->sku_snapshot,
                'qty' => $row['quantity'],
                'unit_price' => $row['unit_price'],
                'line_total' => $lineTotalNet,
                'line_total_snapshot' => $lineTotalSnapshot,
                'discount_type' => $item->discount_type,
                'discount_value' => (float) ($item->discount_value ?? 0),
                'discount_amount' => $discountAmount,
                'discount_remark' => $item->discount_remark,
                'line_total_after_discount' => $lineTotalNet,
                'booking_id' => $item->booking_id,
                'service_package_id' => $item->service_package_id,
                'customer_service_package_id' => $item->customer_service_package_id,
                'promotion_applied' => (bool) ($item->promotion_applied ?? false),
                'promotion_name' => $item->promotion_name_snapshot,
                'promotion_tier_summary' => data_get($item->promotion_snapshot, 'summary'),
                'promotion_snapshot' => $item->promotion_snapshot,
                'covered_by_package' => false,
                'package_applied_name' => null,
            ];
        })->values()->concat($serviceCoverageLines)->values();

        $summarySubtotal = (float) $order->subtotal;
        if ($canRenderServiceCoverageLines || ($mixedItems->isEmpty() && $serviceCoverageLines->isNotEmpty())) {
            $summarySubtotal = round((float) $displayItemsForResponse->sum(fn (array $item) => (float) ($item['line_total'] ?? 0)), 2);
        }

        return $this->respond([
            'order_number' => $order->order_number,
            'status' => $order->status,
            'payment_status' => $order->payment_status,
            'payment_method' => $order->payment_method,
            'payments' => $order->payments->map(fn ($payment) => [
                'method' => (string) $payment->payment_method,
                'amount' => (float) $payment->amount,
                'reference_no' => $payment->reference_no,
            ])->values(),
            'created_at' => $order->created_at,
            'subtotal' => $summarySubtotal,
            'discount_total' => $order->discount_total,
            'shipping_fee' => $order->shipping_fee,
            'grand_total' => $order->grand_total,
            'promotion_snapshot' => $order->promotion_snapshot,
            'receipt_stage' => $receiptStage,
            'receipt_stage_label' => match ($receiptStage) {
                'booking_deposit' => 'Booking Deposit Receipt',
                'final_settlement' => 'Final Settlement Receipt',
                'package_covered_booking' => 'Package-Covered Booking Receipt',
                default => 'Receipt',
            },
            'items' => $displayItemsForResponse,
            'service_items' => $serviceCoverageLines,
            'package_coverage' => ($canRenderServiceCoverageLines || $serviceCoverageLines->isNotEmpty()) ? [
                'covered' => true,
                'package_offset' => round(
                    $canRenderServiceCoverageLines ? $packageOffset : (float) $serviceCoverageLines->sum(fn (array $row) => (float) ($row['line_total'] ?? 0)),
                    2,
                ),
                'package_names' => $canRenderServiceCoverageLines ? $packageNames : $serviceCoverageLines
                    ->pluck('package_applied_name')
                    ->filter()
                    ->map(fn ($n) => (string) $n)
                    ->unique()
                    ->values()
                    ->all(),
                'note' => 'Covered by Package',
            ] : [
                'covered' => false,
                'package_offset' => 0,
                'package_names' => [],
                'note' => null,
            ],
            'package_items' => $displayItems->where('line_type', 'service_package')->groupBy('service_package_id')->map(function ($rows) {
                $first = $rows->first();
                return [
                    'type' => 'service_package',
                    'service_package_id' => (int) ($first?->service_package_id ?? 0),
                    'name' => (string) ($first?->display_name_snapshot ?: $first?->product_name_snapshot ?: 'Service Package'),
                    'qty' => (int) $rows->count(),
                    'unit_price' => (float) ($first?->effective_unit_price ?? $first?->unit_price_snapshot ?? $first?->price_snapshot ?? 0),
                    'line_total' => (float) $rows->sum(fn ($row) => (float) ($row->effective_line_total ?? $row->line_total_snapshot ?? $row->line_total ?? 0)),
                ];
            })->values(),
        ]);
    }

    private function buildFallbackPackageCoveredServiceLines(Order $order, $packageNameByBooking, array $existingBookingIds)
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

                $serviceName = (string) ($booking->service?->name ?? 'Service');
                $serviceAmount = $booking->settled_service_amount !== null
                    ? (float) $booking->settled_service_amount
                    : (float) ($booking->service?->service_price ?? $booking->service?->price ?? 0);
                $packageName = (string) ($packageNameByBooking->get($bookingId) ?? '');

                return [
                    'type' => 'service',
                    'name' => $serviceName,
                    'cn_name' => $booking->service?->cn_name,
                    'qty' => 1,
                    'unit_price' => round(max(0, $serviceAmount), 2),
                    'line_total' => round(max(0, $serviceAmount), 2),
                    'line_total_snapshot' => round(max(0, $serviceAmount), 2),
                    'line_total_after_discount' => 0.0,
                    'booking_id' => $bookingId,
                    'covered_by_package' => true,
                    'package_applied_name' => $packageName !== '' ? $packageName : null,
                ];
            })
            ->filter()
            ->values();
    }


    private function isFakeMainServiceBookingAddon($item): bool
    {
        if ((string) ($item->line_type ?? '') !== 'booking_addon') {
            return false;
        }

        $amount = (float) ($item->effective_line_total ?? $item->line_total_snapshot ?? $item->line_total ?? 0);
        if ($amount > 0.0001) {
            return false;
        }

        $serviceName = trim((string) ($item->bookingService?->name ?? ''));
        $serviceCnName = trim((string) ($item->bookingService?->cn_name ?? ''));
        if ($serviceName === '' && $serviceCnName === '') {
            return false;
        }

        $displayName = trim((string) ($item->display_name_snapshot ?: $item->product_name_snapshot));
        return $displayName !== '' && in_array(mb_strtolower($displayName), array_filter([
            $serviceName !== '' ? mb_strtolower($serviceName) : null,
            $serviceCnName !== '' ? mb_strtolower($serviceCnName) : null,
        ]), true);
    }

    private function isBookingCoveredByPackage(int $bookingId): bool
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

    public function invoice(string $token)
    {
        $receiptToken = OrderReceiptToken::query()
            ->where('token', $token)
            ->with(['order.items.bookingService:id,name,cn_name', 'order.items.booking.service:id,name,cn_name,service_price,price', 'order.serviceItems.bookingService:id,cn_name', 'order.payments'])
            ->first();

        if (! $receiptToken) {
            return $this->respondError(__('Receipt not found.'), 404);
        }

        if ($receiptToken->expires_at && Carbon::parse($receiptToken->expires_at)->isPast()) {
            return $this->respondError(__('Receipt has expired.'), 410);
        }

        $order = $receiptToken->order;
        $pdf = $this->invoiceService->buildPdf($order);
        $filename = 'Invoice-' . ($order->order_number ?? $order->id) . '.pdf';

        return response($pdf->output(), 200, [
            'Content-Type' => 'application/pdf',
            'Content-Disposition' => 'inline; filename="' . $filename . '"',
        ]);
    }
}
