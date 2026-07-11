<?php

namespace App\Services\Reports;

use App\Models\Booking\BookingPayment;
use App\Models\Booking\BookingRefund;
use App\Models\Booking\BookingRefundReceiptToken;
use App\Models\Ecommerce\Order;
use App\Models\Ecommerce\OrderItem;
use App\Models\Ecommerce\OrderActionLog;
use App\Models\Ecommerce\OrderReceiptToken;
use App\Services\Booking\CustomerServicePackageService;
use App\Models\User;
use App\Support\BookingNotes;
use App\Services\Ecommerce\InvoiceService;
use App\Services\SettingService;
use Carbon\Carbon;
use Illuminate\Database\Query\Builder;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;

class SalesChannelReportService
{
    public function __construct(
        private InvoiceService $invoiceService,
    ) {
    }

    public const CHANNEL_ALL = 'all';
    public const CHANNEL_ONLINE = 'online';
    public const CHANNEL_OFFLINE = 'offline';

    public const BOOKING_TYPE_ALL = 'all';
    public const BOOKING_TYPE_DEPOSIT = 'deposit';
    public const BOOKING_TYPE_FINAL_SETTLEMENT = 'final_settlement';
    public const BOOKING_TYPE_ADDON = 'addon';
    public const BOOKING_TYPE_PACKAGE_PURCHASE = 'package_purchase';
    public const BOOKING_TYPE_PRODUCT = 'booking_product';
    public const BOOKING_TYPE_REFUND = 'refund';

    private const BOOKING_LINE_TYPES = ['booking_deposit', 'booking_settlement', 'booking_addon', 'booking_product', 'service_package'];

    private function orderBillAtSql(string $alias = 'o'): string
    {
        return "COALESCE({$alias}.placed_at, {$alias}.created_at)";
    }

    /**
     * Mirror MyPosSummaryReportController::baseOrdersScopeQuery logic so that
     * online booking orders (status=pending + payment_status=paid) are included.
     */
    private function applyOrderScope(Builder $q, string $alias = 'o'): Builder
    {
        return $q
            ->where(function (Builder $w) use ($alias) {
                $w->where("{$alias}.status", 'completed')
                    ->orWhere("{$alias}.payment_status", 'paid');
            })
            ->whereNotIn("{$alias}.status", ['cancelled', 'draft', 'voided'])
            ->where(function (Builder $w) use ($alias) {
                $w->where("{$alias}.payment_status", '!=', 'refunded')
                    ->orWhereNull("{$alias}.payment_status");
            })
            ->whereNull("{$alias}.refunded_at");
    }


    public function orderDetails(int $orderId): array
    {
        $order = Order::query()
            ->with([
                'customer:id,name,email',
                'payments:id,order_id,payment_method,amount,reference_no',
                'uploads:id,order_id,type,file_path,note,status,created_at,updated_at',
                'items' => fn ($query) => $query->orderBy('id'),
                'items.product:id,name,cn_name',
                'items.productVariant:id,title,sku,cn_name',
                'items.booking:id,booking_code,service_id,staff_id,guest_name,guest_phone,guest_email,notes,settlement_notes,reschedule_reason',
                'items.booking.staff:id,name',
                'items.booking.service:id,name,cn_name',
                'items.bookingService:id,name,cn_name',
                'items.staff:id,name',
                'items.staffSplits.staff:id,name',
            ])
            ->where('id', $orderId)
            ->where(function ($query) {
                $query->where('status', 'completed')
                    ->orWhere('payment_status', 'paid');
            })
            ->whereNotIn('status', ['cancelled', 'draft', 'voided'])
            ->where(function ($query) {
                $query->where('payment_status', '!=', 'refunded')
                    ->orWhereNull('payment_status');
            })
            ->whereNull('refunded_at')
            ->firstOrFail();

        $payments = $order->payments
            ->map(fn ($payment) => [
                'method' => (string) $payment->payment_method,
                'amount' => (float) $payment->amount,
                'reference_no' => $payment->reference_no,
            ])
            ->values();

        $bookingNumbers = $order->items
            ->map(fn (OrderItem $item) => $item->booking?->booking_code ?: ($item->booking_id ? 'BOOKING-' . $item->booking_id : null))
            ->filter()
            ->unique()
            ->values();

        $assignedStaffNames = $order->items
            ->map(fn (OrderItem $item) => $item->booking?->staff?->name)
            ->filter()
            ->unique()
            ->values();

        $paymentProofs = $this->paymentProofsForOrder($order);

        $lineTypes = $order->items
            ->pluck('line_type')
            ->map(fn ($type) => $this->displayLineType((string) $type))
            ->filter()
            ->unique()
            ->values();

        $overrideUserLabels = $order->items
            ->flatMap(fn (OrderItem $item) => $this->priceOverrideUserIdsForOrderItem($item))
            ->filter()
            ->map(fn ($id) => (int) $id)
            ->unique()
            ->values();
        $overrideUsers = $overrideUserLabels->isEmpty()
            ? collect()
            : User::query()
                ->whereIn('id', $overrideUserLabels->all())
                ->get(['id', 'name', 'email'])
                ->mapWithKeys(fn (User $user) => [(int) $user->id => (string) ($user->email ?: $user->name ?: ('User #' . $user->id))]);

        $bookingRemarks = $this->resolveOrderBookingRemarks($order);

        return [
            'order' => [
                'id' => (int) $order->id,
                'order_no' => (string) $order->order_number,
                'order_datetime' => optional($order->placed_at ?? $order->created_at)?->toIso8601String(),
                'placed_at' => optional($order->placed_at)?->toIso8601String(),
                'created_at' => optional($order->created_at)?->toIso8601String(),
                'customer' => $this->resolveOrderCustomerDisplayName($order),
                'payment_method' => (string) ($order->payment_method ?: 'unknown'),
                'payments' => $payments->all(),
                'type' => $lineTypes->isEmpty() ? 'Order' : $lineTypes->implode(', '),
                'booking_no' => $bookingNumbers->isEmpty() ? null : $bookingNumbers->implode(', '),
                'assigned_staff_name' => $assignedStaffNames->isEmpty() ? null : $assignedStaffNames->implode(', '),
                'status' => (string) $order->status,
                'grand_total' => (float) $order->grand_total,
                'payment_proofs' => $paymentProofs,
                'receipt_public_url' => $this->resolveReceiptPublicUrl($order),
                'customer_email' => $this->resolveReceiptCustomerEmail($order),
                ...$bookingRemarks,
            ],
            'lines' => $order->items->map(fn (OrderItem $item) => $this->formatOrderDetailLine($item, $overrideUsers->all()))->values()->all(),
            'action_logs' => $this->orderActionLogs((int) $order->id),
        ];
    }

    private function resolveOrderBookingRemarks(Order $order): array
    {
        $bookings = $order->items
            ->map(fn (OrderItem $item) => $item->booking)
            ->filter()
            ->unique('id');

        $notes = [];
        $voidRemarks = [];
        $settlementNotes = [];
        $rescheduleReasons = [];

        foreach ($bookings as $booking) {
            if ($value = BookingNotes::customerRemarksForDisplay($booking->notes)) {
                $notes[] = $value;
            }
            if ($value = BookingNotes::voidRemarksForDisplay($booking->notes)) {
                $voidRemarks[] = $value;
            }
            if ($value = trim((string) ($booking->settlement_notes ?? ''))) {
                $settlementNotes[] = $value;
            }
            if ($value = trim((string) ($booking->reschedule_reason ?? ''))) {
                $rescheduleReasons[] = $value;
            }
        }

        $joinUnique = static fn (array $values): ?string => ($filtered = array_values(array_unique(array_filter($values)))) === []
            ? null
            : implode("\n", $filtered);

        return [
            'notes' => $joinUnique($notes),
            'void_remarks' => $joinUnique($voidRemarks),
            'settlement_notes' => $joinUnique($settlementNotes),
            'reschedule_reason' => $joinUnique($rescheduleReasons),
        ];
    }

