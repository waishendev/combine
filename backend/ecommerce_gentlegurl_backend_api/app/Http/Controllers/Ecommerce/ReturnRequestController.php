<?php

namespace App\Http\Controllers\Ecommerce;

use App\Http\Controllers\Controller;
use App\Models\Ecommerce\ReturnRequest;
use Carbon\Carbon;
use Illuminate\Http\Request;

class ReturnRequestController extends Controller
{
    public function index(Request $request)
    {
        $validated = $request->validate([
            'status' => ['nullable', 'string'],
            'order_no' => ['nullable', 'string'],
            'customer_name' => ['nullable', 'string'],
            'customer_email' => ['nullable', 'string'],
            'date_from' => ['nullable', 'date'],
            'date_to' => ['nullable', 'date'],
            'per_page' => ['nullable', 'integer'],
        ]);

        $query = ReturnRequest::with(['order', 'customer'])
            ->withCount('items')
            ->withSum('items as items_quantity', 'quantity');

        if (!empty($validated['status'])) {
            $query->where('status', $validated['status']);
        }

        if (!empty($validated['order_no'])) {
            $query->whereHas('order', function ($q) use ($validated) {
                $q->where('order_number', 'ilike', '%' . $validated['order_no'] . '%');
            });
        }

        if (!empty($validated['customer_name'])) {
            $query->whereHas('customer', function ($q) use ($validated) {
                $q->where('name', 'ilike', '%' . $validated['customer_name'] . '%');
            });
        }

        if (!empty($validated['customer_email'])) {
            $query->whereHas('customer', function ($q) use ($validated) {
                $q->where('email', 'ilike', '%' . $validated['customer_email'] . '%');
            });
        }

        if (!empty($validated['date_from'])) {
            $query->whereDate('created_at', '>=', Carbon::parse($validated['date_from'])->startOfDay());
        }

        if (!empty($validated['date_to'])) {
            $query->whereDate('created_at', '<=', Carbon::parse($validated['date_to'])->endOfDay());
        }

        $returns = $query->latest()->paginate($validated['per_page'] ?? 15);

        return $this->respond($returns);
    }

    public function show(ReturnRequest $returnRequest)
    {
        $returnRequest->load(['order', 'customer', 'items.orderItem']);

        return $this->respond([
            'id' => $returnRequest->id,
            'order' => [
                'id' => $returnRequest->order?->id,
                'order_number' => $returnRequest->order?->order_number,
                'placed_at' => $returnRequest->order?->placed_at,
                'grand_total' => $returnRequest->order?->grand_total,
                'status' => $returnRequest->order?->status,
            ],
            'customer' => [
                'id' => $returnRequest->customer?->id,
                'name' => $returnRequest->customer?->name,
                'email' => $returnRequest->customer?->email,
                'phone' => $returnRequest->customer?->phone,
            ],
            'request_type' => $returnRequest->request_type,
            'status' => $returnRequest->status,
            'reason' => $returnRequest->reason,
            'description' => $returnRequest->description,
            'initial_image_urls' => $returnRequest->initial_image_urls,
            'admin_note' => $returnRequest->admin_note,
            'return_courier_name' => $returnRequest->return_courier_name,
            'return_tracking_no' => $returnRequest->return_tracking_no,
            'return_shipped_at' => $returnRequest->return_shipped_at,
            'items' => $returnRequest->items->map(function ($item) {
                return [
                    'order_item_id' => $item->order_item_id,
                    'product_name_snapshot' => $item->orderItem?->product_name_snapshot,
                    'sku_snapshot' => $item->orderItem?->sku_snapshot,
                    'quantity' => $item->orderItem?->quantity,
                    'requested_quantity' => $item->quantity,
                ];
            }),
            'timeline' => [
                'created_at' => $returnRequest->created_at,
                'reviewed_at' => $returnRequest->reviewed_at,
                'received_at' => $returnRequest->received_at,
                'completed_at' => $returnRequest->completed_at,
            ],
        ]);
    }

    public function updateStatus(Request $request, ReturnRequest $returnRequest)
    {
        $validated = $request->validate([
            'action' => ['required', 'in:approve,reject,mark_in_transit,mark_received,mark_refunded'],
            'admin_note' => ['nullable', 'string'],
            'status_note' => ['nullable', 'string'],
        ]);

        $action = $validated['action'];

        switch ($action) {
            case 'approve':
                if ($returnRequest->status !== 'requested') {
                    return $this->respond(null, __('Return request not in requested state.'), false, 422);
                }
                $returnRequest->status = 'approved';
                $returnRequest->reviewed_at = Carbon::now();
                break;
            case 'reject':
                if ($returnRequest->status !== 'requested') {
                    return $this->respond(null, __('Return request not in requested state.'), false, 422);
                }
                if (empty($validated['admin_note'])) {
                    return $this->respond(null, __('Admin note is required for rejection.'), false, 422);
                }
                $returnRequest->status = 'rejected';
                $returnRequest->reviewed_at = Carbon::now();
                break;
            case 'mark_in_transit':
                if ($returnRequest->status !== 'approved') {
                    return $this->respond(null, __('Return request must be approved before marking in transit.'), false, 422);
                }
                $returnRequest->status = 'in_transit';
                break;
            case 'mark_received':
                if (! in_array($returnRequest->status, ['approved', 'in_transit'], true)) {
                    return $this->respond(null, __('Return request not awaiting receipt.'), false, 422);
                }
                $returnRequest->status = 'received';
                $returnRequest->received_at = Carbon::now();
                break;
            case 'mark_refunded':
                if ($returnRequest->status !== 'received') {
                    return $this->respond(null, __('Return request must be received before refunding.'), false, 422);
                }
                if (empty($validated['admin_note'])) {
                    return $this->respond(null, __('Admin note is required for refunding.'), false, 422);
                }
                $returnRequest->status = 'refunded';
                $returnRequest->completed_at = Carbon::now();
                break;
        }

        $returnRequest->admin_note = $validated['admin_note'] ?? $validated['status_note'] ?? $returnRequest->admin_note;
        $returnRequest->save();

        if ($action === 'mark_refunded' && $returnRequest->relationLoaded('order') === false) {
            $returnRequest->load('order');
        }

        if ($action === 'mark_refunded' && $returnRequest->order) {
            $returnRequest->order->update([
                'payment_status' => 'refunded',
            ]);
        }

        return $this->respond($returnRequest->fresh(), __('Status updated.'));
    }
}
