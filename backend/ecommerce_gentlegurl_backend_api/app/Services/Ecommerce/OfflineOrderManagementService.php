<?php

namespace App\Services\Ecommerce;

use App\Http\Controllers\Ecommerce\PosController;
use App\Models\Booking\Booking;
use App\Models\Booking\BookingPayment;
use App\Models\Booking\CustomerServicePackage;
use App\Models\Booking\CustomerServicePackageUsage;
use App\Models\Ecommerce\Order;
use App\Models\Ecommerce\OrderActionLog;
use App\Models\Staff;
use App\Services\Booking\StaffCommissionService;
use Carbon\Carbon;
use Illuminate\Support\Facades\DB;
use RuntimeException;

class OfflineOrderManagementService
{
    private const ALLOWED_VOID_STATUSES = ['paid', 'completed', 'confirmed', 'packed', 'shipped', 'ready_for_pickup'];

    public function __construct(private StaffCommissionService $staffCommissionService)
    {
    }

    public function getSalesPersonDraft(Order $order): array
    {
        $this->ensureOfflineOrder($order);

        $items = DB::table('order_items as oi')
            ->where('oi.order_id', (int) $order->id)
            ->orderBy('oi.id')
            ->get([
                'oi.id',
                'oi.line_type',
                'oi.product_name_snapshot',
                'oi.display_name_snapshot',
                'oi.customer_service_package_id',
                'oi.quantity',
                'oi.effective_unit_price',
                'oi.unit_price_snapshot',
                'oi.price_snapshot',
                'oi.effective_line_total',
                'oi.line_total_after_discount',
                'oi.line_total',
                'oi.selected_booking_product_options',
            ]);

        $orderItemIds = $items->pluck('id')->map(fn ($v) => (int) $v)->all();
        $cspIds = $items->pluck('customer_service_package_id')->filter()->map(fn ($v) => (int) $v)->all();

        $productSplits = DB::table('order_item_staff_splits as split')
            ->leftJoin('staffs', 'staffs.id', '=', 'split.staff_id')
            ->whereIn('split.order_item_id', $orderItemIds)
            ->orderBy('split.id')
            ->get([
                'split.order_item_id',
                'split.line_type',
                'split.line_ref_id',
                'split.staff_id',
                'split.share_percent',
                'split.amount_basis',
                'staffs.name as staff_name',
            ])
            ->groupBy('order_item_id');

        $packageSplits = empty($cspIds)
            ? collect()
            : DB::table('service_package_staff_splits as split')
                ->leftJoin('staffs', 'staffs.id', '=', 'split.staff_id')
                ->whereIn('split.customer_service_package_id', $cspIds)
                ->orderBy('split.id')
                ->get([
                    'split.customer_service_package_id',
                    'split.staff_id',
                    'split.share_percent',
                    'staffs.name as staff_name',
                ])
                ->groupBy('customer_service_package_id');

        return $items->flatMap(function ($item) use ($productSplits, $packageSplits) {
            $lineType = (string) ($item->line_type ?? '');
            if ($lineType === 'booking_product') {
                return $this->mapBookingProductSalesPersonDraftRows(
                    $item,
                    $productSplits->get((int) $item->id) ?? collect(),
                );
            }

            $isPackage = $lineType === 'service_package' && $item->customer_service_package_id;
            $splitRows = $isPackage
                ? ($packageSplits->get((int) $item->customer_service_package_id) ?? collect())
                : ($productSplits->get((int) $item->id) ?? collect());

            $itemType = $isPackage ? 'service_package' : ($lineType !== '' ? $lineType : 'product');
            $orderItemId = (int) $item->id;

            return [[
                'draft_key' => (string) $orderItemId,
                'order_item_id' => $orderItemId,
                'item_type' => $itemType,
                'line_ref_id' => null,
                'name' => (string) ($item->display_name_snapshot ?: $item->product_name_snapshot ?: 'Item'),
                'qty' => (int) ($item->quantity ?? 0),
                'unit_amount' => (float) ($item->effective_unit_price ?? $item->unit_price_snapshot ?? $item->price_snapshot ?? 0),
                'line_total' => (float) ($item->effective_line_total ?? $item->line_total_after_discount ?? $item->line_total ?? 0),
                'customer_service_package_id' => $item->customer_service_package_id ? (int) $item->customer_service_package_id : null,
                'splits' => $this->mapSplitRowsForDraft($splitRows),
            ]];
        })->values()->all();
    }

    /**
     * Expand a booking_product order item into base + each selected option (add-on),
     * so Edit Sales Person can assign staff per line like Final Settlement + Add-Ons.
     *
     * @param  \Illuminate\Support\Collection<int, object>  $splitRows
     * @return array<int, array<string, mixed>>
     */
    private function mapBookingProductSalesPersonDraftRows(object $item, $splitRows): array
    {
        $orderItemId = (int) $item->id;
        $qty = max(1, (int) ($item->quantity ?? 1));
        $lineTotal = (float) ($item->effective_line_total ?? $item->line_total_after_discount ?? $item->line_total ?? 0);
        $productName = (string) ($item->display_name_snapshot ?: $item->product_name_snapshot ?: 'Booking Product');
        $options = $this->decodeBookingProductOptions($item->selected_booking_product_options ?? null);

        if ($options === []) {
            return [[
                'draft_key' => (string) $orderItemId,
                'order_item_id' => $orderItemId,
                'item_type' => 'booking_product',
                'line_ref_id' => null,
                'name' => $productName,
                'qty' => $qty,
                'unit_amount' => (float) ($item->effective_unit_price ?? $item->unit_price_snapshot ?? $item->price_snapshot ?? 0),
                'line_total' => $lineTotal,
                'customer_service_package_id' => null,
                'splits' => $this->mapSplitRowsForDraft($splitRows),
            ]];
        }

        $optionDrafts = [];
        $optionTotal = 0.0;
        foreach ($options as $option) {
            $optionId = (string) ($option['id'] ?? $option['option_id'] ?? '');
            if ($optionId === '') {
                continue;
            }
            $unitPrice = (float) ($option['extra_price'] ?? $option['unit_price'] ?? 0);
            $optionAmount = isset($option['line_total_after_discount'])
                ? (float) $option['line_total_after_discount']
                : (isset($option['line_total_override'])
                    ? (float) $option['line_total_override']
                    : round($unitPrice * $qty, 2));
            $optionTotal = round($optionTotal + $optionAmount, 2);
            $matchedSplits = $splitRows
                ->filter(fn ($split) => (string) ($split->line_type ?? '') === 'booking_product_option'
                    && (string) ($split->line_ref_id ?? '') === $optionId)
                ->values();
            if ($matchedSplits->isEmpty() && is_array($option['staff_splits'] ?? null)) {
                $matchedSplits = collect($option['staff_splits'])->map(fn ($row) => (object) [
                    'staff_id' => (int) ($row['staff_id'] ?? 0),
                    'share_percent' => (int) ($row['share_percent'] ?? 0),
                    'staff_name' => (string) ($row['staff_name'] ?? $row['name'] ?? ''),
                ]);
            }
            $optionName = (string) ($option['label'] ?? $option['name'] ?? $option['option_name'] ?? 'Add-on');

            $optionDrafts[] = [
                'draft_key' => "{$orderItemId}:booking_product_option:{$optionId}",
                'order_item_id' => $orderItemId,
                'item_type' => 'booking_product_option',
                'line_ref_id' => $optionId,
                'name' => $optionName,
                'qty' => $qty,
                'unit_amount' => $unitPrice,
                'line_total' => $optionAmount,
                'customer_service_package_id' => null,
                'splits' => $this->mapSplitRowsForDraft($matchedSplits),
            ];
        }

        $baseAmount = round(max(0, $lineTotal - $optionTotal), 2);
        $baseSplits = $splitRows
            ->filter(function ($split) {
                $type = (string) ($split->line_type ?? '');

                return $type === 'booking_product_base' || $type === '' || $type === 'booking_product';
            })
            ->values();
        $baseRefId = (string) ($baseSplits->first()->line_ref_id ?? $orderItemId);

        return array_values(array_merge([[
            'draft_key' => "{$orderItemId}:booking_product_base:{$baseRefId}",
            'order_item_id' => $orderItemId,
            'item_type' => 'booking_product_base',
            'line_ref_id' => $baseRefId,
            'name' => $productName,
            'qty' => $qty,
            'unit_amount' => round($baseAmount / $qty, 2),
            'line_total' => $baseAmount,
            'customer_service_package_id' => null,
            'splits' => $this->mapSplitRowsForDraft($baseSplits),
        ]], $optionDrafts));
    }

