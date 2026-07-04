<?php

namespace App\Http\Controllers\Ecommerce;

use App\Http\Controllers\Controller;
use App\Models\Ecommerce\Order;
use App\Services\Ecommerce\OfflineOrderManagementService;
use Carbon\Carbon;
use Illuminate\Http\Request;
use RuntimeException;

class OfflineOrderManagementController extends Controller
{
    public function __construct(private OfflineOrderManagementService $service)
    {
    }

    public function salesPersonDraft(Order $order)
    {
        try {
            $items = $this->service->getSalesPersonDraft($order);
        } catch (RuntimeException $e) {
            return $this->respondError($e->getMessage(), 422);
        }

        return $this->respond([
            'order_id' => (int) $order->id,
            'items' => $items,
        ]);
    }

    public function bookingWorkerDraft(Order $order)
    {
        try {
            $items = $this->service->getBookingWorkerDraft($order);
        } catch (RuntimeException $e) {
            return $this->respondError($e->getMessage(), 422);
        }

        return $this->respond([
            'order_id' => (int) $order->id,
            'items' => $items,
        ]);
    }

    public function updateSalesPerson(Request $request, Order $order)
    {
        $validated = $request->validate([
            'item_splits' => ['required', 'array', 'min:1'],
            'item_splits.*.order_item_id' => ['required', 'integer'],
            'item_splits.*.splits' => ['required', 'array'],
            'item_splits.*.splits.*.staff_id' => ['required', 'integer', 'exists:staffs,id'],
            'item_splits.*.splits.*.share_percent' => ['required', 'integer', 'min:0', 'max:100'],
            'remark' => ['nullable', 'string', 'max:1000'],
        ]);

        try {
            $updated = $this->service->updateSalesPerson(
                $order,
                $validated['item_splits'],
                isset($validated['remark']) ? trim((string) $validated['remark']) : null,
                $request->user()?->id,
            );
        } catch (RuntimeException $e) {
            return $this->respondError($e->getMessage(), 422);
        }

        return $this->respond($updated, 'Item staff split updated successfully.');
    }

    public function updateBookingWorker(Request $request, Order $order)
    {
        $validated = $request->validate([
            'item_splits' => ['required', 'array', 'min:1'],
            'item_splits.*.order_item_id' => ['required', 'integer'],
            'item_splits.*.splits' => ['required', 'array', 'min:1'],
            'item_splits.*.splits.*.staff_id' => ['required', 'integer', 'exists:staffs,id'],
            'item_splits.*.splits.*.share_percent' => ['required', 'integer', 'min:1', 'max:100'],
            'remark' => ['nullable', 'string', 'max:1000'],
        ]);

        try {
            $updated = $this->service->updateBookingWorker(
                $order,
                $validated['item_splits'],
                isset($validated['remark']) ? trim((string) $validated['remark']) : null,
                $request->user()?->id,
            );
        } catch (RuntimeException $e) {
            return $this->respondError($e->getMessage(), 422);
        }

        return $this->respond($updated, 'Booking worker split updated successfully.');
    }

    public function updatePaymentMethod(Request $request, Order $order)
    {
        $validated = $request->validate([
            'payment_method' => ['nullable', 'string', 'max:100'],
            'payments' => ['nullable', 'array'],
            'payments.*.method' => ['required_with:payments', 'string', 'in:cash,qrpay,credit_card,billplz_credit_card'],
            'payments.*.amount' => ['required_with:payments', 'numeric', 'gt:0'],
            'remark' => ['nullable', 'string', 'max:1000'],
            'remarks' => ['nullable', 'string', 'max:1000'],
        ]);

        try {
            $updated = $this->service->updatePaymentMethod(
                $order,
                trim((string) ($validated['payment_method'] ?? '')),
                isset($validated['remark'])
                    ? trim((string) $validated['remark'])
                    : (isset($validated['remarks']) ? trim((string) $validated['remarks']) : null),
                $request->user()?->id,
                $validated['payments'] ?? null,
            );
        } catch (RuntimeException $e) {
            return $this->respondError($e->getMessage(), 422);
        }

        return $this->respond($updated, 'Payment method updated successfully.');
    }

    public function updateBillDate(Request $request, Order $order)
    {
        $validated = $request->validate([
            'bill_date' => ['required', 'date'],
            'remark' => ['nullable', 'string', 'max:1000'],
        ]);

        try {
            $updated = $this->service->updateBillDate(
                $order,
                Carbon::parse((string) $validated['bill_date']),
                isset($validated['remark']) ? trim((string) $validated['remark']) : null,
                $request->user()?->id,
            );
        } catch (RuntimeException $e) {
            return $this->respondError($e->getMessage(), 422);
        }

        return $this->respond([
            'id' => (int) $updated->id,
            'order_no' => (string) $updated->order_number,
            'placed_at' => $updated->placed_at?->toIso8601String(),
            'created_at' => $updated->created_at?->toIso8601String(),
        ], 'Bill date updated successfully.');
    }

    public function voidOrderPreview(Order $order)
    {
        try {
            $preview = $this->service->buildVoidOrderPreview($order);
        } catch (RuntimeException $e) {
            return $this->respondError($e->getMessage(), 422);
        }

        return $this->respond($preview);
    }

    public function voidOrder(Request $request, Order $order)
    {
        $validated = $request->validate([
            'remark' => ['required', 'string', 'min:3', 'max:2000'],
            'void_scope' => ['nullable', 'string', 'in:order_only,order_and_appointment'],
        ]);

        try {
            $updated = $this->service->voidOrder(
                $order,
                trim((string) $validated['remark']),
                $request->user()?->id,
                isset($validated['void_scope']) ? (string) $validated['void_scope'] : null,
            );
        } catch (RuntimeException $e) {
            return $this->respondError($e->getMessage(), 422);
        }

        return $this->respond($updated, 'Order voided successfully.');
    }
}