    private function orderActionLogs(int $orderId): array
    {
        $logs = OrderActionLog::query()
            ->where('entity_type', 'order')
            ->where('entity_id', $orderId)
            ->orderByDesc('id')
            ->limit(40)
            ->get();

        if ($logs->isEmpty()) {
            return [];
        }

        $users = User::query()
            ->whereIn('id', $logs->pluck('created_by')->filter()->unique()->all())
            ->get(['id', 'name', 'email'])
            ->keyBy('id');

        return $logs->map(function (OrderActionLog $log) use ($users) {
            $user = $log->created_by ? $users->get((int) $log->created_by) : null;

            return [
                'id' => (int) $log->id,
                'action_type' => (string) $log->action_type,
                'before_value' => $log->before_value,
                'after_value' => $log->after_value,
                'remark' => $log->remark,
                'created_at' => $log->created_at?->toIso8601String(),
                'created_by_name' => $user ? (string) ($user->name ?: $user->email) : null,
            ];
        })->values()->all();
    }


    private function paymentProofsForOrder(Order $order): array
    {
        $proofs = collect();

        $order->uploads
            ->where('type', 'payment_slip')
            ->each(function ($upload) use ($proofs, $order) {
                if (! $upload->file_url) {
                    return;
                }

                $proofs->push([
                    'id' => 'order-upload-' . $upload->id,
                    'file_url' => $upload->file_url,
                    'uploaded_at' => optional($upload->created_at)?->toIso8601String(),
                    'payment_method' => (string) ($order->payment_method ?? ''),
                    'note' => $upload->note,
                    'status' => $upload->status,
                ]);
            });

        $bookingIds = $order->items
            ->pluck('booking_id')
            ->filter()
            ->map(fn ($id) => (int) $id)
            ->unique()
            ->values();

        if ($bookingIds->isNotEmpty()) {
            BookingPayment::query()
                ->whereIn('booking_id', $bookingIds->all())
                ->orderBy('id')
                ->get(['id', 'booking_id', 'provider', 'status', 'raw_response', 'created_at', 'updated_at'])
                ->each(function (BookingPayment $payment) use ($proofs) {
                    $raw = $payment->raw_response ?? [];
                    $manualUrl = data_get($raw, 'manual_slip_url');
                    $proofPath = data_get($raw, 'proof_path');
                    $fileUrl = $manualUrl ?: ($proofPath ? Storage::disk('public')->url((string) $proofPath) : null);

                    if (! $fileUrl) {
                        return;
                    }

                    $proofs->push([
                        'id' => 'booking-payment-' . $payment->id,
                        'file_url' => (string) $fileUrl,
                        'uploaded_at' => optional($payment->updated_at ?? $payment->created_at)?->toIso8601String(),
                        'payment_method' => (string) data_get($raw, 'payment_method', $payment->provider),
                        'note' => data_get($raw, 'manual_slip_note'),
                        'status' => (string) ($payment->status ?? data_get($raw, 'payment_status', '')),
                    ]);
                });
        }

        return $proofs
            ->unique(fn (array $proof) => $proof['file_url'])
            ->values()
            ->all();
    }

    private function formatOrderDetailLine(OrderItem $item, array $overrideUsers = []): array
    {
        $gross = (float) ($item->line_total_snapshot ?? (((float) $item->line_total) + (float) ($item->discount_amount ?? 0)));
        $discount = (float) ($item->discount_amount ?? 0);
        $net = (float) ($item->line_total_after_discount ?? $item->effective_line_total ?? max(0.0, $gross - $discount));
        $unitPrice = (float) ($item->unit_price_snapshot ?? $item->price_snapshot ?? 0);
        $children = $this->formatOrderDetailChildren($item, $overrideUsers);

        if ((string) ($item->line_type ?? '') === 'booking_product' && $children !== []) {
            $childGross = collect($children)->sum(fn (array $child) => (float) ($child['gross_amount'] ?? 0));
            $childDiscount = collect($children)->sum(fn (array $child) => (float) ($child['discount_amount'] ?? 0));
            $childNet = collect($children)->sum(fn (array $child) => (float) ($child['net_amount'] ?? 0));
            $gross = round(max(0.0, $gross - $childGross), 2);
            $discount = round(max(0.0, $discount - $childDiscount), 2);
            $net = round(max(0.0, $net - $childNet), 2);
            $unitPrice = round($gross / max(1, (int) ($item->quantity ?? 1)), 2);
        }
        $variantName = trim((string) ($item->variant_name_snapshot ?: $item->productVariant?->title ?: ''));
        $lineType = (string) ($item->line_type ?? 'product');
        $productCnName = match ($lineType) {
            'product' => ($cn = trim((string) ($item->product?->cn_name ?? ''))) !== '' ? $cn : null,
            default => $item->displayCnName(),
        };
        $bookingNo = $item->booking?->booking_code ?: ($item->booking_id ? 'BOOKING-' . $item->booking_id : null);
        $rawName = (string) ($item->display_name_snapshot ?: $item->product_name_snapshot ?: $item->product?->name ?: $item->bookingService?->name ?: 'Line item');
        $formattedAddon = $lineType === 'booking_addon'
            ? $this->invoiceService->formatBookingAddonDisplayName($rawName)
            : null;

        $staffSplits = $item->staffSplits
            ->filter(fn ($split) => ! in_array((string) ($split->line_type ?? ''), ['booking_product_option'], true))
            ->map(fn ($split) => [
                'staff_id' => (int) $split->staff_id,
                'staff_name' => (string) ($split->staff?->name ?? ('Staff #' . $split->staff_id)),
                'share_percent' => (int) $split->share_percent,
                'commission_rate_snapshot' => (float) ($split->commission_rate_snapshot ?? 0),
            ])
            ->values();

        $staffSplits = $this->resolveBookingStaffSplitsForLine($item, $staffSplits);
        $assignedStaffName = $item->booking?->staff?->name
            ?: ($staffSplits->first()['staff_name'] ?? null);

        return [
            'id' => (int) $item->id,
            'line_type' => (string) ($item->line_type ?? 'product'),
            'type_label' => $this->displayLineType((string) ($item->line_type ?? 'product')),
            'booking_no' => $bookingNo,
            'name' => is_array($formattedAddon) ? (string) ($formattedAddon['name'] ?? $rawName) : $rawName,
            'cn_name' => $productCnName,
            'addon_service_context' => is_array($formattedAddon) ? ($formattedAddon['service_context'] ?? null) : null,
            'variant_name' => $variantName !== '' ? $variantName : null,
            'variant_cn_name' => $item->displayVariantCnName(),
            'sku' => $item->variant_sku_snapshot ?: $item->sku_snapshot ?: $item->productVariant?->sku,
            'qty' => (int) ($item->quantity ?? 1),
            'unit_price' => $unitPrice,
            'gross_amount' => $gross,
            'discount_amount' => $discount,
            'net_amount' => $net,
            'discount_type' => $item->discount_type,
            'discount_value' => (float) ($item->discount_value ?? 0),
            'discount_remark' => $item->discount_remark,
            'price_override' => $this->normalizeOrderItemPriceOverride($item, $overrideUsers),
            'package_applied' => $this->resolveLinePackageApplied($item),
            'package_name' => $this->resolveLinePackageName($item),
            'children' => $children,
            'staff_name' => $item->staff?->name ?: $assignedStaffName,
            'assigned_staff_name' => $assignedStaffName,
            'staff_splits' => $staffSplits->all(),
        ];
    }

    private function resolveLinePackageApplied(OrderItem $item): bool
    {
        $bookingServiceId = (int) ($item->booking_service_id ?? 0);
        if ($bookingServiceId <= 0) {
            return false;
        }

        return \App\Models\Booking\CustomerServicePackageUsage::query()
            ->where('booking_service_id', $bookingServiceId)
            ->where(function ($q) use ($item) {
                $this->applyOrderItemPackageUsageScope($q, $item);
            })
            ->whereIn('status', ['reserved', 'consumed'])
            ->exists();
    }

    private function resolveLinePackageName(OrderItem $item): ?string
    {
        $bookingServiceId = (int) ($item->booking_service_id ?? 0);
        if ($bookingServiceId <= 0) {
            return null;
        }

        $usage = \App\Models\Booking\CustomerServicePackageUsage::query()
            ->with('customerServicePackage.servicePackage')
            ->where('booking_service_id', $bookingServiceId)
            ->where(function ($q) use ($item) {
                $this->applyOrderItemPackageUsageScope($q, $item);
            })
            ->whereIn('status', ['reserved', 'consumed'])
            ->first();

        return $usage?->customerServicePackage?->servicePackage?->name ?? null;
    }

