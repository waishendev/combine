<?php

namespace App\Http\Controllers\Ecommerce;

use App\Http\Controllers\Controller;
use App\Models\Booking\CustomerServicePackage;
use App\Models\Ecommerce\OrderReceiptToken;
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

        $servicePackageItems = CustomerServicePackage::query()
            ->with('servicePackage:id,name,selling_price')
            ->where('purchased_from', 'POS')
            ->where('purchased_ref_id', (int) $order->id)
            ->get();

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
            'items' => $order->items->map(fn ($item) => [
                'type' => 'product',
                'name' => $item->product_name_snapshot,
                'variant_name' => $item->variant_name_snapshot,
                'sku' => $item->variant_sku_snapshot ?: $item->sku_snapshot,
                'qty' => $item->quantity,
                'unit_price' => $item->effective_unit_price ?? $item->unit_price_snapshot ?? $item->price_snapshot,
                'line_total' => $item->effective_line_total ?? $item->line_total_snapshot ?? $item->line_total,
                'promotion_applied' => (bool) ($item->promotion_applied ?? false),
                'promotion_name' => $item->promotion_name_snapshot,
                'promotion_tier_summary' => data_get($item->promotion_snapshot, 'summary'),
                'promotion_snapshot' => $item->promotion_snapshot,
            ])->values(),
            'service_items' => $order->serviceItems->where('item_type', 'service')->values()->map(fn ($item) => [
                'type' => 'service',
                'name' => $item->service_name_snapshot,
                'qty' => $item->qty,
                'unit_price' => $item->price_snapshot,
                'line_total' => $item->line_total,
            ])->values(),
            'package_items' => $servicePackageItems->groupBy('service_package_id')->map(function ($rows) {
                $first = $rows->first();
                return [
                    'type' => 'service_package',
                    'service_package_id' => (int) ($first->service_package_id ?? 0),
                    'name' => (string) ($first?->servicePackage?->name ?? 'Service Package'),
                    'qty' => (int) $rows->count(),
                    'unit_price' => (float) ($first?->servicePackage?->selling_price ?? 0),
                    'line_total' => round((float) $rows->count() * (float) ($first?->servicePackage?->selling_price ?? 0), 2),
                ];
            })->values(),
        ]);
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
