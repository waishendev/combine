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

    public function updateSalesPerson(Request $request, Order $order)
    {
        $validated = $request->validate([
            'created_by_user_id' => ['required', 'integer', 'exists:users,id'],
            'remark' => ['nullable', 'string', 'max:1000'],
        ]);

        try {
            $updated = $this->service->updateSalesPerson(
                $order,
                (int) $validated['created_by_user_id'],
                isset($validated['remark']) ? trim((string) $validated['remark']) : null,
                $request->user()?->id,
            );
        } catch (RuntimeException $e) {
            return $this->respondError($e->getMessage(), 422);
        }

        return $this->respond($updated, 'Sales person updated successfully.');
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