    private function applyOrderItemPackageUsageScope($query, OrderItem $item): void
    {
        $bookingId = (int) ($item->booking_id ?? 0);
        $posCartItemIds = app(CustomerServicePackageService::class)->resolvePosCartServiceItemIdsForOrderItem((int) $item->id);

        $query->where(function ($q) use ($bookingId, $posCartItemIds) {
            if ($bookingId > 0) {
                $q->where('booking_id', $bookingId)
                    ->orWhere(function ($q2) use ($bookingId) {
                        $q2->where('used_from', 'POS')
                            ->where('used_ref_id', $bookingId);
                    });
            }

            if ($posCartItemIds !== []) {
                $q->orWhere(function ($q3) use ($posCartItemIds) {
                    $q3->where('used_from', 'POS')
                        ->whereIn('used_ref_id', $posCartItemIds);
                })->orWhereIn('booking_id', $posCartItemIds);
            }

            if ($bookingId <= 0 && $posCartItemIds === []) {
                $q->whereNotNull('id');
            }
        });
    }

    private function resolveBookingStaffSplitsForLine(OrderItem $item, $existingSplits)
    {
        if ($existingSplits->isNotEmpty()) {
            return $existingSplits;
        }

        $bookingId = (int) ($item->booking_id ?? 0);
        if ($bookingId <= 0) {
            return $existingSplits;
        }

        $lineType = (string) ($item->line_type ?? '');
        if (! in_array($lineType, ['booking_deposit', 'booking_settlement', 'booking_addon', 'booking_product'], true)) {
            return $existingSplits;
        }

        $bookingSplits = DB::table('booking_service_staff_splits as splits')
            ->leftJoin('staffs', 'staffs.id', '=', 'splits.staff_id')
            ->where('splits.booking_id', $bookingId)
            ->orderBy('splits.id')
            ->get([
                'splits.staff_id',
                'staffs.name as staff_name',
                'splits.split_percent',
                'splits.service_commission_rate_snapshot',
            ])
            ->map(fn ($row) => [
                'staff_id' => (int) ($row->staff_id ?? 0),
                'staff_name' => (string) ($row->staff_name ?? ('Staff #' . ($row->staff_id ?? 0))),
                'share_percent' => (int) ($row->split_percent ?? 0),
                'commission_rate_snapshot' => (float) ($row->service_commission_rate_snapshot ?? 0),
            ])
            ->filter(fn (array $row) => $row['staff_id'] > 0 && $row['share_percent'] > 0)
            ->values();

        if ($bookingSplits->isNotEmpty()) {
            return $bookingSplits;
        }

        $fallbackStaffId = (int) ($item->booking?->staff_id ?? 0);
        if ($fallbackStaffId <= 0) {
            return $existingSplits;
        }

        $fallbackName = (string) ($item->booking?->staff?->name ?? ('Staff #' . $fallbackStaffId));

        return collect([[
            'staff_id' => $fallbackStaffId,
            'staff_name' => $fallbackName,
            'share_percent' => 100,
            'commission_rate_snapshot' => 0.0,
        ]]);
    }


    private function priceOverrideUserIdsForOrderItem(OrderItem $item): array
    {
        $ids = [];
        $itemOverrideUser = data_get($item->price_override_snapshot, 'price_overridden_by');
        if ($itemOverrideUser) {
            $ids[] = (int) $itemOverrideUser;
        }

        foreach ((array) ($item->selected_booking_product_options ?? []) as $question) {
            foreach ((array) ($question['options'] ?? []) as $option) {
                $optionOverrideUser = data_get($option, 'price_overridden_by');
                if ($optionOverrideUser) {
                    $ids[] = (int) $optionOverrideUser;
                }
            }
        }

        return array_values(array_unique(array_filter($ids)));
    }

    private function formatOrderDetailChildren(OrderItem $item, array $overrideUsers = []): array
    {
        $children = [];
        $qty = max(1, (int) ($item->quantity ?? 1));

        foreach ((array) ($item->selected_booking_product_options ?? []) as $question) {
            foreach ((array) ($question['options'] ?? []) as $index => $option) {
                $unitPrice = (float) ($option['extra_price'] ?? $option['unit_price'] ?? 0);
                $lineTotal = isset($option['line_total_override'])
                    ? (float) $option['line_total_override']
                    : round($unitPrice * $qty, 2);
                $discount = (float) ($option['discount_amount'] ?? 0);
                $net = (float) ($option['line_total_after_discount'] ?? max(0.0, $lineTotal - $discount));
                $name = (string) ($option['label'] ?? $option['name'] ?? $option['option_name'] ?? 'Booking product option');
                $cnName = (string) ($option['cn_label'] ?? $option['cn_name'] ?? $option['linked_cn_name'] ?? '');
                $optionId = (string) ($option['id'] ?? $option['option_id'] ?? $index);
                $staffSplits = $this->bookingProductOptionStaffSplits($item, $option, $optionId);

                $children[] = [
                    'id' => sprintf('%d-option-%s-%d', (int) $item->id, $optionId, count($children) + 1),
                    'line_type' => 'booking_product_option',
                    'type_label' => 'Booking Product Option',
                    'booking_no' => $item->booking?->booking_code ?: ($item->booking_id ? 'BOOKING-' . $item->booking_id : null),
                    'name' => $name,
                    'cn_name' => trim($cnName) !== '' ? $cnName : null,
                    'variant_name' => (string) ($question['label'] ?? $question['name'] ?? '') ?: null,
                    'variant_cn_name' => (string) ($question['cn_label'] ?? $question['cn_name'] ?? '') ?: null,
                    'sku' => null,
                    'qty' => $qty,
                    'unit_price' => $unitPrice,
                    'gross_amount' => $lineTotal,
                    'line_total' => $lineTotal,
                    'discount_amount' => $discount,
                    'net_amount' => $net,
                    'discount_type' => $option['discount_type'] ?? null,
                    'discount_value' => (float) ($option['discount_value'] ?? 0),
                    'discount_remark' => $option['discount_remark'] ?? null,
                    'price_override' => $this->normalizeBookingProductOptionPriceOverride($option, $qty, $overrideUsers),
                    'staff_name' => null,
                    'staff_splits' => $staffSplits,
                    'children' => [],
                ];
            }
        }

        return $children;
    }


    private function bookingProductOptionStaffSplits(OrderItem $item, array $option, string $optionId): array
    {
        $splits = $item->staffSplits
            ->filter(fn ($split) => (string) ($split->line_type ?? '') === 'booking_product_option'
                && (string) ($split->line_ref_id ?? '') === $optionId)
            ->map(fn ($split) => [
                'staff_id' => (int) $split->staff_id,
                'staff_name' => (string) ($split->staff?->name ?? ('Staff #' . $split->staff_id)),
                'share_percent' => (int) $split->share_percent,
                'commission_rate_snapshot' => (float) ($split->commission_rate_snapshot ?? 0),
            ])
            ->values()
            ->all();

        if ($splits !== []) {
            return $splits;
        }

        return collect($option['staff_splits'] ?? [])
            ->map(fn ($split) => [
                'staff_id' => (int) ($split['staff_id'] ?? 0),
                'staff_name' => (string) ($split['staff_name'] ?? $split['name'] ?? ('Staff #' . ($split['staff_id'] ?? 0))),
                'share_percent' => (int) ($split['share_percent'] ?? 0),
                'commission_rate_snapshot' => (float) ($split['commission_rate_snapshot'] ?? 0),
            ])
            ->filter(fn (array $split) => $split['staff_id'] > 0 && $split['share_percent'] > 0)
            ->values()
            ->all();
    }