    /**
     * @param  mixed  $raw
     * @return array<int, array<string, mixed>>
     */
    private function decodeBookingProductOptions($raw): array
    {
        if (is_string($raw) && trim($raw) !== '') {
            $decoded = json_decode($raw, true);
            $raw = is_array($decoded) ? $decoded : [];
        }
        if (! is_array($raw)) {
            return [];
        }

        $options = [];
        foreach ($raw as $question) {
            if (! is_array($question)) {
                continue;
            }
            foreach ((array) ($question['options'] ?? []) as $option) {
                if (is_array($option)) {
                    $options[] = $option;
                }
            }
        }

        return $options;
    }

    /**
     * @param  \Illuminate\Support\Collection<int, object>  $splitRows
     * @return array<int, array{staff_id:int, staff_name:string, share_percent:int}>
     */
    private function mapSplitRowsForDraft($splitRows): array
    {
        return collect($splitRows)->map(fn ($split) => [
            'staff_id' => (int) ($split->staff_id ?? 0),
            'staff_name' => (string) ($split->staff_name ?? ''),
            'share_percent' => (int) ($split->share_percent ?? 0),
        ])->filter(fn (array $row) => $row['staff_id'] > 0)->values()->all();
    }

    public function getBookingWorkerDraft(Order $order): array
    {
        $this->ensureOfflineOrder($order);

        $items = DB::table('order_items as oi')
            ->leftJoin('bookings as b', 'b.id', '=', 'oi.booking_id')
            ->where('oi.order_id', (int) $order->id)
            ->where('oi.line_type', 'booking_settlement')
            ->orderBy('oi.id')
            ->get([
                'oi.id',
                'oi.booking_id',
                'oi.line_type',
                'oi.product_name_snapshot',
                'oi.display_name_snapshot',
                'oi.quantity',
                'oi.effective_unit_price',
                'oi.unit_price_snapshot',
                'oi.price_snapshot',
                'oi.effective_line_total',
                'oi.line_total_after_discount',
                'oi.line_total',
                'b.booking_code',
                'b.staff_id as booking_staff_id',
            ]);

        if ($items->isEmpty()) {
            return [];
        }

        $bookingIds = $items->pluck('booking_id')->filter()->map(fn ($v) => (int) $v)->unique()->values()->all();
        $splitsByBooking = DB::table('booking_service_staff_splits as split')
            ->leftJoin('staffs', 'staffs.id', '=', 'split.staff_id')
            ->whereIn('split.booking_id', $bookingIds)
            ->orderBy('split.id')
            ->get([
                'split.booking_id',
                'split.staff_id',
                'split.split_percent',
                'staffs.name as staff_name',
            ])
            ->groupBy('booking_id');

        $fallbackStaffIds = $items
            ->pluck('booking_staff_id')
            ->filter(fn ($id) => (int) $id > 0)
            ->map(fn ($id) => (int) $id)
            ->unique()
            ->values()
            ->all();
        $fallbackStaffMap = empty($fallbackStaffIds)
            ? collect()
            : DB::table('staffs')->whereIn('id', $fallbackStaffIds)->pluck('name', 'id');

        return $items->map(function ($item) use ($splitsByBooking, $fallbackStaffMap) {
            $splitRows = ($splitsByBooking->get((int) ($item->booking_id ?? 0)) ?? collect())
                ->map(fn ($split) => [
                    'staff_id' => (int) ($split->staff_id ?? 0),
                    'staff_name' => (string) ($split->staff_name ?? ''),
                    'share_percent' => (int) ($split->split_percent ?? 0),
                ])
                ->filter(fn (array $split) => $split['staff_id'] > 0 && $split['share_percent'] > 0)
                ->values();

            if ($splitRows->isEmpty() && (int) ($item->booking_staff_id ?? 0) > 0) {
                $fallbackId = (int) $item->booking_staff_id;
                $splitRows = collect([[
                    'staff_id' => $fallbackId,
                    'staff_name' => (string) ($fallbackStaffMap->get($fallbackId) ?? ''),
                    'share_percent' => 100,
                ]]);
            }

            return [
                'order_item_id' => (int) $item->id,
                'item_type' => 'booking_settlement',
                'booking_id' => $item->booking_id ? (int) $item->booking_id : null,
                'booking_code' => $item->booking_code ? (string) $item->booking_code : null,
                'name' => (string) ($item->display_name_snapshot ?: $item->product_name_snapshot ?: 'Final Settlement'),
                'qty' => (int) ($item->quantity ?? 0),
                'unit_amount' => (float) ($item->effective_unit_price ?? $item->unit_price_snapshot ?? $item->price_snapshot ?? 0),
                'line_total' => (float) ($item->effective_line_total ?? $item->line_total_after_discount ?? $item->line_total ?? 0),
                'splits' => $splitRows->all(),
            ];
        })->values()->all();
    }

