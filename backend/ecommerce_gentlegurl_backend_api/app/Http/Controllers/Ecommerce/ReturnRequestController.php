<?php

namespace App\Http\Controllers\Ecommerce;

use App\Http\Controllers\Controller;
use App\Models\Ecommerce\ReturnRequest;
use Carbon\Carbon;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Validator;
use Illuminate\Validation\Rule;

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
        $returnRequest->load([
            'order',
            'customer',
            'items.orderItem.product.images',
        ]);

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
            'refund_amount' => $returnRequest->refund_amount,
            'refund_method' => $returnRequest->refund_method,
            'refund_proof_path' => $returnRequest->refund_proof_path,
            'refunded_at' => $returnRequest->refunded_at,
            'items' => $returnRequest->items->map(function ($item) {
                $orderItem = $item->orderItem;
                $thumbnail = $orderItem?->product?->cover_image_url;
                $productType = $orderItem?->product?->type;

                return [
                    'product_id' => $orderItem?->product_id,
                    'product_sku' => $orderItem?->sku_snapshot,
                    'product_variant_id' => $orderItem?->product_variant_id,
                    'product_type' => $productType,
                    'is_variant_product' => $productType === 'variant',
                    'product_name' => $orderItem?->product_name_snapshot ?? $orderItem?->product?->name,
                    'variant_name' => $orderItem?->variant_name_snapshot,
                    'variant_sku' => $orderItem?->variant_sku_snapshot,
                    'quantity' => $item->quantity,
                    'unit_price' => $orderItem?->price_snapshot,
                    'line_total' => $orderItem?->line_total,
                    'product_image' => $thumbnail,
                    'cover_image_url' => $thumbnail,
                ];
            }),
            'timeline' => [
                'created_at' => $returnRequest->created_at,
                'reviewed_at' => $returnRequest->reviewed_at,
                'received_at' => $returnRequest->received_at,
                'completed_at' => $returnRequest->completed_at,
                'refunded_at' => $returnRequest->refunded_at,
            ],
        ]);
    }

    public function updateStatus(Request $request, ReturnRequest $returnRequest)
    {
        $action = $request->input('action')
            ?? $request->input('mark')
            ?? $request->input('status_action');

        $validator = Validator::make(
            array_merge($request->all(), ['action' => $action]),
            [
                'action' => ['required', Rule::in(['approve', 'reject', 'mark_in_transit', 'mark_received', 'mark_refunded'])],
                'admin_note' => ['nullable', 'string'],
                'status_note' => ['nullable', 'string'],
                'refund_amount' => [
                    Rule::requiredIf($action === 'mark_refunded'),
                    'numeric',
                    'min:0.01',
                ],
                'refund_method' => ['nullable', 'string', 'max:30'],
                'refund_proof_path' => ['nullable', 'file', 'mimes:jpg,jpeg,png,webp,pdf', 'max:5120'],
            ]
        );

        $validated = $validator->validate();

        $refundAmount = isset($validated['refund_amount'])
            ? (float) $validated['refund_amount']
            : null;

        if ($action !== 'mark_refunded') {
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
            }

            $returnRequest->admin_note = $validated['admin_note'] ?? $validated['status_note'] ?? $returnRequest->admin_note;
            $returnRequest->save();
        }

        if ($action === 'mark_refunded') {
            if ($returnRequest->status !== 'received') {
                return $this->respond(null, __('Return request must be received before refunding.'), false, 422);
            }
            if (empty($validated['admin_note'])) {
                return $this->respond(null, __('Admin note is required for refunding.'), false, 422);
            }

            if ($returnRequest->relationLoaded('order') === false) {
                $returnRequest->load('order');
            }

            if (! $returnRequest->order) {
                return $this->respond(null, __('Return request has no associated order.'), false, 422);
            }

            $uploadedProofPath = null;
            if ($request->hasFile('refund_proof_path')) {
                $uploadedProofPath = $request->file('refund_proof_path')->store('refund-photos', 'public');
            }

            try {
                DB::transaction(function () use (
                    $returnRequest,
                    $validated,
                    $refundAmount,
                    $uploadedProofPath
                ) {
                    $lockedOrder = $returnRequest->order->newQuery()->lockForUpdate()->find($returnRequest->order->id);
                    if (! $lockedOrder) {
                        return;
                    }

                    $remaining = (float) $lockedOrder->grand_total - (float) $lockedOrder->refund_total;
                    if ($refundAmount > $remaining) {
                        throw new \RuntimeException('Refund amount exceeds remaining refundable total.');
                    }

                    $returnRequest->status = 'refunded';
                    $returnRequest->completed_at = Carbon::now();
                    $returnRequest->refunded_at = Carbon::now();
                    $returnRequest->refund_amount = $refundAmount;
                    $returnRequest->refund_method = $validated['refund_method'] ?? $returnRequest->refund_method;
                    if ($uploadedProofPath) {
                        $returnRequest->refund_proof_path = $uploadedProofPath;
                    }
                    $returnRequest->admin_note = $validated['admin_note'] ?? $validated['status_note'] ?? $returnRequest->admin_note;
                    $returnRequest->save();

                    $lockedOrder->refund_total = (float) $lockedOrder->refund_total + $refundAmount;
                    // $lockedOrder->payment_status = 'refunded';
                    if ($uploadedProofPath) {
                        $lockedOrder->refund_proof_path = $uploadedProofPath;
                    }
                    $lockedOrder->refunded_at = Carbon::now();
                    $lockedOrder->save();
                });
            } catch (\RuntimeException $exception) {
                return $this->respond(null, __($exception->getMessage()), false, 422);
            }
        }

        return $this->respond($returnRequest->fresh(), __('Status updated.'));
    }
}
