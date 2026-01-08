<?php

namespace App\Http\Controllers\Ecommerce;

use App\Http\Controllers\Concerns\ResolvesCurrentCustomer;
use App\Http\Controllers\Controller;
use App\Models\Ecommerce\Order;
use App\Models\Ecommerce\OrderItem;
use App\Models\Ecommerce\ReturnRequest;
use App\Models\Ecommerce\ReturnRequestItem;
use Carbon\Carbon;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use App\Services\SettingService;

class PublicReturnController extends Controller
{
    use ResolvesCurrentCustomer;

    public function store(Request $request, ?Order $order = null)
    {
        if (! $request->has('items') && $request->has('item_ids')) {
            $request->merge(['items' => $request->input('item_ids')]);
        }

        if (! $request->has('initial_image_urls') && $request->has('image_urls')) {
            $request->merge(['initial_image_urls' => $request->input('image_urls')]);
        }

        $validated = $request->validate([
            'order_id' => [$order ? 'nullable' : 'required', 'integer', 'exists:orders,id'],
            'request_type' => ['required', 'in:return'],
            'reason' => ['nullable', 'string', 'max:255'],
            'description' => ['nullable', 'string'],
            'items' => ['required', 'array', 'min:1'],
            'items.*.order_item_id' => ['required', 'integer', 'exists:order_items,id'],
            'items.*.quantity' => ['required', 'integer', 'min:1'],
            'initial_image_urls' => ['nullable', 'array'],
            'initial_image_urls.*' => ['url'],
            'initial_images' => ['nullable', 'array', 'max:5'],
            'initial_images.*' => [
                'file',
                'mimes:' . implode(',', config('ecommerce.return_media.image_extensions')),
                'max:' . ((int) config('ecommerce.return_media.image_max_mb') * 1024),
            ],
            'initial_video' => [
                'nullable',
                'file',
                'mimes:' . implode(',', config('ecommerce.return_media.video_extensions')),
                'max:' . ((int) config('ecommerce.return_media.video_max_mb') * 1024),
            ],
        ]);

        $customer = $this->requireCustomer();

        $order = $order ?? Order::query()->find($validated['order_id']);

        if (! $order) {
            return $this->respond(null, __('Order not found.'), false, 404);
        }

        if ($order->customer_id !== (int) $customer->id) {
            return $this->respond(null, __('You are not allowed to access this order.'), false, 403);
        }

        if ($order->status !== 'completed') {
            return $this->respond(null, __('Only completed orders can be returned.'), false, 422);
        }

        if (! $order->completed_at) {
            return $this->respond(null, __('Return window expired.'), false, 422);
        }

        $returnWindowDays = (int) SettingService::get('ecommerce.return_window_days', 7);
        $returnWindowEndsAt = Carbon::parse($order->completed_at)->addDays($returnWindowDays);

        if (Carbon::now()->greaterThan($returnWindowEndsAt)) {
            return $this->respond(null, __('Return window expired.'), false, 422);
        }

        $activeStatuses = ['requested', 'approved', 'in_transit', 'received'];
        $activeReturnExists = ReturnRequest::where('order_id', $order->id)
            ->whereIn('status', $activeStatuses)
            ->exists();

        if ($activeReturnExists) {
            return $this->respond(null, __('An active return request already exists for this order.'), false, 422);
        }

        $orderItems = OrderItem::where('order_id', $order->id)
            ->whereIn('id', collect($validated['items'])->pluck('order_item_id'))
            ->get()
            ->keyBy('id');

        if ($orderItems->count() !== count($validated['items'])) {
            return $this->respond(null, __('One or more order items are invalid.'), false, 422);
        }

        foreach ($validated['items'] as $item) {
            $orderItem = $orderItems->get($item['order_item_id']);
            if (! $orderItem || $item['quantity'] > $orderItem->quantity) {
                return $this->respond(null, __('Return quantity exceeds purchased quantity.'), false, 422);
            }
        }

        if ($request->hasFile('initial_video') && ! config('ecommerce.return_media.video_enabled')) {
            return $this->respond(null, __('Video upload is disabled.'), false, 422);
        }

        $uploadedMediaUrls = [];

        $returnRequest = DB::transaction(function () use ($validated, $orderItems, $order, $customer, $request, &$uploadedMediaUrls) {
            $requestModel = ReturnRequest::create([
                'order_id' => $order->id,
                'customer_id' => $customer->id,
                'request_type' => $validated['request_type'],
                'status' => 'requested',
                'reason' => $validated['reason'] ?? null,
                'description' => $validated['description'] ?? null,
                'initial_image_urls' => $validated['initial_image_urls'] ?? [],
            ]);

            $imageFiles = $request->file('initial_images', []);
            if (!is_array($imageFiles)) {
                $imageFiles = [$imageFiles];
            }

            foreach ($imageFiles as $file) {
                if (!$file) {
                    continue;
                }
                $filename = sprintf(
                    'returns/%s/images/%s.%s',
                    $requestModel->id,
                    Str::uuid(),
                    $file->getClientOriginalExtension()
                );
                $path = $file->storeAs('', $filename, 'public');
                $uploadedMediaUrls[] = Storage::disk('public')->url($path);
            }

            $videoFile = $request->file('initial_video');
            if ($videoFile) {
                $filename = sprintf(
                    'returns/%s/videos/%s.%s',
                    $requestModel->id,
                    Str::uuid(),
                    $videoFile->getClientOriginalExtension()
                );
                $path = $videoFile->storeAs('', $filename, 'public');
                $uploadedMediaUrls[] = Storage::disk('public')->url($path);
            }

            if (!empty($uploadedMediaUrls)) {
                $requestModel->initial_image_urls = array_values(array_merge(
                    $requestModel->initial_image_urls ?? [],
                    $uploadedMediaUrls
                ));
                $requestModel->save();
            }

            foreach ($validated['items'] as $item) {
                ReturnRequestItem::create([
                    'return_request_id' => $requestModel->id,
                    'order_item_id' => $item['order_item_id'],
                    'quantity' => $item['quantity'],
                ]);
            }

            return $requestModel;
        });

        $returnRequest->load('items.orderItem');

        return $this->respond([
            'id' => $returnRequest->id,
            'order_id' => $returnRequest->order_id,
            'customer_id' => $returnRequest->customer_id,
            'request_type' => $returnRequest->request_type,
            'status' => $returnRequest->status,
            'reason' => $returnRequest->reason,
            'description' => $returnRequest->description,
            'initial_image_urls' => $returnRequest->initial_image_urls,
            'item_summaries' => $returnRequest->items->map(function (ReturnRequestItem $item) use ($orderItems) {
                $orderItem = $orderItems->get($item->order_item_id);
                return [
                    'order_item_id' => $item->order_item_id,
                    'product_name' => $orderItem?->product_name_snapshot,
                    'quantity' => $item->quantity,
                ];
            })->values(),
        ], __('Return request submitted.'));
    }