    public function updateSalesPerson(Order $order, array $itemSplits, ?string $remark, ?int $actorId): Order
    {
        $this->ensureOfflineOrder($order);
        if (empty($itemSplits)) {
            throw new RuntimeException('At least one item split is required.');
        }

        $bookingTargets = [];
        $needsEcommerceRecalc = false;
        $orderAt = $order->created_at instanceof Carbon
            ? $order->created_at
            : Carbon::parse((string) $order->created_at);
        $orderYear = (int) $orderAt->format('Y');
        $orderMonth = (int) $orderAt->format('m');

        DB::transaction(function () use (
            $order,
            $itemSplits,
            $remark,
            $actorId,
            $orderYear,
            $orderMonth,
            &$bookingTargets,
            &$needsEcommerceRecalc,
        ) {
            $orderItems = DB::table('order_items')
                ->where('order_id', (int) $order->id)
                ->get([
                    'id',
                    'line_type',
                    'line_total',
                    'line_total_after_discount',
                    'effective_line_total',
                    'customer_service_package_id',
                    'service_package_id',
                    'selected_booking_product_options',
                    'quantity',
                ])->keyBy('id');

            $staffs = Staff::query()->get(['id', 'commission_rate', 'service_commission_rate'])->keyBy('id');

            foreach ($itemSplits as $itemSplit) {
                $orderItemId = (int) ($itemSplit['order_item_id'] ?? 0);
                $orderItem = $orderItems->get($orderItemId);
                if (! $orderItem) {
                    throw new RuntimeException("Order item {$orderItemId} not found.");
                }

                $splits = collect($itemSplit['splits'] ?? []);
                $sum = (int) $splits->sum(fn (array $row) => (int) ($row['share_percent'] ?? 0));
                $unique = $splits->pluck('staff_id')->map(fn ($id) => (int) $id)->unique()->count();
                if (! $splits->isEmpty() && ($sum !== 100 || $unique !== $splits->count())) {
                    throw new RuntimeException('Invalid staff split. Total must be 100% and staffs must be unique.');
                }

                $splitLineType = (string) ($itemSplit['item_type'] ?? $itemSplit['split_line_type'] ?? '');
                $lineRefId = array_key_exists('line_ref_id', $itemSplit) && $itemSplit['line_ref_id'] !== null && $itemSplit['line_ref_id'] !== ''
                    ? (string) $itemSplit['line_ref_id']
                    : null;
                $isBookingProductLine = (string) $orderItem->line_type === 'booking_product'
                    && in_array($splitLineType, ['booking_product_base', 'booking_product_option'], true);

                $before = (string) $orderItem->line_type === 'service_package' && $orderItem->customer_service_package_id
                    ? DB::table('service_package_staff_splits')
                        ->where('customer_service_package_id', (int) $orderItem->customer_service_package_id)
                        ->get(['staff_id', 'share_percent', 'service_commission_rate_snapshot', 'split_sales_amount'])
                        ->map(fn ($row) => (array) $row)
                        ->values()
                        ->all()
                    : ($isBookingProductLine
                        ? $this->bookingProductSplitQuery($orderItemId, $splitLineType, $lineRefId)
                            ->get(['staff_id', 'share_percent', 'commission_rate_snapshot', 'line_type', 'line_ref_id', 'amount_basis'])
                            ->map(fn ($row) => (array) $row)
                            ->values()
                            ->all()
                        : DB::table('order_item_staff_splits')
                            ->where('order_item_id', $orderItemId)
                            ->get(['staff_id', 'share_percent', 'commission_rate_snapshot'])
                            ->map(fn ($row) => (array) $row)
                            ->values()
                            ->all());

                if ((string) $orderItem->line_type === 'service_package' && $orderItem->customer_service_package_id) {
                    DB::table('service_package_staff_splits')
                        ->where('customer_service_package_id', (int) $orderItem->customer_service_package_id)
                        ->delete();

                    $itemTotal = (float) ($orderItem->effective_line_total ?? $orderItem->line_total_after_discount ?? $orderItem->line_total ?? 0);

                    $rows = $splits->map(function (array $row) use ($order, $orderItem, $staffs, $itemTotal) {
                        $staffId = (int) ($row['staff_id'] ?? 0);
                        $share = (int) ($row['share_percent'] ?? 0);
                        $staff = $staffs->get($staffId);
                        $rate = (float) ($staff?->service_commission_rate ?? 0);
                        $sales = round($itemTotal * ($share / 100), 2);

                        return [
                            'order_id' => (int) $order->id,
                            'customer_service_package_id' => (int) $orderItem->customer_service_package_id,
                            'service_package_id' => $orderItem->service_package_id ? (int) $orderItem->service_package_id : null,
                            'customer_id' => $order->customer_id ? (int) $order->customer_id : null,
                            'staff_id' => $staffId,
                            'share_percent' => $share,
                            'split_sales_amount' => $sales,
                            'service_commission_rate_snapshot' => $rate,
                            'commission_amount_snapshot' => round($sales * $rate, 2),
                            'created_at' => now(),
                            'updated_at' => now(),
                        ];
                    })->values()->all();

                    if (! empty($rows)) {
                        DB::table('service_package_staff_splits')->insert($rows);
                    }

                    $after = DB::table('service_package_staff_splits')
                        ->where('customer_service_package_id', (int) $orderItem->customer_service_package_id)
                        ->get(['staff_id', 'share_percent', 'service_commission_rate_snapshot', 'split_sales_amount'])
                        ->map(fn ($row) => (array) $row)
                        ->values()
                        ->all();
                } elseif ($isBookingProductLine) {
                    $amountBasis = $this->bookingProductLineAmountBasis($orderItem, $splitLineType, $lineRefId);
                    $resolvedRefId = $lineRefId ?? (string) $orderItemId;
                    $existingSnapshot = $this->bookingProductSplitQuery($orderItemId, $splitLineType, $lineRefId)
                        ->value('snapshot');
                    $snapshot = is_string($existingSnapshot) ? (json_decode($existingSnapshot, true) ?: []) : (is_array($existingSnapshot) ? $existingSnapshot : []);
                    if ($snapshot === []) {
                        $snapshot = [
                            'line_type' => $splitLineType,
                            'staff_split_source' => 'edit_sales_person',
                        ];
                        if ($splitLineType === 'booking_product_option') {
                            $snapshot['option'] = collect($this->decodeBookingProductOptions($orderItem->selected_booking_product_options ?? null))
                                ->first(fn (array $option) => (string) ($option['id'] ?? $option['option_id'] ?? '') === $resolvedRefId) ?? [];
                        }
                    }

                    $this->bookingProductSplitQuery($orderItemId, $splitLineType, $lineRefId)->delete();

                    $rows = $splits->map(function (array $row) use ($orderItemId, $staffs, $splitLineType, $resolvedRefId, $amountBasis, $snapshot) {
                        $staffId = (int) ($row['staff_id'] ?? 0);
                        $staff = $staffs->get($staffId);

                        return [
                            'order_item_id' => $orderItemId,
                            'line_type' => $splitLineType,
                            'line_ref_id' => $resolvedRefId,
                            'staff_id' => $staffId,
                            'share_percent' => (int) ($row['share_percent'] ?? 0),
                            'share_amount' => null,
                            'split_mode' => 'percent',
                            'amount_basis' => $amountBasis,
                            'snapshot' => json_encode($snapshot),
                            'commission_rate_snapshot' => (float) ($staff?->commission_rate ?? 0),
                            'created_at' => now(),
                            'updated_at' => now(),
                        ];
                    })->values()->all();

                    if (! empty($rows)) {
                        DB::table('order_item_staff_splits')->insert($rows);
                    }

                    $after = $this->bookingProductSplitQuery($orderItemId, $splitLineType, $resolvedRefId)
                        ->get(['staff_id', 'share_percent', 'commission_rate_snapshot', 'line_type', 'line_ref_id', 'amount_basis'])
                        ->map(fn ($row) => (array) $row)
                        ->values()
                        ->all();
                } else {
                    DB::table('order_item_staff_splits')
                        ->where('order_item_id', $orderItemId)
                        ->delete();

                    $rows = $splits->map(function (array $row) use ($orderItemId, $staffs) {
                        $staffId = (int) ($row['staff_id'] ?? 0);
                        $staff = $staffs->get($staffId);
                        return [
                            'order_item_id' => $orderItemId,
                            'staff_id' => $staffId,
                            'share_percent' => (int) ($row['share_percent'] ?? 0),
                            'commission_rate_snapshot' => (float) ($staff?->commission_rate ?? 0),
                            'created_at' => now(),
                            'updated_at' => now(),
                        ];
                    })->values()->all();

                    if (! empty($rows)) {
                        DB::table('order_item_staff_splits')->insert($rows);
                    }

                    $after = DB::table('order_item_staff_splits')
                        ->where('order_item_id', $orderItemId)
                        ->get(['staff_id', 'share_percent', 'commission_rate_snapshot'])
                        ->map(fn ($row) => (array) $row)
                        ->values()
                        ->all();
                }

                $this->log(
                    'order_item',
                    $orderItemId,
                    'edit_sales_person',
                    ['splits' => $before, 'item_type' => $splitLineType ?: null, 'line_ref_id' => $lineRefId],
                    ['splits' => $after, 'item_type' => $splitLineType ?: null, 'line_ref_id' => $lineRefId],
                    $remark,
                    $actorId,
                );

                if (StaffCommissionService::isBookingCommissionLineType((string) $orderItem->line_type)) {
                    foreach (array_merge($before, $after) as $row) {
                        $staffId = (int) ($row['staff_id'] ?? 0);
                        if ($staffId <= 0) {
                            continue;
                        }
                        $bookingTargets[] = [
                            'staff_id' => $staffId,
                            'year' => $orderYear,
                            'month' => $orderMonth,
                        ];
                    }
                } else {
                    $needsEcommerceRecalc = true;
                }
            }
        });

        if ($needsEcommerceRecalc) {
            $this->recalculateEcommerceCommissionForOrderMonth($order, 'edit_sales_person', $remark, $actorId);
        }
        if (! empty($bookingTargets)) {
            $this->recalculateBookingCommissionsForTargets($bookingTargets, $order, 'edit_sales_person', $remark, $actorId);
        }

        return $order;
    }