    private function normalizeBookingProductOptionPriceOverride(array $option, int $quantity, array $overrideUsers = []): ?array
    {
        $hasOverride = array_key_exists('original_unit_price_snapshot', $option)
            || array_key_exists('line_total_override', $option)
            || ! empty($option['price_override_reason'])
            || ! empty($option['price_overridden_by'])
            || ! empty($option['price_overridden_at']);

        if (! $hasOverride) {
            return null;
        }

        $qty = max(1, $quantity);
        $adjusted = (float) ($option['extra_price'] ?? $option['unit_price'] ?? 0);
        $original = (float) ($option['original_unit_price_snapshot'] ?? $option['original_unit_price'] ?? $adjusted);
        $adjustedLine = isset($option['line_total_override']) ? (float) $option['line_total_override'] : round($adjusted * $qty, 2);
        $overriddenBy = isset($option['price_overridden_by']) ? (int) $option['price_overridden_by'] : null;

        return [
            'original_unit_price' => round(max(0.0, $original), 2),
            'original_unit_price_snapshot' => round(max(0.0, $original), 2),
            'adjusted_unit_price' => round(max(0.0, $adjusted), 2),
            'final_unit_price' => round(max(0.0, $adjusted), 2),
            'unit_price_snapshot' => round(max(0.0, $adjusted), 2),
            'original_line_total' => round(max(0.0, $original * $qty), 2),
            'adjusted_line_total' => round(max(0.0, $adjustedLine), 2),
            'final_line_total' => round(max(0.0, $adjustedLine), 2),
            'price_override_amount' => round(max(0.0, $adjusted) - max(0.0, $original), 2),
            'price_override_reason' => $option['price_override_reason'] ?? null,
            'price_override_mode' => isset($option['line_total_override']) ? 'line_total' : 'unit_price',
            'price_overridden_by' => $overriddenBy,
            'price_overridden_by_label' => $overriddenBy ? ($overrideUsers[$overriddenBy] ?? ('User #' . $overriddenBy)) : null,
            'price_overridden_at' => $option['price_overridden_at'] ?? null,
        ];
    }

    private function normalizeOrderItemPriceOverride(OrderItem $item, array $overrideUsers = []): ?array
    {
        $snapshot = $item->price_override_snapshot;
        if (is_string($snapshot) && $snapshot !== '') {
            $decoded = json_decode($snapshot, true);
            $snapshot = is_array($decoded) ? $decoded : null;
        }
        if (! is_array($snapshot)) {
            return null;
        }

        $qty = max(1, (int) ($item->quantity ?? 1));
        $original = (float) ($snapshot['original_unit_price'] ?? $snapshot['original_unit_price_snapshot'] ?? 0);
        $adjusted = (float) ($snapshot['adjusted_unit_price'] ?? $snapshot['final_unit_price'] ?? $snapshot['unit_price_snapshot'] ?? 0);
        $originalLine = (float) ($snapshot['original_line_total'] ?? ($original * $qty));
        $adjustedLine = (float) ($snapshot['adjusted_line_total'] ?? $snapshot['final_line_total'] ?? ($adjusted * $qty));

        if ($original <= 0.0001 && $adjusted <= 0.0001 && empty($snapshot['price_override_reason'])) {
            return null;
        }

        $overriddenBy = isset($snapshot['price_overridden_by']) ? (int) $snapshot['price_overridden_by'] : null;

        return [
            'original_unit_price' => round(max(0.0, $original), 2),
            'original_unit_price_snapshot' => round(max(0.0, $original), 2),
            'adjusted_unit_price' => round(max(0.0, $adjusted), 2),
            'final_unit_price' => round(max(0.0, $adjusted), 2),
            'unit_price_snapshot' => round(max(0.0, $adjusted), 2),
            'original_line_total' => round(max(0.0, $originalLine), 2),
            'adjusted_line_total' => round(max(0.0, $adjustedLine), 2),
            'final_line_total' => round(max(0.0, $adjustedLine), 2),
            'price_override_amount' => round(max(0.0, $adjusted) - max(0.0, $original), 2),
            'price_override_reason' => $snapshot['price_override_reason'] ?? null,
            'price_override_mode' => $snapshot['price_override_mode'] ?? null,
            'price_overridden_by' => $overriddenBy,
            'price_overridden_by_label' => $overriddenBy ? ($overrideUsers[$overriddenBy] ?? ('User #' . $overriddenBy)) : null,
            'price_overridden_at' => $snapshot['price_overridden_at'] ?? null,
        ];
    }

    private function displayLineType(string $lineType): string
    {
        return match ($lineType) {
            'booking_deposit' => 'Booking Deposit',
            'booking_settlement' => 'Settlement Service',
            'booking_addon' => 'Add-on',
            'service_package' => 'Service Package',
            'booking_product' => 'Booking Product',
            default => 'Product',
        };
    }

    public function ecommerce(Carbon $start, Carbon $end, array $filters = []): array
    {
        $channel = $this->normalizeChannel((string) ($filters['channel'] ?? self::CHANNEL_ALL));
        $perPage = max(1, (int) ($filters['per_page'] ?? 15));
        $page = max(1, (int) ($filters['page'] ?? 1));
        $paymentMethod = $this->nullableString($filters['payment_method'] ?? null);
        $status = $this->nullableString($filters['status'] ?? null);
        $customerId = $this->nullableInt($filters['customer_id'] ?? null);

        $baseQuery = $this->baseEcommerceRowsQuery($start, $end, $channel, $paymentMethod, $status, $customerId);

        $paginator = (clone $baseQuery)
            ->orderByDesc('order_datetime')
            ->paginate($perPage, ['*'], 'page', $page);

        $paymentRowsByOrder = $this->paymentRowsByOrderIds(collect($paginator->items())->pluck('order_id')->all());

        $rows = collect($paginator->items())->map(function ($row) use ($paymentRowsByOrder) {
            return [
                'order_id' => (int) $row->order_id,
                'order_no' => (string) $row->order_no,
                'order_datetime' => (string) $row->order_datetime,
                'customer' => $this->formatCustomerDisplayName(
                    $row->customer_name ?? null,
                    $row->shipping_name ?? null,
                    $row->billing_name ?? null,
                    $row->booking_guest_name ?? null,
                ),
                'channel' => (string) $row->channel,
                'payment_method' => (string) ($row->payment_method ?: 'unknown'),
                'payments' => $paymentRowsByOrder->get((int) $row->order_id, []),
                'order_total' => (float) $row->order_total,
                'item_count' => (int) $row->item_count,
                'product_amount' => (float) $row->product_amount,
                'discount' => (float) $row->discount,
                'net_amount' => (float) $row->net_amount,
                'status' => (string) $row->status,
            ];
        })->values();

        $refundRows = $this->ecommerceRefundReportRows($start, $end, $channel, $paymentMethod, $customerId);
        $rows = $rows->concat($refundRows)->sortByDesc('order_datetime')->values();

        $summaryRow = (clone $baseQuery)
            ->selectRaw('COUNT(*) as total_orders')
            ->selectRaw('COALESCE(SUM(net_amount), 0) as total_sales')
            ->selectRaw("COALESCE(SUM(CASE WHEN channel = 'online' THEN net_amount ELSE 0 END), 0) as online_sales")
            ->selectRaw("COALESCE(SUM(CASE WHEN channel = 'offline' THEN net_amount ELSE 0 END), 0) as offline_sales")
            ->first();

        $totalsPage = $this->aggregateEcommerceTotals($rows);
        $totalsPage['orders_count'] = (int) $rows->pluck('order_id')->filter(fn (int $id) => $id > 0)->unique()->count()
            + (int) $rows->where('is_refund', true)->count();
        $refundNetTotal = (float) $refundRows->sum('net_amount');
        $grandTotals = [
            'orders_count' => (int) ($summaryRow->total_orders ?? 0) + ($refundNetTotal !== 0.0 ? (int) $refundRows->count() : 0),
            'product_amount' => (float) ((clone $baseQuery)->sum('product_amount') ?? 0),
            'discount' => (float) ((clone $baseQuery)->sum('discount') ?? 0),
            'net_amount' => (float) ($summaryRow->total_sales ?? 0) + $refundNetTotal,
        ];

        return [
            'summary' => [
                'total_sales' => (float) ($summaryRow->total_sales ?? 0),
                'online_sales' => (float) ($summaryRow->online_sales ?? 0),
                'offline_sales' => (float) ($summaryRow->offline_sales ?? 0),
                'total_orders' => (int) ($summaryRow->total_orders ?? 0),
            ],
            'totals_page' => $totalsPage,
            'grand_totals' => $grandTotals,
            'rows' => $rows,
            'pagination' => [
                'total' => $paginator->total(),
                'per_page' => $paginator->perPage(),
                'current_page' => $paginator->currentPage(),
                'last_page' => $paginator->lastPage(),
            ],
        ];
    }