    public function index(Request $request)
    {
        $customer = $this->requireCustomer();

        $validated = $request->validate([
            'status' => ['nullable', 'string'],
            'order_id' => ['nullable', 'integer'],
            'page' => ['nullable', 'integer'],
            'per_page' => ['nullable', 'integer'],
        ]);

        $query = ReturnRequest::with(['order'])
            ->where('customer_id', $customer->id);

        if (!empty($validated['status'])) {
            $query->where('status', $validated['status']);
        }

        if (!empty($validated['order_id'])) {
            $query->where('order_id', $validated['order_id']);
        }

        $returns = $query
            ->withCount('items')
            ->withSum('items as items_quantity', 'quantity')
            ->latest()
            ->paginate($validated['per_page'] ?? 15);

        $returns->getCollection()->transform(function (ReturnRequest $request) {
            $refundProofUrl = $request->refund_proof_path
                ? Storage::disk('public')->url($request->refund_proof_path)
                : null;

            return [
                'id' => $request->id,
                'order_id' => $request->order_id,
                'order_number' => $request->order?->order_number,
                'request_type' => $request->request_type,
                'status' => $request->status,
                'reason' => $request->reason,
                'created_at' => $request->created_at,
                'total_items' => $request->items_count,
                'total_quantity' => $request->items_quantity,
                'refund_amount' => $request->refund_amount,
                'refund_method' => $request->refund_method,
                'refund_proof_url' => $refundProofUrl,
                'refunded_at' => $request->refunded_at,
            ];
        });

        return $this->respond($returns);
    }

    public function show(Request $request, ReturnRequest $returnRequest)
    {
        $customer = $this->requireCustomer();

        if ($returnRequest->customer_id !== (int) $customer->id) {
            return $this->respond(null, __('You are not allowed to access this return request.'), false, 403);
        }

        $returnRequest->load(['items.orderItem.product.images', 'order']);
        $refundProofUrl = $returnRequest->refund_proof_path
            ? Storage::disk('public')->url($returnRequest->refund_proof_path)
            : null;

        return $this->respond([
            'id' => $returnRequest->id,
            'order_id' => $returnRequest->order_id,
            'order_number' => $returnRequest->order?->order_number,
            'customer_id' => $returnRequest->customer_id,
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
            'refund_proof_url' => $refundProofUrl,
            'refunded_at' => $returnRequest->refunded_at,
            'items' => $returnRequest->items->map(function (ReturnRequestItem $item) {
                $thumbnail = $item->orderItem?->product?->cover_image_url;

                return [
                    'order_item_id' => $item->order_item_id,
                    'product_name' => $item->orderItem?->product_name_snapshot,
                    'sku' => $item->orderItem?->sku_snapshot,
                    'order_quantity' => $item->orderItem?->quantity,
                    'requested_quantity' => $item->quantity,
                    'product_image' => $thumbnail,
                    'cover_image_url' => $thumbnail,
                ];
            }),
            'timestamps' => [
                'created_at' => $returnRequest->created_at,
                'reviewed_at' => $returnRequest->reviewed_at,
                'received_at' => $returnRequest->received_at,
                'completed_at' => $returnRequest->completed_at,
            ],
        ]);
    }

    public function submitTracking(Request $request, ReturnRequest $returnRequest)
    {
        $customer = $this->requireCustomer();

        if (! $request->has('return_courier_name') && $request->has('courier_name')) {
            $request->merge(['return_courier_name' => $request->input('courier_name')]);
        }

        if (! $request->has('return_tracking_no') && $request->has('tracking_no')) {
            $request->merge(['return_tracking_no' => $request->input('tracking_no')]);
        }

        $validated = $request->validate([
            'return_courier_name' => ['required', 'string', 'max:100'],
            'return_tracking_no' => ['required', 'string', 'max:100'],
        ]);

        if ($returnRequest->customer_id !== (int) $customer->id) {
            return $this->respond(null, __('You are not allowed to access this return request.'), false, 403);
        }

        if ($returnRequest->status !== 'approved') {
            return $this->respond(null, __('Current status does not allow submitting tracking information.'), false, 422);
        }

        $returnRequest->update([
            'return_courier_name' => $validated['return_courier_name'],
            'return_tracking_no' => $validated['return_tracking_no'],
            'return_shipped_at' => Carbon::now(),
            'status' => 'in_transit',
        ]);

        return $this->respond($returnRequest->fresh(), __('Tracking information submitted.'));
    }
}