    private function bookingProductSplitQuery(int $orderItemId, string $splitLineType, ?string $lineRefId)
    {
        $query = DB::table('order_item_staff_splits')
            ->where('order_item_id', $orderItemId);

        if ($splitLineType === 'booking_product_base') {
            return $query->where(function ($inner) use ($lineRefId) {
                $inner->where('line_type', 'booking_product_base')
                    ->orWhereNull('line_type')
                    ->orWhere('line_type', '')
                    ->orWhere('line_type', 'booking_product');
                if ($lineRefId !== null && $lineRefId !== '') {
                    $inner->orWhere(function ($refQuery) use ($lineRefId) {
                        $refQuery->where('line_type', 'booking_product_base')
                            ->where('line_ref_id', $lineRefId);
                    });
                }
            });
        }

        return $query
            ->where('line_type', 'booking_product_option')
            ->where('line_ref_id', (string) $lineRefId);
    }

    private function bookingProductLineAmountBasis(object $orderItem, string $splitLineType, ?string $lineRefId): float
    {
        $lineTotal = (float) ($orderItem->effective_line_total ?? $orderItem->line_total_after_discount ?? $orderItem->line_total ?? 0);
        $qty = max(1, (int) ($orderItem->quantity ?? 1));
        $options = $this->decodeBookingProductOptions($orderItem->selected_booking_product_options ?? null);
        $optionTotal = 0.0;
        $matchedOptionAmount = null;

        foreach ($options as $option) {
            $optionId = (string) ($option['id'] ?? $option['option_id'] ?? '');
            $unitPrice = (float) ($option['extra_price'] ?? $option['unit_price'] ?? 0);
            $optionAmount = isset($option['line_total_after_discount'])
                ? (float) $option['line_total_after_discount']
                : (isset($option['line_total_override'])
                    ? (float) $option['line_total_override']
                    : round($unitPrice * $qty, 2));
            $optionTotal = round($optionTotal + $optionAmount, 2);
            if ($optionId !== '' && $optionId === (string) $lineRefId) {
                $matchedOptionAmount = $optionAmount;
            }
        }

        if ($splitLineType === 'booking_product_option') {
            return round(max(0, (float) ($matchedOptionAmount ?? 0)), 2);
        }

        return round(max(0, $lineTotal - $optionTotal), 2);
    }

    public function updateBookingWorker(Order $order, array $itemSplits, ?string $remark, ?int $actorId): Order
    {
        $this->ensureOfflineOrder($order);
        if (empty($itemSplits)) {
            throw new RuntimeException('At least one item split is required.');
        }

        $targets = [];

        DB::transaction(function () use ($order, $itemSplits, $remark, $actorId, &$targets) {
            $orderItems = DB::table('order_items')
                ->where('order_id', (int) $order->id)
                ->where('line_type', 'booking_settlement')
                ->get(['id', 'booking_id', 'line_type'])
                ->keyBy('id');

            $bookingIds = $orderItems
                ->pluck('booking_id')
                ->filter(fn ($id) => (int) $id > 0)
                ->map(fn ($id) => (int) $id)
                ->unique()
                ->values()
                ->all();
            $bookings = Booking::query()
                ->whereIn('id', $bookingIds)
                ->get(['id', 'staff_id', 'completed_at'])
                ->keyBy('id');
            $staffs = Staff::query()->whereIn('id', collect($itemSplits)->flatMap(fn ($item) => collect($item['splits'] ?? [])->pluck('staff_id'))->map(fn ($id) => (int) $id)->unique()->values())->get(['id', 'commission_rate', 'service_commission_rate'])->keyBy('id');

            foreach ($itemSplits as $itemSplit) {
                $orderItemId = (int) ($itemSplit['order_item_id'] ?? 0);
                $orderItem = $orderItems->get($orderItemId);
                if (! $orderItem || (string) $orderItem->line_type !== 'booking_settlement') {
                    throw new RuntimeException("Booking settlement item {$orderItemId} not found.");
                }

                $bookingId = (int) ($orderItem->booking_id ?? 0);
                if ($bookingId <= 0) {
                    throw new RuntimeException("Booking reference missing for order item {$orderItemId}.");
                }

                $splits = collect($itemSplit['splits'] ?? []);
                $sum = (int) $splits->sum(fn (array $row) => (int) ($row['share_percent'] ?? 0));
                $normalizedStaffIds = $splits->pluck('staff_id')->map(fn ($id) => (int) $id)->values();
                $unique = $normalizedStaffIds->unique()->count();
                if ($splits->isEmpty() || $sum !== 100 || $unique !== $splits->count() || $normalizedStaffIds->contains(fn ($id) => $id <= 0)) {
                    throw new RuntimeException('Invalid worker split. Total must be 100% and staffs must be unique.');
                }

                $booking = $bookings->get($bookingId);
                if (! $booking) {
                    throw new RuntimeException("Booking {$bookingId} not found.");
                }

                $before = DB::table('booking_service_staff_splits')
                    ->where('booking_id', $bookingId)
                    ->get(['staff_id', 'split_percent', 'service_commission_rate_snapshot'])
                    ->map(fn ($row) => (array) $row)
                    ->values()
                    ->all();

                DB::table('booking_service_staff_splits')
                    ->where('booking_id', $bookingId)
                    ->delete();

                $rows = $splits->map(function (array $row) use ($bookingId, $staffs) {
                    $staffId = (int) ($row['staff_id'] ?? 0);
                    $share = (int) ($row['share_percent'] ?? 0);
                    $rate = (float) ($staffs->get($staffId)?->service_commission_rate ?? 0);

                    return [
                        'booking_id' => $bookingId,
                        'staff_id' => $staffId,
                        'split_percent' => $share,
                        'service_commission_rate_snapshot' => $rate,
                        'created_at' => now(),
                        'updated_at' => now(),
                    ];
                })->values()->all();

                if (! empty($rows)) {
                    DB::table('booking_service_staff_splits')->insert($rows);
                }

                // Keep order-line staff splits in sync so View Details / commission
                // attribution match Edit Worker (otherwise stale checkout splits win).
                DB::table('order_item_staff_splits')
                    ->where('order_item_id', $orderItemId)
                    ->delete();

                $orderItemSplitRows = $splits->map(function (array $row) use ($orderItemId, $staffs) {
                    $staffId = (int) ($row['staff_id'] ?? 0);
                    $staff = $staffs->get($staffId);

                    return [
                        'order_item_id' => $orderItemId,
                        'staff_id' => $staffId,
                        'share_percent' => (int) ($row['share_percent'] ?? 0),
                        'commission_rate_snapshot' => (float) ($staff?->service_commission_rate ?? $staff?->commission_rate ?? 0),
                        'created_at' => now(),
                        'updated_at' => now(),
                    ];
                })->values()->all();

                if (! empty($orderItemSplitRows)) {
                    DB::table('order_item_staff_splits')->insert($orderItemSplitRows);
                }

                $firstStaffId = (int) ($rows[0]['staff_id'] ?? 0);
                if ($firstStaffId > 0 && (int) ($booking->staff_id ?? 0) !== $firstStaffId) {
                    DB::table('bookings')
                        ->where('id', $bookingId)
                        ->update([
                            'staff_id' => $firstStaffId,
                            'updated_at' => now(),
                        ]);
                }

                $after = DB::table('booking_service_staff_splits')
                    ->where('booking_id', $bookingId)
                    ->get(['staff_id', 'split_percent', 'service_commission_rate_snapshot'])
                    ->map(fn ($row) => (array) $row)
                    ->values()
                    ->all();

                $this->log(
                    'order_item',
                    $orderItemId,
                    'edit_worker',
                    ['booking_id' => $bookingId, 'splits' => $before],
                    ['booking_id' => $bookingId, 'splits' => $after],
                    $remark,
                    $actorId,
                );

                if ($booking->completed_at) {
                    $completedAt = $booking->completed_at instanceof Carbon
                        ? $booking->completed_at
                        : Carbon::parse((string) $booking->completed_at);
                    foreach ($before as $row) {
                        $targets[] = [
                            'staff_id' => (int) ($row['staff_id'] ?? 0),
                            'year' => (int) $completedAt->format('Y'),
                            'month' => (int) $completedAt->format('m'),
                        ];
                    }
                    foreach ($after as $row) {
                        $targets[] = [
                            'staff_id' => (int) ($row['staff_id'] ?? 0),
                            'year' => (int) $completedAt->format('Y'),
                            'month' => (int) $completedAt->format('m'),
                        ];
                    }
                }
            }
        });

        $this->recalculateBookingCommissionsForTargets($targets, $order, 'edit_worker', $remark, $actorId);

        return $order->fresh();
    }