    public function ecommerceRows(Carbon $start, Carbon $end, array $filters = [])
    {
        $channel = $this->normalizeChannel((string) ($filters['channel'] ?? self::CHANNEL_ALL));
        $paymentMethod = $this->nullableString($filters['payment_method'] ?? null);
        $status = $this->nullableString($filters['status'] ?? null);
        $customerId = $this->nullableInt($filters['customer_id'] ?? null);

        return $this->baseEcommerceRowsQuery($start, $end, $channel, $paymentMethod, $status, $customerId)
            ->orderByDesc('order_datetime')
            ->cursor()
            ->map(function ($row) {
                return [
                    'order_id' => (int) $row->order_id,
                    'order_no' => (string) $row->order_no,
                    'date_time' => (string) $row->order_datetime,
                    'customer' => $this->formatCustomerDisplayName(
                    $row->customer_name ?? null,
                    $row->shipping_name ?? null,
                    $row->billing_name ?? null,
                    $row->booking_guest_name ?? null,
                ),
                    'channel' => (string) $row->channel,
                    'payment_method' => (string) ($row->payment_method ?: 'unknown'),
                    'item_count' => (int) $row->item_count,
                    'product_amount' => (float) $row->product_amount,
                    'discount' => (float) $row->discount,
                    'net_amount' => (float) $row->net_amount,
                    'status' => (string) $row->status,
                ];
            });
    }

    public function booking(Carbon $start, Carbon $end, array $filters = []): array
    {
        $channel = $this->normalizeChannel((string) ($filters['channel'] ?? self::CHANNEL_ALL));
        $type = $this->normalizeBookingType((string) ($filters['type'] ?? self::BOOKING_TYPE_ALL));
        $perPage = max(1, (int) ($filters['per_page'] ?? 15));
        $page = max(1, (int) ($filters['page'] ?? 1));
        $paymentMethod = $this->nullableString($filters['payment_method'] ?? null);
        $customerId = $this->nullableInt($filters['customer_id'] ?? null);

        $baseQuery = $this->baseBookingRowsQuery($start, $end, $channel, $paymentMethod, $type, $customerId);

        // Paginate by distinct order — UI groups line items (deposit/settlement/add-on) into one row per order.
        $distinctOrdersQuery = (clone $baseQuery)
            ->selectRaw('order_id')
            ->selectRaw('MAX(order_datetime) as order_datetime')
            ->groupBy('order_id');

        $paginator = DB::query()
            ->fromSub($distinctOrdersQuery, 'distinct_orders')
            ->orderByDesc('order_datetime')
            ->orderByDesc('order_id')
            ->paginate($perPage, ['*'], 'page', $page);

        $orderIds = collect($paginator->items())
            ->pluck('order_id')
            ->map(fn ($id) => (int) $id)
            ->filter(fn (int $id) => $id > 0)
            ->values()
            ->all();

        $pageItems = $orderIds === []
            ? collect()
            : (clone $baseQuery)
                ->whereIn('order_id', $orderIds)
                ->orderByDesc('order_datetime')
                ->orderBy('order_id')
                ->get();

        $cnNames = $this->resolveOrderItemCnNames($pageItems->pluck('order_item_id')->all());
        $paymentRowsByOrder = $this->paymentRowsByOrderIds($pageItems->pluck('order_id')->all());
        $orderItemsById = OrderItem::query()
            ->whereIn('id', $pageItems->pluck('order_item_id')->map(fn ($id) => (int) $id)->filter(fn (int $id) => $id > 0)->unique()->values()->all())
            ->get()
            ->keyBy('id');

        $rows = $pageItems->map(function ($row) use ($cnNames, $paymentRowsByOrder, $orderItemsById) {
            $orderItem = $orderItemsById->get((int) $row->order_item_id);

            return [
                'order_id' => (int) $row->order_id,
                'order_no' => (string) $row->order_no,
                'order_datetime' => (string) $row->order_datetime,
                'customer' => $this->formatCustomerDisplayName(
                    $row->customer_name ?? null,
                    $row->shipping_name ?? null,
                    $row->billing_name ?? null,
                    $row->booking_guest_name ?? null,
                ),
                'channel' => (string) $row->channel,
                'payment_method' => (string) ($row->payment_method ?: 'unknown'),
                'payments' => $paymentRowsByOrder->get((int) $row->order_id, []),
                'order_total' => (float) $row->order_total,
                'type' => (string) $row->type,
                'booking_id' => $row->booking_id ? (int) $row->booking_id : null,
                'booking_no' => $row->booking_no,
                'package_name' => $row->package_name,
                'package_cn_name' => $cnNames->get((int) $row->order_item_id),
                'package_applied' => $orderItem ? $this->resolveLinePackageApplied($orderItem) : false,
                'applied_package_name' => $orderItem ? $this->resolveLinePackageName($orderItem) : null,
                'gross_amount' => (float) $row->gross_amount,
                'discount' => (float) $row->discount,
                'net_amount' => (float) $row->net_amount,
                'status' => (string) $row->status,
            ];
        })->values();

        $refundRows = ($type === self::BOOKING_TYPE_ALL || $type === self::BOOKING_TYPE_REFUND)
            ? $this->bookingRefundReportRows($start, $end, $channel, $paymentMethod, $customerId)
            : collect();
        $rows = $rows->concat($refundRows)->sortByDesc('order_datetime')->values();

        $summaryRow = (clone $baseQuery)
            ->selectRaw('COUNT(*) as total_transactions')
            ->selectRaw('COALESCE(SUM(net_amount), 0) as total_booking_revenue')
            ->selectRaw("COALESCE(SUM(CASE WHEN channel = 'online' THEN net_amount ELSE 0 END), 0) as online_booking_revenue")
            ->selectRaw("COALESCE(SUM(CASE WHEN channel = 'offline' THEN net_amount ELSE 0 END), 0) as offline_booking_revenue")
            ->selectRaw("COALESCE(SUM(CASE WHEN type = 'deposit' THEN net_amount ELSE 0 END), 0) as booking_deposit_amount")
            ->selectRaw("COALESCE(SUM(CASE WHEN type = 'final_settlement' THEN net_amount ELSE 0 END), 0) as booking_settlement_amount")
            ->selectRaw("COALESCE(SUM(CASE WHEN type = 'addon' THEN net_amount ELSE 0 END), 0) as addon_revenue")
            ->selectRaw("COALESCE(SUM(CASE WHEN type = 'package_purchase' THEN net_amount ELSE 0 END), 0) as package_purchase_amount")
            ->selectRaw("COALESCE(SUM(CASE WHEN type = 'booking_product' THEN net_amount ELSE 0 END), 0) as booking_product_amount")
            ->first();

        $totalsPage = $this->aggregateBookingTotals($rows);
        $totalsPage['orders_count'] = (int) $rows->pluck('order_id')->filter(fn (int $id) => $id > 0)->unique()->count() + (int) $rows->where('is_refund', true)->count();
        $refundNetTotal = ($type === self::BOOKING_TYPE_ALL || $type === self::BOOKING_TYPE_REFUND)
            ? (float) $this->bookingRefundReportRows($start, $end, $channel, $paymentMethod, $customerId)->sum('net_amount')
            : 0.0;
        $grandTotals = [
            'orders_count' => (int) ($summaryRow->total_transactions ?? 0) + ($refundNetTotal !== 0.0 ? (int) $this->bookingRefundReportRows($start, $end, $channel, $paymentMethod, $customerId)->count() : 0),
            'gross_amount' => (float) ((clone $baseQuery)->sum('gross_amount') ?? 0),
            'discount' => (float) ((clone $baseQuery)->sum('discount') ?? 0),
            'net_amount' => (float) ($summaryRow->total_booking_revenue ?? 0) + $refundNetTotal,
            'booking_deposit_amount' => (float) ($summaryRow->booking_deposit_amount ?? 0),
            'booking_settlement_amount' => (float) ($summaryRow->booking_settlement_amount ?? 0),
            'addon_revenue' => (float) ($summaryRow->addon_revenue ?? 0),
            'package_purchase_amount' => (float) ($summaryRow->package_purchase_amount ?? 0),
            'booking_product_amount' => (float) ($summaryRow->booking_product_amount ?? 0),
        ];

        return [
            'summary' => [
                'total_booking_revenue' => (float) ($summaryRow->total_booking_revenue ?? 0),
                'online_booking_revenue' => (float) ($summaryRow->online_booking_revenue ?? 0),
                'offline_booking_revenue' => (float) ($summaryRow->offline_booking_revenue ?? 0),
                'total_transactions' => (int) ($summaryRow->total_transactions ?? 0),
                'booking_deposit_amount' => (float) ($summaryRow->booking_deposit_amount ?? 0),
                'booking_settlement_amount' => (float) ($summaryRow->booking_settlement_amount ?? 0),
                'addon_revenue' => (float) ($summaryRow->addon_revenue ?? 0),
                'package_purchase_amount' => (float) ($summaryRow->package_purchase_amount ?? 0),
                'booking_product_amount' => (float) ($summaryRow->booking_product_amount ?? 0),
            ],
            'totals_page' => $totalsPage,
            'grand_totals' => $grandTotals,
            'rows' => $rows,
            'pagination' => [
                'total' => $paginator->total(),
                'per_page' => $paginator->perPage(),
                'current_page' => $paginator->currentPage(),
                'last_page' => $paginator->lastPage(),
            ],
        ];
    }

