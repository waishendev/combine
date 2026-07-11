<?php

namespace App\Http\Controllers\Ecommerce;

use App\Http\Controllers\Controller;
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
            ->with(['order.items.bookingService:id,name,cn_name,deposit_amount', 'order.items.booking.service:id,name,cn_name,service_price,price', 'order.serviceItems.bookingService:id,cn_name', 'order.payments'])
            ->first();

        if (!$receiptToken) {
            return $this->respondError(__('Receipt not found.'), 404);
        }

        if ($receiptToken->expires_at && Carbon::parse($receiptToken->expires_at)->isPast()) {
            return $this->respondError(__('Receipt has expired.'), 410);
        }

        $order = $receiptToken->order;

        $settlementBookingServiceIds = $order->items
            ->filter(fn (OrderItem $item) => in_array((string) ($item->line_type ?? ''), ['booking_settlement', 'booking_addon'], true))
            ->pluck('booking_service_id')
            ->filter()
            ->map(fn ($id) => (int) $id)
            ->unique()
            ->values();

        $mixedItems = $order->items
            ->reject(fn ($item) => $this->isFakeMainServiceBookingAddon($item))
            ->filter(function (OrderItem $item) use ($settlementBookingServiceIds) {
                if ((string) ($item->line_type ?? '') !== 'service') {
                    return true;
                }

                $serviceId = (int) ($item->booking_service_id ?? 0);

                return $serviceId <= 0 || ! $settlementBookingServiceIds->contains($serviceId);
            })
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
            ->filter(fn (OrderItem $item) => in_array((string) ($item->line_type ?? ''), ['booking_deposit', 'booking_settlement', 'booking_addon', 'service'], true))
            ->pluck('booking_service_id')
            ->concat($order->serviceItems->pluck('booking_service_id'))
            ->filter()
            ->map(fn ($id) => (int) $id)
            ->unique()
            ->values()
            ->all();
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
            ->concat($this->invoiceService->buildFallbackPackageCoveredServiceItems($order, $representedBookingServiceIds)
                ->map(fn (array $row) => [
                    'type' => (string) ($row['line_type'] ?? 'service'),
                    'name' => (string) ($row['product_name'] ?? 'Service'),
                    'cn_name' => $row['product_cn_name'] ?? null,
                    'qty' => (int) ($row['quantity'] ?? 1),
                    'unit_price' => (float) ($row['unit_price'] ?? 0),
                    'line_total' => (float) ($row['line_total'] ?? 0),
                    'line_total_snapshot' => (float) ($row['line_total_snapshot'] ?? $row['line_total'] ?? 0),
                    'line_total_after_discount' => 0.0,
                    'booking_id' => (int) ($row['booking_id'] ?? 0),
                    'booking_service_id' => (int) ($row['booking_service_id'] ?? 0),
                    'covered_by_package' => true,
                    'package_applied_name' => $row['package_applied_name'] ?? null,
                ]))
            ->filter(function (array $item) use ($settlementBookingServiceIds, $order) {
                $serviceId = (int) ($item['booking_service_id'] ?? 0);
                $serviceName = (string) ($item['name'] ?? '');

                if ($this->invoiceService->orderAlreadyRepresentsPackageService($order, $serviceId, $serviceName)) {
                    return false;
                }

                if ($serviceId <= 0) {
                    return true;
                }

                return ! $settlementBookingServiceIds->contains($serviceId);
            })
            ->values();
        $hasDepositLine = $mixedItems->contains(fn ($item) => (string) $item->line_type === 'booking_deposit');
        $hasSettlementLine = $mixedItems->contains(fn ($item) => (string) $item->line_type === 'booking_settlement');
        $hasPackageCoverage = $serviceCoverageLines->isNotEmpty()
            || $mixedItems->contains(function (OrderItem $item) use ($packageNameByServiceId, $packageUsages) {
                return $this->invoiceService->resolvePackageNameForOrderItem($item, $packageNameByServiceId, $packageUsages) !== '';
            });
        $canRenderServiceCoverageLines = $hasPackageCoverage;
        $isPackageCoveredReceipt = ! $hasDepositLine
            && ! $hasSettlementLine
            && $hasPackageCoverage
            && $mixedItems->every(fn ($item) => in_array((string) ($item->line_type ?? ''), ['', 'booking_addon', 'service_package', 'service'], true));

        $hasOnlyDepositLines = $hasDepositLine
            && $mixedItems->count() > 0
            && $mixedItems->count() === $mixedItems->where('line_type', 'booking_deposit')->count();
        $hasOnlySettlementLines = $hasSettlementLine
            && $mixedItems->count() > 0
            && $mixedItems->every(fn ($item) => in_array((string) ($item->line_type ?? ''), ['booking_settlement', 'booking_addon', 'service'], true));

        $receiptStage = $isPackageCoveredReceipt
            ? 'package_covered_booking'
            : ($hasOnlyDepositLines
                ? 'booking_deposit'
                : ($hasOnlySettlementLines ? 'final_settlement' : 'regular'));

        $displayItems = $mixedItems;
        if ($hasOnlyDepositLines) {
            $displayItems = $mixedItems->where('line_type', 'booking_deposit')->values();
        } elseif ($hasOnlySettlementLines) {
            $displayItems = $mixedItems->whereIn('line_type', ['booking_settlement', 'booking_addon', 'service'])->values();
        }


        $displayItemsForResponse = $displayItems->map(function (OrderItem $item) use ($packageNameByServiceId, $packageUsages) {
            $row = $this->invoiceService->mapOrderItemToInvoiceRow($item);
            $discountAmount = (float) ($item->discount_amount ?? 0);
            $lineTotalSnapshot = $this->invoiceService->resolveOrderItemGrossSnapshot($item);
            $lineTotalNet = (float) ($item->line_total_after_discount
                ?? $item->effective_line_total
                ?? $item->line_total
                ?? max(0, $lineTotalSnapshot - $discountAmount));
            $packageName = $this->invoiceService->resolvePackageNameForOrderItem($item, $packageNameByServiceId, $packageUsages);
            $coveredByPackage = $packageName !== '';

            $lineType = (string) ($item->line_type ?: 'product');
            $rawProductName = (string) ($item->display_name_snapshot ?: $item->product_name_snapshot ?: 'Add-on');
            $formattedAddon = $lineType === 'booking_addon'
                ? $this->invoiceService->formatBookingAddonDisplayName($rawProductName)
                : null;

            return [
                'type' => $lineType,
                'name' => $lineType === 'booking_addon'
                    ? (string) ($formattedAddon['name'] ?? $rawProductName)
                    : $row['product_name'],
                'cn_name' => $item->displayCnName(),
                'addon_service_context' => $formattedAddon['service_context'] ?? null,
                'selected_booking_product_options' => is_array($item->selected_booking_product_options) ? $item->selected_booking_product_options : [],
                'variant_name' => $row['variant_name'],
                'variant_cn_name' => $row['variant_cn_name'] ?? $item->displayVariantCnName(),
                'sku' => $item->variant_sku_snapshot ?: $item->sku_snapshot,
                'qty' => $row['quantity'],
                'unit_price' => $row['unit_price'],
                'line_total' => $coveredByPackage ? 0.0 : $lineTotalNet,
                'line_total_snapshot' => $lineTotalSnapshot,
                'discount_type' => $item->discount_type,
                'discount_value' => (float) ($item->discount_value ?? 0),
                'discount_amount' => $discountAmount,
                'discount_remark' => $item->discount_remark,
                'line_total_after_discount' => $coveredByPackage ? 0.0 : $lineTotalNet,
                'booking_id' => $item->booking_id,
                'service_package_id' => $item->service_package_id,
                'customer_service_package_id' => $item->customer_service_package_id,
                'promotion_applied' => (bool) ($item->promotion_applied ?? false),
                'promotion_name' => $item->promotion_name_snapshot,
                'promotion_tier_summary' => data_get($item->promotion_snapshot, 'summary'),
                'promotion_snapshot' => $item->promotion_snapshot,
                'covered_by_package' => $coveredByPackage,
                'package_applied_name' => $coveredByPackage ? $packageName : null,
            ];
        })->values()->concat($hasDepositLine ? collect() : $serviceCoverageLines)->values();

        $packageOffset = $canRenderServiceCoverageLines
            ? round((float) $displayItemsForResponse
                ->filter(fn (array $item) => (bool) ($item['covered_by_package'] ?? false))
                ->sum(fn (array $item) => (float) ($item['line_total_snapshot'] ?? $item['line_total'] ?? 0)), 2)
            : 0.0;
        $packageNames = $canRenderServiceCoverageLines
            ? $displayItemsForResponse
                ->filter(fn (array $item) => (bool) ($item['covered_by_package'] ?? false))
                ->map(fn (array $item) => (string) ($item['package_applied_name'] ?? ''))
                ->filter(fn (string $name) => $name !== '')
                ->unique()
                ->values()
                ->all()
            : [];

        $summarySubtotal = (float) $order->subtotal;
        if ($canRenderServiceCoverageLines || ($mixedItems->isEmpty() && $serviceCoverageLines->isNotEmpty())) {
            $summarySubtotal = round((float) $displayItemsForResponse->sum(function (array $item) {
                if ((bool) ($item['covered_by_package'] ?? false)) {
                    return (float) ($item['line_total_snapshot'] ?? $item['line_total'] ?? 0);
                }

                return (float) ($item['line_total'] ?? 0);
            }), 2);
        }

        $displayGrandTotal = (float) $order->grand_total;
        if (in_array($receiptStage, ['booking_deposit', 'final_settlement'], true)) {
            $collectedFromLines = round((float) $displayItemsForResponse->sum(fn (array $item) => (float) ($item['line_total'] ?? 0)), 2);
            if ($collectedFromLines > 0.0001) {
                $displayGrandTotal = $collectedFromLines;
                $summarySubtotal = $collectedFromLines;
            }
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
            'grand_total' => $displayGrandTotal,
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
            ->with(['order.items.bookingService:id,name,cn_name,deposit_amount', 'order.items.booking.service:id,name,cn_name,service_price,price', 'order.serviceItems.bookingService:id,cn_name', 'order.payments'])
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