    public function updatePaymentMethod(Order $order, string $paymentMethod, ?string $remark, ?int $actorId, ?array $payments = null): Order
    {
        $this->ensureOfflineOrder($order);

        $before = [
            'payment_method' => $order->payment_method,
        ];

        $paymentRows = $this->normalizePaymentRows($payments, (float) $order->grand_total, $paymentMethod);

        $order->payment_method = count($paymentRows) > 1 ? 'split' : (string) ($paymentRows[0]['method'] ?? trim($paymentMethod));
        $order->save();
        $order->payments()->delete();
        foreach ($paymentRows as $row) {
            $order->payments()->create([
                'payment_method' => (string) $row['method'],
                'amount' => round((float) $row['amount'], 2),
                'meta' => ['source' => 'edit_payment_method'],
            ]);
        }

        $this->log('order', (int) $order->id, 'edit_payment_method', $before, [
            'payment_method' => $order->payment_method,
        ], $remark, $actorId);

        return $order->fresh();
    }

    public function updateBillDate(Order $order, Carbon $billDate, ?string $remark, ?int $actorId): Order
    {
        $this->ensureOfflineOrder($order);

        $before = [
            'placed_at' => $order->placed_at?->toIso8601String(),
            'created_at' => $order->created_at?->toIso8601String(),
        ];

        $order->placed_at = $billDate;
        $order->save();

        $this->log('order', (int) $order->id, 'edit_bill_date', $before, [
            'placed_at' => $order->placed_at?->toIso8601String(),
        ], $remark, $actorId);

        return $order->fresh();
    }

    private function normalizePaymentRows(?array $payments, float $expectedTotal, string $fallbackMethod): array
    {
        $allowed = ['cash', 'qrpay', 'credit_card'];
        $rows = collect($payments ?? [])
            ->map(function (array $row) {
                $method = strtolower(trim((string) ($row['method'] ?? '')));
                if ($method === 'billplz_credit_card') {
                    $method = 'credit_card';
                }
                return ['method' => $method, 'amount' => round((float) ($row['amount'] ?? 0), 2)];
            })
            ->filter(fn (array $row) => $row['method'] !== '' && $row['amount'] > 0)
            ->groupBy('method')
            ->map(fn ($group, string $method) => [
                'method' => $method,
                'amount' => round((float) $group->sum('amount'), 2),
            ])
            ->values();

        if ($rows->isEmpty()) {
            $method = strtolower(trim($fallbackMethod));
            if ($method === 'billplz_credit_card') {
                $method = 'credit_card';
            }
            $rows = collect([['method' => $method, 'amount' => round($expectedTotal, 2)]]);
        }

        foreach ($rows as $row) {
            if (! in_array((string) $row['method'], $allowed, true)) {
                throw new RuntimeException('Unsupported payment method.');
            }
        }

        if ((int) $rows->sum(fn (array $row) => (int) round(((float) $row['amount']) * 100)) !== (int) round($expectedTotal * 100)) {
            throw new RuntimeException('Payment total must equal order total.');
        }

        return $rows->all();
    }

