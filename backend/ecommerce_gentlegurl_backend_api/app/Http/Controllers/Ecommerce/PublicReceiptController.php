<?php

namespace App\Http\Controllers\Ecommerce;

use App\Http\Controllers\Controller;
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
            ->with(['order.items', 'order.serviceItems'])
            ->first();

        if (!$receiptToken) {
            return $this->respondError(__('Receipt not found.'), 404);
        }

        if ($receiptToken->expires_at && Carbon::parse($receiptToken->expires_at)->isPast()) {
            return $this->respondError(__('Receipt has expired.'), 410);
        }

        $order = $receiptToken->order;

        $mixedItems = $order->items->values();
        $serviceItems = $order->serviceItems->where('item_type', 'service')->values();
        $hasDepositLine = $mixedItems->contains(fn ($item) => (string) $item->line_type === 'booking_deposit');
        $hasSettlementLine = $mixedItems->contains(fn ($item) => (string) $item->line_type === 'booking_settlement');
        $packageCoveredServiceItems = $serviceItems
            ->filter(fn ($item) => $this->isBookingCoveredByPackage((int) ($item->booking_id ?? 0)))
            ->values();
        $isPackageCoveredReceipt = ! $hasDepositLine
            && ! $hasSettlementLine
            && $mixedItems->isEmpty()
            && $packageCoveredServiceItems->isNotEmpty()
            && (float) ($order->grand_total ?? 0) <= 0.0001;

        $packageOffset = $isPackageCoveredReceipt
            ? (float) $packageCoveredServiceItems->sum(fn ($item) => (float) ($item->line_total ?? 0))
            : 0.0;
        $packageNames = $isPackageCoveredReceipt
            ? $packageCoveredServiceItems
                ->map(function ($item) {
                    $usage = CustomerServicePackageUsage::query()
                        ->with('customerServicePackage.servicePackage:id,name')
                        ->where('booking_id', (int) ($item->booking_id ?? 0))
                        ->whereIn('status', ['reserved', 'consumed'])
                        ->latest('id')
                        ->first();
                    return (string) ($usage?->customerServicePackage?->servicePackage?->name ?? '');
                })
                ->filter(fn (string $name) => $name !== '')
                ->unique()
                ->values()
                ->all()
            : [];

        $receiptStage = $isPackageCoveredReceipt
            ? 'package_covered_booking'
            : ($hasDepositLine
                ? 'booking_deposit'
                : ($hasSettlementLine ? 'final_settlement' : 'regular'));

        return $this->respond([
            'order_number' => $order->order_number,
            'status' => $order->status,
            'payment_status' => $order->payment_status,
            'payment_method' => $order->payment_method,
            'created_at' => $order->created_at,
            'subtotal' => $order->subtotal,
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
            'items' => $mixedItems->map(fn ($item) => [
                'type' => (string) ($item->line_type ?: 'product'),
                'name' => $item->display_name_snapshot ?: $item->product_name_snapshot,
                'variant_name' => (function () use ($item) {
                    $lineType = (string) ($item->line_type ?: '');
                    if ($lineType === 'booking_deposit') {
                        return 'Booking Deposit';
                    }
                    if ($lineType === 'booking_settlement') {
                        return 'Final Settlement';
                    }
                    return $item->variant_name_snapshot;
                })(),
                'sku' => $item->variant_sku_snapshot ?: $item->sku_snapshot,
                'qty' => $item->quantity,
                'unit_price' => $item->effective_unit_price ?? $item->unit_price_snapshot ?? $item->price_snapshot,
                'line_total' => $item->effective_line_total ?? $item->line_total_snapshot ?? $item->line_total,
                'booking_id' => $item->booking_id,
                'service_package_id' => $item->service_package_id,
                'customer_service_package_id' => $item->customer_service_package_id,
                'promotion_applied' => (bool) ($item->promotion_applied ?? false),
                'promotion_name' => $item->promotion_name_snapshot,
                'promotion_tier_summary' => data_get($item->promotion_snapshot, 'summary'),
                'promotion_snapshot' => $item->promotion_snapshot,
            ])->values(),
            'service_items' => $serviceItems->map(fn ($item) => [
                'type' => 'service',
                'name' => $item->service_name_snapshot,
                'qty' => $item->qty,
                'unit_price' => $item->price_snapshot,
                'line_total' => $item->line_total,
            ])->values(),
            'package_coverage' => $isPackageCoveredReceipt ? [
                'covered' => true,
                'package_offset' => round($packageOffset, 2),
                'package_names' => $packageNames,
                'note' => 'Covered by Package',
            ] : [
                'covered' => false,
                'package_offset' => 0,
                'package_names' => [],
                'note' => null,
            ],
            'package_items' => $mixedItems->where('line_type', 'service_package')->groupBy('service_package_id')->map(function ($rows) {
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

    private function isBookingCoveredByPackage(int $bookingId): bool
    {
        if ($bookingId <= 0) {
            return false;
        }

        return CustomerServicePackageUsage::query()
            ->where('booking_id', $bookingId)
            ->whereIn('status', ['reserved', 'consumed'])
            ->exists();
    }

    public function invoice(string $token)
    {
        $receiptToken = OrderReceiptToken::query()
            ->where('token', $token)
            ->with(['order.items', 'order.serviceItems'])
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