    public function bookingRows(Carbon $start, Carbon $end, array $filters = [])
    {
        $channel = $this->normalizeChannel((string) ($filters['channel'] ?? self::CHANNEL_ALL));
        $type = $this->normalizeBookingType((string) ($filters['type'] ?? self::BOOKING_TYPE_ALL));
        $paymentMethod = $this->nullableString($filters['payment_method'] ?? null);
        $customerId = $this->nullableInt($filters['customer_id'] ?? null);

        return $this->baseBookingRowsQuery($start, $end, $channel, $paymentMethod, $type, $customerId)
            ->orderByDesc('order_datetime')
            ->cursor()
            ->map(function ($row) {
                return [
                    'order_id' => (int) $row->order_id,
                    'order_no' => (string) $row->order_no,
                    'date_time' => (string) $row->order_datetime,
                    'customer' => $this->formatCustomerDisplayName(
                    $row->customer_name ?? null,
                    $row->shipping_name ?? null,
                    $row->billing_name ?? null,
                    $row->booking_guest_name ?? null,
                ),
                    'channel' => (string) $row->channel,
                    'payment_method' => (string) ($row->payment_method ?: 'unknown'),
                    'type' => (string) $row->type,
                    'booking_id' => $row->booking_id ? (int) $row->booking_id : null,
                    'booking_no' => $row->booking_no,
                    'package_name' => $row->package_name,
                    'package_cn_name' => null,
                    'gross_amount' => (float) $row->gross_amount,
                    'discount' => (float) $row->discount,
                    'net_amount' => (float) $row->net_amount,
                    'status' => (string) $row->status,
                ];
            });
    }

    private function collectedOrderItemNetAmountSql(string $alias = 'oi'): string
    {
        return "COALESCE({$alias}.line_total_after_discount, {$alias}.effective_line_total, {$alias}.line_total - COALESCE({$alias}.discount_amount, 0))";
    }

    private function baseEcommerceRowsQuery(
        Carbon $start,
        Carbon $end,
        string $channel,
        ?string $paymentMethod,
        ?string $status,
        ?int $customerId = null
    ) {
        $query = $this->applyOrderScope(
            DB::table('orders as o')
                ->join('order_items as oi', 'oi.order_id', '=', 'o.id')
                ->leftJoin('customers as c', 'c.id', '=', 'o.customer_id')
                ->whereBetween(DB::raw($this->orderBillAtSql()), [$start, $end])
        )
            ->where('oi.line_type', 'product')
            ->groupBy('o.id', 'o.order_number', 'c.name', 'o.shipping_name', 'o.billing_name', 'channel', 'o.payment_method', 'o.status', 'o.grand_total', DB::raw($this->orderBillAtSql()))
            ->selectRaw('o.id as order_id')
            ->selectRaw('o.order_number as order_no')
            ->selectRaw($this->orderBillAtSql() . ' as order_datetime')
            ->selectRaw('c.name as customer_name')
            ->selectRaw('o.shipping_name as shipping_name')
            ->selectRaw('o.billing_name as billing_name')
            ->selectRaw("CASE WHEN o.created_by_user_id IS NULL THEN 'online' ELSE 'offline' END as channel")
            ->selectRaw('o.payment_method')
            ->selectRaw('o.grand_total as order_total')
            ->selectRaw('o.status')
            ->selectRaw('COALESCE(SUM(oi.quantity), 0) as item_count')
            ->selectRaw('COALESCE(SUM(oi.line_total), 0) as product_amount')
            ->selectRaw('COALESCE(SUM(oi.discount_amount), 0) as discount')
            ->selectRaw('COALESCE(SUM(COALESCE(oi.line_total_after_discount, oi.effective_line_total, oi.line_total - COALESCE(oi.discount_amount, 0))), 0) as net_amount');

        if ($channel === self::CHANNEL_ONLINE) {
            $query->whereNull('o.created_by_user_id');
        }
        if ($channel === self::CHANNEL_OFFLINE) {
            $query->whereNotNull('o.created_by_user_id');
        }
        if ($paymentMethod !== null) {
            $query->whereIn('o.payment_method', SalesReportService::paymentMethodVariantsForMatch($paymentMethod));
        }
        if ($status !== null) {
            $query->where('o.status', $status);
        }
        if ($customerId !== null) {
            $query->where('o.customer_id', $customerId);
        }

        return DB::query()->fromSub($query, 'rows');
    }

    private function baseBookingRowsQuery(
        Carbon $start,
        Carbon $end,
        string $channel,
        ?string $paymentMethod,
        string $type,
        ?int $customerId = null
    ) {
        $query = $this->applyOrderScope(
            DB::table('orders as o')
                ->join('order_items as oi', 'oi.order_id', '=', 'o.id')
                ->leftJoin('customers as c', 'c.id', '=', 'o.customer_id')
                ->leftJoin('bookings as b', 'b.id', '=', 'oi.booking_id')
                ->leftJoin('service_packages as sp', 'sp.id', '=', 'oi.service_package_id')
                ->whereBetween(DB::raw($this->orderBillAtSql()), [$start, $end])
        )
            ->whereIn('oi.line_type', self::BOOKING_LINE_TYPES)
            ->selectRaw('o.id as order_id')
            ->selectRaw('o.order_number as order_no')
            ->selectRaw($this->orderBillAtSql() . ' as order_datetime')
            ->selectRaw('c.name as customer_name')
            ->selectRaw('o.shipping_name as shipping_name')
            ->selectRaw('o.billing_name as billing_name')
            ->selectRaw('b.guest_name as booking_guest_name')
            ->selectRaw("CASE WHEN o.created_by_user_id IS NULL THEN 'online' ELSE 'offline' END as channel")
            ->selectRaw('o.payment_method')
            ->selectRaw('o.grand_total as order_total')
            ->selectRaw('o.status')
            ->selectRaw('oi.id AS order_item_id')
            ->selectRaw("CASE oi.line_type WHEN 'booking_deposit' THEN 'deposit' WHEN 'booking_settlement' THEN 'final_settlement' WHEN 'booking_addon' THEN 'addon' WHEN 'booking_product' THEN 'booking_product' ELSE 'package_purchase' END as type")
            ->selectRaw('oi.booking_id as booking_id')
            ->selectRaw('COALESCE(b.booking_code, CASE WHEN oi.booking_id IS NOT NULL THEN CONCAT(\'BOOKING-\', oi.booking_id) ELSE NULL END) as booking_no')
            ->selectRaw('COALESCE(oi.display_name_snapshot, oi.product_name_snapshot, sp.name) as package_name')
            ->selectRaw('COALESCE(oi.line_total_snapshot, oi.line_total + COALESCE(oi.discount_amount, 0), oi.line_total, 0) as gross_amount')
            ->selectRaw('COALESCE(oi.discount_amount, 0) as discount')
            ->selectRaw('COALESCE(oi.line_total_after_discount, oi.effective_line_total, oi.line_total - COALESCE(oi.discount_amount, 0), 0) as net_amount');

        if ($channel === self::CHANNEL_ONLINE) {
            $query->whereNull('o.created_by_user_id');
        }
        if ($channel === self::CHANNEL_OFFLINE) {
            $query->whereNotNull('o.created_by_user_id');
        }
        if ($paymentMethod !== null) {
            $query->whereIn('o.payment_method', SalesReportService::paymentMethodVariantsForMatch($paymentMethod));
        }
        if ($type !== self::BOOKING_TYPE_ALL) {
            $lineType = match ($type) {
                self::BOOKING_TYPE_DEPOSIT => 'booking_deposit',
                self::BOOKING_TYPE_FINAL_SETTLEMENT => 'booking_settlement',
                self::BOOKING_TYPE_ADDON => 'booking_addon',
                self::BOOKING_TYPE_PACKAGE_PURCHASE => 'service_package',
                self::BOOKING_TYPE_PRODUCT => 'booking_product',
                default => null,
            };
            if ($lineType !== null) {
                $query->where('oi.line_type', $lineType);
            }
        }
        if ($customerId !== null) {
            $query->where('o.customer_id', $customerId);
        }

        return DB::query()->fromSub($query, 'rows');
    }