    public function buildVoidOrderPreview(Order $order): array
    {
        $this->ensureOfflineOrder($order);

        if ($order->status === 'voided') {
            throw new RuntimeException('This order is already voided.');
        }

        $isDepositOnlyOrder = $this->isDepositOnlyOrder($order);
        $bookingIds = $this->bookingIdsForOrder($order);

        $linkedBookings = [];
        $totalOtherActiveDepositOrders = 0;
        $totalOtherActiveNonDepositOrders = 0;

        foreach ($bookingIds as $bookingId) {
            $booking = Booking::query()->find($bookingId);
            if (! $booking) {
                continue;
            }

            $activeOrders = $this->activeOrdersForBookings([$bookingId], (int) $order->id);
            $otherDepositOrders = $activeOrders->filter(fn (Order $candidate) => $this->isDepositOnlyOrder($candidate));
            $otherNonDepositOrders = $activeOrders->reject(fn (Order $candidate) => $this->isDepositOnlyOrder($candidate));

            $totalOtherActiveDepositOrders += $otherDepositOrders->count();
            $totalOtherActiveNonDepositOrders += $otherNonDepositOrders->count();

            $linkedBookings[] = [
                'booking_id' => $bookingId,
                'booking_code' => (string) ($booking->booking_code ?: ('BOOKING-' . $bookingId)),
                'status' => (string) $booking->status,
                'other_active_order_count' => $activeOrders->count(),
                'other_active_deposit_order_count' => $otherDepositOrders->count(),
                'other_active_non_deposit_order_count' => $otherNonDepositOrders->count(),
            ];
        }

        $appointmentAlreadyTerminal = collect($linkedBookings)->contains(
            fn (array $row) => in_array(strtoupper((string) ($row['status'] ?? '')), ['VOIDED', 'CANCELLED'], true),
        );

        $hasLinkedAppointment = ! empty($linkedBookings);
        $hasActiveSettlement = ! $isDepositOnlyOrder || $totalOtherActiveNonDepositOrders > 0;
        $requiresVoidScopeChoice = $hasLinkedAppointment
            && ! $appointmentAlreadyTerminal
            && ! $hasActiveSettlement;

        $defaultVoidScope = $requiresVoidScopeChoice ? 'order_only' : 'order_and_appointment';

        return [
            'order_id' => (int) $order->id,
            'order_number' => (string) $order->order_number,
            'is_deposit_only_order' => $isDepositOnlyOrder,
            'has_active_settlement' => $hasActiveSettlement,
            'requires_void_scope_choice' => $requiresVoidScopeChoice,
            'other_active_deposit_order_count' => $totalOtherActiveDepositOrders,
            'other_active_non_deposit_order_count' => $totalOtherActiveNonDepositOrders,
            'default_void_scope' => $defaultVoidScope,
            'linked_bookings' => $linkedBookings,
            'message' => $hasActiveSettlement
                ? 'This appointment has a settlement on file. A full appointment void is required.'
                : ($requiresVoidScopeChoice
                    ? 'Select how this void should be applied.'
                    : null),
        ];
    }

    public function voidOrder(Order $order, string $remark, ?int $actorId, ?string $voidScope = null): Order
    {
        $this->ensureOfflineOrder($order);

        if ($order->status === 'voided') {
            throw new RuntimeException('This order is already voided.');
        }

        if (! in_array((string) $order->status, self::ALLOWED_VOID_STATUSES, true)) {
            throw new RuntimeException('Order is not in a valid status for void.');
        }

        $preview = $this->buildVoidOrderPreview($order);
        $resolvedVoidScope = $voidScope;
        if (! in_array((string) $resolvedVoidScope, ['order_only', 'order_and_appointment'], true)) {
            $resolvedVoidScope = (string) ($preview['default_void_scope'] ?? 'order_and_appointment');
        }

        if ($resolvedVoidScope === 'order_only' && ($preview['has_active_settlement'] ?? false)) {
            $resolvedVoidScope = 'order_and_appointment';
        }

        $voidAppointment = $resolvedVoidScope === 'order_and_appointment';
        $ordersToVoid = $this->resolveOrdersToVoidForScope($order, $resolvedVoidScope);
        $bookingRecalculateTargets = [];

        DB::transaction(function () use ($order, $ordersToVoid, $remark, $actorId, $voidAppointment, $resolvedVoidScope, &$bookingRecalculateTargets) {
            $voidedOrderIds = [];

            foreach ($ordersToVoid as $orderId) {
                $targetOrder = (int) $orderId === (int) $order->id
                    ? $order
                    : Order::query()->find($orderId);

                if (! $targetOrder || $targetOrder->status === 'voided') {
                    continue;
                }

                $this->voidSingleOrderRecord($targetOrder, $remark, $actorId);
                $voidedOrderIds[] = (int) $targetOrder->id;
            }

            if (empty($voidedOrderIds)) {
                throw new RuntimeException('No orders were available to void.');
            }

            $bookingIds = DB::table('order_items')
                ->whereIn('order_id', $voidedOrderIds)
                ->whereNotNull('booking_id')
                ->pluck('booking_id')
                ->map(fn ($id) => (int) $id)
                ->unique()
                ->values()
                ->all();

            if (! empty($bookingIds)) {
                $bookings = Booking::query()
                    ->whereIn('id', $bookingIds)
                    ->get();

                $bookingRecalculateTargets = array_merge(
                    $bookingRecalculateTargets,
                    $this->resolveBookingRecalculateTargetsForVoidedOrders($voidedOrderIds, $bookings),
                );

                foreach ($bookings as $booking) {
                    if ($voidAppointment) {
                        $beforeBooking = [
                            'status' => $booking->status,
                            'payment_status' => $booking->payment_status,
                            'notes' => $booking->notes,
                        ];

                        $booking->status = 'VOIDED';
                        $booking->payment_status = 'FAILED';
                        $booking->notes = trim((string) $booking->notes . "\n[VOID REMARK] {$remark}");
                        $booking->save();

                        $this->staffCommissionService->syncBookingCommissionState($booking->fresh(['service']));

                        $this->log('appointment', (int) $booking->id, 'void_order', $beforeBooking, [
                            'status' => $booking->status,
                            'payment_status' => $booking->payment_status,
                            'notes' => $booking->notes,
                        ], $remark, $actorId);
                    } else {
                        app(PosController::class)->refreshBookingFinancialState($booking->fresh(['service']));
                    }
                }

                $payments = BookingPayment::query()
                    ->whereIn('booking_id', $bookingIds)
                    ->where('status', 'PAID')
                    ->get()
                    ->filter(function (BookingPayment $payment) use ($voidAppointment, $order) {
                        if ($voidAppointment) {
                            return true;
                        }

                        $raw = is_array($payment->raw_response) ? $payment->raw_response : [];
                        $paymentOrderId = (int) (data_get($raw, 'order_id') ?? 0);
                        $paymentRef = (string) ($payment->ref ?? '');

                        return $paymentOrderId === (int) $order->id
                            || $paymentRef === (string) $order->order_number;
                    });

                foreach ($payments as $payment) {
                    $beforePayment = [
                        'status' => $payment->status,
                        'raw_response' => $payment->raw_response,
                    ];

                    $raw = is_array($payment->raw_response) ? $payment->raw_response : [];
                    $raw['voided_by_order_id'] = (int) $order->id;
                    $raw['void_remark'] = $remark;
                    $raw['void_scope'] = $resolvedVoidScope;

                    $payment->status = 'VOIDED';
                    $payment->raw_response = $raw;
                    $payment->save();

                    $this->log('settlement', (int) $payment->id, 'void_order', $beforePayment, [
                        'status' => $payment->status,
                        'raw_response' => $payment->raw_response,
                    ], $remark, $actorId);
                }
            }
        });

        foreach ($ordersToVoid as $voidedOrderId) {
            $voidedOrder = (int) $voidedOrderId === (int) $order->id
                ? $order
                : Order::query()->find($voidedOrderId);
            if ($voidedOrder) {
                $this->recalculateEcommerceCommissionForOrderMonth($voidedOrder, 'void_order', $remark, $actorId);
            }
        }

        $this->recalculateBookingCommissionsForTargets($bookingRecalculateTargets, $order, 'void_order', $remark, $actorId);

        return $order->fresh();
    }

