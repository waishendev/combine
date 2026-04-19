<?php

namespace App\Http\Controllers\Ecommerce;

use App\Http\Controllers\Controller;
use App\Models\Ecommerce\Order;
use App\Services\Ecommerce\OfflineOrderManagementService;
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
            'payment_method' => ['required', 'string', 'max:100'],
            'remark' => ['nullable', 'string', 'max:1000'],
        ]);

        try {
            $updated = $this->service->updatePaymentMethod(
                $order,
                trim((string) $validated['payment_method']),
                isset($validated['remark']) ? trim((string) $validated['remark']) : null,
                $request->user()?->id,
            );
        } catch (RuntimeException $e) {
            return $this->respondError($e->getMessage(), 422);
        }

        return $this->respond($updated, 'Payment method updated successfully.');
    }

    public function voidOrder(Request $request, Order $order)
    {
        $validated = $request->validate([
            'remark' => ['required', 'string', 'min:3', 'max:2000'],
        ]);

        try {
            $updated = $this->service->voidOrder(
                $order,
                trim((string) $validated['remark']),
                $request->user()?->id,
            );
        } catch (RuntimeException $e) {
            return $this->respondError($e->getMessage(), 422);
        }

        return $this->respond($updated, 'Order voided successfully.');
    }
}