    private function bookingRefundReportRows(
        Carbon $start,
        Carbon $end,
        string $channel,
        ?string $paymentMethod,
        ?int $customerId = null,
    ) {
        $query = DB::table('booking_refunds as br')
            ->join('bookings as b', 'b.id', '=', 'br.booking_id')
            ->leftJoin('customers as c', 'c.id', '=', 'b.customer_id')
            ->whereNull('br.return_request_id')
            ->where('br.status', 'completed')
            ->whereBetween(DB::raw('COALESCE(br.processed_at, br.created_at)'), [$start, $end]);

        if ($channel === self::CHANNEL_ONLINE) {
            $query->where('br.channel', 'online');
        }
        if ($channel === self::CHANNEL_OFFLINE) {
            $query->where('br.channel', 'offline');
        }
        if ($paymentMethod !== null) {
            $query->where('br.method', $paymentMethod);
        }
        if ($customerId !== null) {
            $query->where('b.customer_id', $customerId);
        }

        $methodLabels = [
            'cash' => 'Cash Refund',
            'customer_credit' => 'Customer Credit',
        ];

        return $query
            ->orderByDesc(DB::raw('COALESCE(br.processed_at, br.created_at)'))
            ->get([
                'br.id as refund_id',
                'br.refund_no',
                'br.amount',
                'br.method',
                'br.channel',
                'br.processed_at',
                'br.created_at',
                'b.id as booking_id',
                'b.booking_code',
                'b.guest_name',
                'c.name as customer_name',
            ])
            ->map(function ($row) use ($methodLabels) {
                $amount = round((float) ($row->amount ?? 0), 2);
                $method = (string) ($row->method ?? 'cash');
                $processedAt = (string) ($row->processed_at ?? $row->created_at ?? '');

                return [
                    'order_id' => 0,
                    'order_no' => (string) ($row->refund_no ?? ''),
                    'order_datetime' => $processedAt,
                    'customer' => $this->formatCustomerDisplayName(
                        $row->customer_name ?? null,
                        null,
                        null,
                        $row->guest_name ?? null,
                    ),
                    'channel' => (string) (($row->channel ?? 'offline') === 'online' ? 'online' : 'offline'),
                    'payment_method' => $method,
                    'payments' => [],
                    'order_total' => -$amount,
                    'type' => self::BOOKING_TYPE_REFUND,
                    'booking_id' => $row->booking_id ? (int) $row->booking_id : null,
                    'booking_no' => $row->booking_code ? (string) $row->booking_code : null,
                    'package_name' => $methodLabels[$method] ?? ucfirst(str_replace('_', ' ', $method)),
                    'package_cn_name' => null,
                    'package_applied' => false,
                    'applied_package_name' => null,
                    'gross_amount' => $amount,
                    'discount' => 0.0,
                    'net_amount' => -$amount,
                    'status' => 'completed',
                    'is_refund' => true,
                    'refund_id' => (int) ($row->refund_id ?? 0),
                    'receipt_public_url' => $this->resolveRefundReceiptPublicUrl((int) ($row->refund_id ?? 0)),
                ];
            });
    }

    private function ecommerceRefundReportRows(
        Carbon $start,
        Carbon $end,
        string $channel,
        ?string $paymentMethod,
        ?int $customerId = null,
    ) {
        $query = DB::table('booking_refunds as br')
            ->join('return_requests as rr', 'rr.id', '=', 'br.return_request_id')
            ->join('orders as o', 'o.id', '=', 'br.order_id')
            ->leftJoin('customers as c', 'c.id', '=', 'o.customer_id')
            ->whereNotNull('br.return_request_id')
            ->where('br.status', 'completed')
            ->whereBetween(DB::raw('COALESCE(br.processed_at, br.created_at)'), [$start, $end]);

        if ($channel === self::CHANNEL_ONLINE) {
            $query->where('br.channel', 'online');
        }
        if ($channel === self::CHANNEL_OFFLINE) {
            $query->where('br.channel', 'offline');
        }
        if ($paymentMethod !== null) {
            $query->where('br.method', $paymentMethod);
        }
        if ($customerId !== null) {
            $query->where('o.customer_id', $customerId);
        }

        $methodLabels = [
            'cash' => 'Cash Refund',
            'customer_credit' => 'Customer Credit',
        ];

        return $query
            ->orderByDesc(DB::raw('COALESCE(br.processed_at, br.created_at)'))
            ->get([
                'br.id as refund_id',
                'br.refund_no',
                'br.amount',
                'br.method',
                'br.channel',
                'br.processed_at',
                'br.created_at',
                'o.order_number',
                'o.shipping_name',
                'o.billing_name',
                'c.name as customer_name',
            ])
            ->map(function ($row) use ($methodLabels) {
                $amount = round((float) ($row->amount ?? 0), 2);
                $method = (string) ($row->method ?? 'cash');
                $processedAt = (string) ($row->processed_at ?? $row->created_at ?? '');

                return [
                    'order_id' => 0,
                    'order_no' => (string) ($row->refund_no ?? ''),
                    'order_datetime' => $processedAt,
                    'customer' => $this->formatCustomerDisplayName(
                        $row->customer_name ?? null,
                        $row->shipping_name ?? null,
                        $row->billing_name ?? null,
                        null,
                    ),
                    'channel' => (string) (($row->channel ?? 'online') === 'online' ? 'online' : 'offline'),
                    'payment_method' => $method,
                    'payments' => [],
                    'order_total' => -$amount,
                    'item_count' => 0,
                    'product_amount' => $amount,
                    'discount' => 0.0,
                    'net_amount' => -$amount,
                    'status' => 'refunded',
                    'is_refund' => true,
                    'refund_id' => (int) ($row->refund_id ?? 0),
                    'related_order_no' => (string) ($row->order_number ?? ''),
                    'refund_label' => $methodLabels[$method] ?? ucfirst(str_replace('_', ' ', $method)),
                    'receipt_public_url' => $this->resolveRefundReceiptPublicUrl((int) ($row->refund_id ?? 0)),
                ];
            });
    }

    private function resolveRefundReceiptPublicUrl(int $refundId): ?string
    {
        if ($refundId <= 0) {
            return null;
        }

        $receiptToken = BookingRefundReceiptToken::query()
            ->where('booking_refund_id', $refundId)
            ->latest('id')
            ->first();

        if (! $receiptToken) {
            $receiptToken = BookingRefundReceiptToken::create([
                'booking_refund_id' => $refundId,
                'token' => Str::random(64),
                'expires_at' => null,
            ]);
        }

        $frontendUrl = rtrim((string) config('services.frontend_url', config('app.url')), '/');

        return $frontendUrl . '/api/proxy/public/refund-receipt/' . $receiptToken->token . '/invoice';
    }