    private function voidSingleOrderRecord(Order $order, string $remark, ?int $actorId): void
    {
        $order->refresh();
        if ($order->status === 'voided') {
            return;
        }

        $packageIds = CustomerServicePackage::query()
            ->where('purchased_from', 'POS')
            ->where('purchased_ref_id', (int) $order->id)
            ->pluck('id')
            ->map(fn ($id) => (int) $id)
            ->all();

        if (! empty($packageIds)) {
            $usedCount = CustomerServicePackageUsage::query()
                ->whereIn('customer_service_package_id', $packageIds)
                ->count();

            if ($usedCount > 0) {
                throw new RuntimeException('This package has already been used and cannot be voided.');
            }
        }

        $beforeOrder = [
            'status' => $order->status,
            'payment_status' => $order->payment_status,
        ];

        $order->status = 'voided';
        $order->save();

        $this->log('order', (int) $order->id, 'void_order', $beforeOrder, [
            'status' => $order->status,
            'payment_status' => $order->payment_status,
        ], $remark, $actorId);

        if (! empty($packageIds)) {
            $packages = CustomerServicePackage::query()
                ->whereIn('id', $packageIds)
                ->get();

            DB::table('service_package_staff_splits')
                ->whereIn('customer_service_package_id', $packageIds)
                ->delete();

            DB::table('customer_service_package_balances')
                ->whereIn('customer_service_package_id', $packageIds)
                ->delete();

            foreach ($packages as $package) {
                $beforePackage = [
                    'id' => $package->id,
                    'status' => $package->status,
                    'purchased_ref_id' => $package->purchased_ref_id,
                ];

                $package->delete();

                $this->log('service_package', (int) $beforePackage['id'], 'void_order', $beforePackage, [
                    'deleted' => true,
                ], $remark, $actorId);
            }
        }
    }

    private function resolveOrdersToVoidForScope(Order $primary, string $voidScope): array
    {
        $bookingIds = $this->bookingIdsForOrder($primary);
        $primaryId = (int) $primary->id;

        if (empty($bookingIds)) {
            return [$primaryId];
        }

        if ($voidScope === 'order_and_appointment') {
            return Order::query()
                ->whereNotIn('status', ['voided', 'cancelled', 'draft'])
                ->whereHas('items', fn ($query) => $query->whereIn('booking_id', $bookingIds))
                ->pluck('id')
                ->map(fn ($id) => (int) $id)
                ->unique()
                ->values()
                ->all();
        }

        return [$primaryId];
    }

    private function bookingIdsForOrder(Order $order): array
    {
        return DB::table('order_items')
            ->where('order_id', (int) $order->id)
            ->whereNotNull('booking_id')
            ->pluck('booking_id')
            ->map(fn ($id) => (int) $id)
            ->unique()
            ->values()
            ->all();
    }

    private function activeOrdersForBookings(array $bookingIds, ?int $excludeOrderId = null)
    {
        $query = Order::query()
            ->whereNotIn('status', ['voided', 'cancelled', 'draft'])
            ->whereHas('items', fn ($itemQuery) => $itemQuery->whereIn('booking_id', $bookingIds));

        if ($excludeOrderId !== null) {
            $query->where('id', '!=', $excludeOrderId);
        }

        return $query->get();
    }

    private function isDepositOnlyOrder(Order $order): bool
    {
        $items = DB::table('order_items')
            ->where('order_id', (int) $order->id)
            ->get(['line_type', 'variant_name_snapshot']);

        if ($items->isEmpty()) {
            return false;
        }

        return $items->every(function ($row) {
            if ((string) $row->line_type === 'booking_deposit') {
                return true;
            }

            return (string) $row->line_type === 'booking_addon'
                && strcasecmp((string) ($row->variant_name_snapshot ?? ''), 'Booking Add-on Deposit') === 0;
        });
    }

    private const BOOKING_COMMISSION_LINE_TYPES = ['booking_deposit', 'booking_settlement', 'booking_addon', 'booking_product'];

    /**
     * Collect every staff who had split lines on the voided orders so commission
     * is recalculated for main service and add-on workers, not only bookings.staff_id.
     *
     * @param  array<int>  $voidedOrderIds
     * @param  \Illuminate\Support\Collection<int, Booking>  $bookings
     * @return array<int, array{staff_id: int, year: int, month: int}>
     */
    private function resolveBookingRecalculateTargetsForVoidedOrders(array $voidedOrderIds, $bookings): array
    {
        if ($voidedOrderIds === [] || $bookings->isEmpty()) {
            return [];
        }

        $bookingIds = $bookings->pluck('id')->map(fn ($id) => (int) $id)->filter(fn ($id) => $id > 0)->values()->all();
        if ($bookingIds === []) {
            return [];
        }

        $bookingsById = $bookings->keyBy('id');
        $staffByBooking = [];

        $splitRows = DB::table('order_item_staff_splits')
            ->join('order_items', 'order_items.id', '=', 'order_item_staff_splits.order_item_id')
            ->whereIn('order_items.order_id', $voidedOrderIds)
            ->whereIn('order_items.line_type', self::BOOKING_COMMISSION_LINE_TYPES)
            ->whereIn('order_items.booking_id', $bookingIds)
            ->select(['order_item_staff_splits.staff_id', 'order_items.booking_id'])
            ->get();

        foreach ($splitRows as $row) {
            $staffId = (int) ($row->staff_id ?? 0);
            $bookingId = (int) ($row->booking_id ?? 0);
            if ($staffId <= 0 || $bookingId <= 0) {
                continue;
            }

            $staffByBooking[$bookingId][$staffId] = true;
        }

        $fallbackBookingIds = DB::table('order_items')
            ->whereIn('order_id', $voidedOrderIds)
            ->whereIn('booking_id', $bookingIds)
            ->whereIn('line_type', ['booking_deposit', 'booking_settlement', 'booking_addon'])
            ->whereNotExists(function ($sub) {
                $sub->selectRaw('1')
                    ->from('order_item_staff_splits')
                    ->whereColumn('order_item_staff_splits.order_item_id', 'order_items.id');
            })
            ->pluck('booking_id')
            ->map(fn ($id) => (int) $id)
            ->filter(fn ($id) => $id > 0)
            ->unique()
            ->values()
            ->all();

        if ($fallbackBookingIds !== []) {
            $bookingSplitRows = DB::table('booking_service_staff_splits')
                ->whereIn('booking_id', $fallbackBookingIds)
                ->select(['staff_id', 'booking_id'])
                ->get();

            foreach ($bookingSplitRows as $row) {
                $staffId = (int) ($row->staff_id ?? 0);
                $bookingId = (int) ($row->booking_id ?? 0);
                if ($staffId <= 0 || $bookingId <= 0) {
                    continue;
                }

                $staffByBooking[$bookingId][$staffId] = true;
            }

            foreach ($bookingsById as $bookingId => $booking) {
                if (! in_array((int) $bookingId, $fallbackBookingIds, true)) {
                    continue;
                }

                $staffId = (int) ($booking->staff_id ?? 0);
                if ($staffId > 0) {
                    $staffByBooking[(int) $bookingId][$staffId] = true;
                }
            }
        }

        $targets = [];
        foreach ($staffByBooking as $bookingId => $staffIds) {
            $booking = $bookingsById->get((int) $bookingId);
            if (! $booking) {
                continue;
            }

            $recalculateAt = $this->resolveBookingCommissionRecalculateAt($booking, $voidedOrderIds);
            if (! $recalculateAt) {
                continue;
            }

            foreach (array_keys($staffIds) as $staffId) {
                $targets[] = [
                    'staff_id' => (int) $staffId,
                    'year' => (int) $recalculateAt->format('Y'),
                    'month' => (int) $recalculateAt->format('m'),
                ];
            }
        }

        return $targets;
    }

