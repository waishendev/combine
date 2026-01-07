<?php

namespace App\Http\Controllers\Ecommerce;

use App\Http\Controllers\Controller;
use App\Models\Ecommerce\PaymentGateway;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;

class PaymentGatewayController extends Controller
{
    public function index(Request $request)
    {
        $perPage = $request->integer('per_page', 15);

        $paymentGateways = PaymentGateway::query()
            ->when($request->filled('is_active'), fn($query) => $query->where('is_active', $request->boolean('is_active')))
            ->orderBy('sort_order')
            ->orderBy('id')
            ->paginate($perPage);

        return $this->respond($paymentGateways);
    }

    public function show(PaymentGateway $paymentGateway)
    {
        return $this->respond($paymentGateway);
    }

    public function store(Request $request)
    {
        $validated = $this->validateRequest($request);

        $payload = $validated + [
            'is_active' => $validated['is_active'] ?? true,
            'is_default' => $validated['is_default'] ?? false,
        ];

        $maxSortOrder = PaymentGateway::max('sort_order') ?? 0;
        $payload['sort_order'] = $maxSortOrder + 1;

        $paymentGateway = PaymentGateway::create($payload);

        if ($paymentGateway->is_default) {
            $this->unsetOtherDefaults($paymentGateway->id);
        }

        return $this->respond($paymentGateway, __('Payment gateway created.'));
    }

    public function update(Request $request, PaymentGateway $paymentGateway)
    {
        $validated = $this->validateRequest($request, $paymentGateway);

        $paymentGateway->fill($validated);
        $paymentGateway->save();

        if ($paymentGateway->is_default) {
            $this->unsetOtherDefaults($paymentGateway->id);
        }

        return $this->respond($paymentGateway, __('Payment gateway updated.'));
    }

    public function destroy(PaymentGateway $paymentGateway)
    {
        $paymentGateway->delete();

        return $this->respond(null, __('Payment gateway deleted.'));
    }

    public function moveUp(PaymentGateway $paymentGateway)
    {
        return DB::transaction(function () use ($paymentGateway) {
            $oldPosition = $paymentGateway->sort_order;

            $previousItem = PaymentGateway::where('sort_order', '<', $paymentGateway->sort_order)
                ->orderBy('sort_order', 'desc')
                ->first();

            if (!$previousItem) {
                return $this->respond(null, __('Payment gateway is already at the top.'), false, 400);
            }

            $newPosition = $previousItem->sort_order;

            $paymentGateway->sort_order = $newPosition;
            $paymentGateway->save();

            $previousItem->sort_order = $oldPosition;
            $previousItem->save();

            return $this->respond([
                'id' => $paymentGateway->id,
                'old_position' => $oldPosition,
                'new_position' => $newPosition,
            ], __('Payment gateway moved up successfully.'));
        });
    }

    public function moveDown(PaymentGateway $paymentGateway)
    {
        return DB::transaction(function () use ($paymentGateway) {
            $oldPosition = $paymentGateway->sort_order;

            $nextItem = PaymentGateway::where('sort_order', '>', $paymentGateway->sort_order)
                ->orderBy('sort_order', 'asc')
                ->first();

            if (!$nextItem) {
                return $this->respond(null, __('Payment gateway is already at the bottom.'), false, 400);
            }

            $newPosition = $nextItem->sort_order;

            $paymentGateway->sort_order = $newPosition;
            $paymentGateway->save();

            $nextItem->sort_order = $oldPosition;
            $nextItem->save();

            return $this->respond([
                'id' => $paymentGateway->id,
                'old_position' => $oldPosition,
                'new_position' => $newPosition,
            ], __('Payment gateway moved down successfully.'));
        });
    }

    protected function validateRequest(Request $request, ?PaymentGateway $paymentGateway = null): array
    {
        $isUpdate = $paymentGateway !== null;

        $rules = [
            'key' => [
                $isUpdate ? 'sometimes' : 'required',
                'string',
                'max:50',
                Rule::unique('payment_gateways', 'key')->ignore($paymentGateway?->id),
            ],
            'name' => [$isUpdate ? 'sometimes' : 'required', 'string', 'max:150'],
            'is_active' => ['sometimes', 'boolean'],
            'is_default' => ['sometimes', 'boolean'],
            'config' => ['nullable', 'array'],
        ];

        if ($isUpdate) {
            $rules['sort_order'] = ['sometimes', 'integer'];
        }

        return $request->validate($rules);
    }

    protected function unsetOtherDefaults(int $paymentGatewayId): void
    {
        PaymentGateway::where('id', '!=', $paymentGatewayId)
            ->where('is_default', true)
            ->update(['is_default' => false]);
    }
}