    private function paymentRowsByOrderIds(array $orderIds)
    {
        $ids = collect($orderIds)
            ->map(fn ($id) => (int) $id)
            ->filter(fn (int $id) => $id > 0)
            ->unique()
            ->values()
            ->all();

        if ($ids === []) {
            return collect();
        }

        return DB::table('order_payments')
            ->whereIn('order_id', $ids)
            ->orderBy('id')
            ->get(['order_id', 'payment_method', 'amount', 'reference_no'])
            ->groupBy(fn ($row) => (int) $row->order_id)
            ->map(fn ($rows) => $rows->map(fn ($row) => [
                'method' => (string) $row->payment_method,
                'amount' => (float) $row->amount,
                'reference_no' => $row->reference_no,
            ])->values()->all());
    }

    private function resolveOrderItemCnNames(array $ids)
    {
        $itemIds = collect($ids)
            ->map(fn ($id) => (int) $id)
            ->filter(fn (int $id) => $id > 0)
            ->unique()
            ->values()
            ->all();

        if ($itemIds === []) {
            return collect();
        }

        return OrderItem::query()
            ->with(['bookingService:id,cn_name', 'booking:id,addon_items_json'])
            ->whereIn('id', $itemIds)
            ->get()
            ->mapWithKeys(fn (OrderItem $item) => [(int) $item->id => $item->displayCnName()]);
    }

    private function nullableInt(mixed $value): ?int
    {
        if ($value === null) return null;
        if (is_int($value)) return $value > 0 ? $value : null;
        if (is_numeric($value)) {
            $i = (int) $value;
            return $i > 0 ? $i : null;
        }
        $s = is_string($value) ? trim($value) : '';
        if ($s === '' || strtolower($s) === 'all') return null;
        $i = (int) $s;
        return $i > 0 ? $i : null;
    }

    private function normalizeChannel(string $channel): string
    {
        return match (strtolower(trim($channel))) {
            self::CHANNEL_ONLINE => self::CHANNEL_ONLINE,
            self::CHANNEL_OFFLINE => self::CHANNEL_OFFLINE,
            default => self::CHANNEL_ALL,
        };
    }

    private function normalizeBookingType(string $type): string
    {
        return match (strtolower(trim($type))) {
            self::BOOKING_TYPE_DEPOSIT => self::BOOKING_TYPE_DEPOSIT,
            self::BOOKING_TYPE_FINAL_SETTLEMENT => self::BOOKING_TYPE_FINAL_SETTLEMENT,
            self::BOOKING_TYPE_ADDON => self::BOOKING_TYPE_ADDON,
            self::BOOKING_TYPE_PACKAGE_PURCHASE => self::BOOKING_TYPE_PACKAGE_PURCHASE,
            self::BOOKING_TYPE_PRODUCT => self::BOOKING_TYPE_PRODUCT,
            'refund' => self::BOOKING_TYPE_REFUND,
            default => self::BOOKING_TYPE_ALL,
        };
    }

    private function nullableString(mixed $value): ?string
    {
        $string = is_string($value) ? trim($value) : '';

        return $string === '' ? null : $string;
    }

    private function aggregateEcommerceTotals($rows): array
    {
        return [
            'orders_count' => (int) $rows->count(),
            'product_amount' => (float) $rows->sum('product_amount'),
            'discount' => (float) $rows->sum('discount'),
            'net_amount' => (float) $rows->sum('net_amount'),
        ];
    }

    private function aggregateBookingTotals($rows): array
    {
        return [
            'orders_count' => (int) $rows->count(),
            'gross_amount' => (float) $rows->sum('gross_amount'),
            'discount' => (float) $rows->sum('discount'),
            'net_amount' => (float) $rows->sum('net_amount'),
            'booking_deposit_amount' => (float) $rows->filter(fn ($row) => ($row['type'] ?? '') === self::BOOKING_TYPE_DEPOSIT)->sum('net_amount'),
            'booking_settlement_amount' => (float) $rows->filter(fn ($row) => ($row['type'] ?? '') === self::BOOKING_TYPE_FINAL_SETTLEMENT)->sum('net_amount'),
            'addon_revenue' => (float) $rows->filter(fn ($row) => ($row['type'] ?? '') === self::BOOKING_TYPE_ADDON)->sum('net_amount'),
            'package_purchase_amount' => (float) $rows->filter(fn ($row) => ($row['type'] ?? '') === self::BOOKING_TYPE_PACKAGE_PURCHASE)->sum('net_amount'),
            'booking_product_amount' => (float) $rows->filter(fn ($row) => ($row['type'] ?? '') === self::BOOKING_TYPE_PRODUCT)->sum('net_amount'),
        ];
    }

    private function resolveReceiptPublicUrl(Order $order): ?string
    {
        $existingToken = OrderReceiptToken::query()
            ->where('order_id', $order->id)
            ->latest('id')
            ->first();

        if (! $existingToken) {
            $existingToken = OrderReceiptToken::create([
                'order_id' => $order->id,
                'token' => Str::random(64),
                'expires_at' => null,
            ]);
        }

        $frontendUrl = rtrim((string) config('services.frontend_url', config('app.url')), '/');

        return $frontendUrl . '/api/proxy/public/receipt/' . $existingToken->token . '/invoice';
    }

    private function resolveOrderCustomerDisplayName(Order $order): string
    {
        return $this->formatCustomerDisplayName(
            $order->customer?->name,
            $order->shipping_name,
            $order->billing_name,
            $this->resolveBookingGuestDisplayName($order),
        );
    }

    private function resolveBookingGuestDisplayName(Order $order): ?string
    {
        foreach ($order->items ?? [] as $item) {
            $guest = trim((string) ($item->booking?->guest_name ?? ''));
            if ($guest !== '' && strtoupper($guest) !== 'UNKNOWN') {
                return $guest;
            }
        }

        return null;
    }

    private function formatCustomerDisplayName(
        ?string $memberName,
        ?string $shippingName,
        ?string $billingName,
        ?string $bookingGuestName,
    ): string {
        $member = trim((string) ($memberName ?? ''));
        if ($member !== '') {
            return $member;
        }

        $shipping = trim((string) ($shippingName ?? ''));
        if ($shipping !== '') {
            return $shipping;
        }

        $billing = trim((string) ($billingName ?? ''));
        if ($billing !== '' && ! $this->isPosWalkInPlaceholderName($billing)) {
            return $billing;
        }

        $guest = trim((string) ($bookingGuestName ?? ''));
        if ($guest !== '' && strtoupper($guest) !== 'UNKNOWN') {
            return $guest;
        }

        return 'Walk-in Customer';
    }

    private function isPosWalkInPlaceholderName(string $name): bool
    {
        $normalized = strtoupper(trim($name));
        if ($normalized === '' || $normalized === '-') {
            return true;
        }

        $walkInName = strtoupper(trim((string) data_get(
            SettingService::get('ecommerce.invoice_profile', []),
            'pos_walk_in_bill_to.name',
            'UNKNOWN'
        )));

        if ($walkInName !== '' && $normalized === $walkInName) {
            return true;
        }

        return in_array($normalized, ['UNKNOWN', 'LOYALTY TESTER'], true);
    }

    private function resolveReceiptCustomerEmail(Order $order): ?string
    {
        $customerEmail = trim((string) ($order->customer?->email ?? ''));
        if ($customerEmail !== '' && filter_var($customerEmail, FILTER_VALIDATE_EMAIL)) {
            return $customerEmail;
        }

        $guestEmail = $order->items
            ->map(fn (OrderItem $item) => trim((string) ($item->booking?->guest_email ?? '')))
            ->filter(fn (string $email) => $email !== '' && filter_var($email, FILTER_VALIDATE_EMAIL))
            ->first();

        return is_string($guestEmail) && $guestEmail !== '' ? $guestEmail : null;
    }
}