    private function resolveBookingCommissionRecalculateAt(Booking $booking, array $voidedOrderIds): ?Carbon
    {
        if ($booking->completed_at) {
            return $booking->completed_at instanceof Carbon
                ? $booking->completed_at
                : Carbon::parse((string) $booking->completed_at);
        }

        $billAt = DB::table('orders')
            ->join('order_items', 'order_items.order_id', '=', 'orders.id')
            ->whereIn('orders.id', $voidedOrderIds)
            ->where('order_items.booking_id', (int) $booking->id)
            ->selectRaw('MAX('.$this->orderBillAtSql('orders').') as bill_at')
            ->value('bill_at');

        return $billAt ? Carbon::parse((string) $billAt) : null;
    }

    private function orderBillAtSql(string $alias = 'orders'): string
    {
        return "COALESCE({$alias}.placed_at, {$alias}.created_at)";
    }

    private function recalculateBookingCommissionsForTargets(
        array $targets,
        Order $order,
        string $actionType,
        ?string $remark,
        ?int $actorId,
    ): void {
        $frozenCount = 0;

        foreach (collect($targets)->unique(fn (array $target) => implode('-', [$target['staff_id'], $target['year'], $target['month']]))->values() as $target) {
            $row = $this->staffCommissionService->recalculateForStaffMonth(
                (int) $target['staff_id'],
                (int) $target['year'],
                (int) $target['month'],
                StaffCommissionService::TYPE_BOOKING,
                false,
            );

            if (strtoupper((string) ($row->status ?? '')) === StaffCommissionService::STATUS_FROZEN) {
                $frozenCount++;
            }
        }

        if ($frozenCount > 0) {
            $this->log(
                'order',
                (int) $order->id,
                $actionType,
                null,
                [
                    'booking_commission_recalculation' => 'skipped_for_frozen_month',
                    'frozen_staff_month_count' => $frozenCount,
                ],
                $remark,
                $actorId,
            );
        }
    }

    private function recalculateEcommerceCommissionForOrderMonth(
        Order $order,
        string $actionType,
        ?string $remark,
        ?int $actorId,
    ): void {
        $at = $order->created_at instanceof Carbon
            ? $order->created_at
            : Carbon::parse((string) $order->created_at);

        $rows = $this->staffCommissionService->recalculateForMonthAll(
            (int) $at->format('Y'),
            (int) $at->format('m'),
            StaffCommissionService::TYPE_ECOMMERCE,
            false,
        );

        $frozenCount = collect($rows)
            ->filter(fn ($row) => strtoupper((string) ($row->status ?? '')) === StaffCommissionService::STATUS_FROZEN)
            ->count();

        if ($frozenCount > 0) {
            $this->log(
                'order',
                (int) $order->id,
                $actionType,
                null,
                [
                    'commission_recalculation' => 'skipped_for_frozen_month',
                    'frozen_staff_count' => $frozenCount,
                    'year' => (int) $at->format('Y'),
                    'month' => (int) $at->format('m'),
                ],
                $remark,
                $actorId,
            );
        }
    }

    /**
     * Void all active deposit receipts for a booking (order_only). Used when cancelling / no-show from POS.
     */
    public function voidBookingDepositOrders(Booking $booking, string $remark, ?int $actorId): void
    {
        $bookingId = (int) $booking->id;
        $orderIds = DB::table('order_items')
            ->join('orders', 'orders.id', '=', 'order_items.order_id')
            ->where('order_items.booking_id', $bookingId)
            ->whereNotIn('orders.status', ['voided', 'cancelled', 'draft'])
            ->where(function ($query) {
                $query->where('order_items.line_type', 'booking_deposit')
                    ->orWhere(function ($addonQuery) {
                        $addonQuery->where('order_items.line_type', 'booking_addon')
                            ->where('order_items.variant_name_snapshot', 'Booking Add-on Deposit');
                    });
            })
            ->pluck('orders.id')
            ->map(fn ($id) => (int) $id)
            ->unique()
            ->values()
            ->all();

        foreach ($orderIds as $orderId) {
            $order = Order::query()->find($orderId);
            if (! $order || $order->status === 'voided') {
                continue;
            }

            if (! $this->isDepositOnlyOrder($order)) {
                throw new RuntimeException('Cannot void non-deposit order during appointment cancellation.');
            }

            if ($order->created_by_user_id) {
                $this->voidOrder($order, $remark, $actorId, 'order_only');

                continue;
            }

            $this->voidOnlineBookingDepositOrder($order, $remark, $actorId, $bookingId);
        }

        app(PosController::class)->refreshBookingFinancialState($booking->fresh(['service']));
    }

    private function voidOnlineBookingDepositOrder(Order $order, string $remark, ?int $actorId, int $bookingId): void
    {
        if ($order->status === 'voided') {
            return;
        }

        if (! in_array((string) $order->status, self::ALLOWED_VOID_STATUSES, true)) {
            throw new RuntimeException('Deposit order is not in a valid status for void.');
        }

        DB::transaction(function () use ($order, $remark, $actorId, $bookingId) {
            $this->voidSingleOrderRecord($order, $remark, $actorId);

            $payments = BookingPayment::query()
                ->where('booking_id', $bookingId)
                ->where('status', 'PAID')
                ->get()
                ->filter(function (BookingPayment $payment) use ($order) {
                    $raw = is_array($payment->raw_response) ? $payment->raw_response : [];
                    $paymentOrderId = (int) (data_get($raw, 'order_id') ?? 0);
                    $paymentRef = (string) ($payment->ref ?? '');

                    return $paymentOrderId === (int) $order->id
                        || $paymentRef === (string) $order->order_number;
                });

            foreach ($payments as $payment) {
                $beforePayment = [
                    'status' => $payment->status,
                    'raw_response' => $payment->raw_response,
                ];

                $raw = is_array($payment->raw_response) ? $payment->raw_response : [];
                $raw['voided_by_order_id'] = (int) $order->id;
                $raw['void_remark'] = $remark;
                $raw['void_scope'] = 'order_only';

                $payment->status = 'VOIDED';
                $payment->raw_response = $raw;
                $payment->save();

                $this->log('settlement', (int) $payment->id, 'void_order', $beforePayment, [
                    'status' => $payment->status,
                    'raw_response' => $payment->raw_response,
                ], $remark, $actorId);
            }
        });

        $this->recalculateEcommerceCommissionForOrderMonth($order->fresh(), 'void_order', $remark, $actorId);
    }

    private function ensureOfflineOrder(Order $order): void
    {
        if (! $order->created_by_user_id) {
            throw new RuntimeException('This action is only available for offline/POS orders.');
        }

        if (in_array((string) $order->status, ['cancelled', 'draft'], true)) {
            throw new RuntimeException('Order is not in a valid state for this action.');
        }
    }

    private function log(
        string $entityType,
        int $entityId,
        string $actionType,
        ?array $before,
        ?array $after,
        ?string $remark,
        ?int $actorId,
    ): void {
        OrderActionLog::query()->create([
            'entity_type' => $entityType,
            'entity_id' => $entityId,
            'action_type' => $actionType,
            'before_value' => $before,
            'after_value' => $after,
            'remark' => $remark,
            'created_by' => $actorId,
        ]);
    }
}
