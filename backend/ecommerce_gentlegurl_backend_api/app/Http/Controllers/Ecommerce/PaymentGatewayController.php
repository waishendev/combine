<?php

namespace App\Http\Controllers\Ecommerce;

use App\Http\Controllers\Controller;
use App\Models\Ecommerce\PaymentGateway;
use App\Support\WorkspaceType;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;

class PaymentGatewayController extends Controller
{
    public function index(Request $request)
    {
        $perPage = $request->integer('per_page', 15);
        $type = WorkspaceType::fromRequest($request);

        $paymentGateways = PaymentGateway::query()
            ->where('type', $type)
            ->when($request->filled('is_active'), fn($query) => $query->where('is_active', $request->boolean('is_active')))
            ->orderBy('sort_order')
            ->orderBy('id')
            ->paginate($perPage);

        return $this->respond($paymentGateways);
    }

    public function show(Request $request, PaymentGateway $paymentGateway)
    {
        $this->ensureTypeMatch($request, $paymentGateway);

        return $this->respond($paymentGateway);
    }

    public function store(Request $request)
    {
        $type = WorkspaceType::fromRequest($request);
        $validated = $this->validateRequest($request, null, $type);

        $payload = $validated + [
            'type' => $type,
            'is_active' => $validated['is_active'] ?? true,
            'is_default' => $validated['is_default'] ?? false,
        ];

        $maxSortOrder = PaymentGateway::where('type', $type)->max('sort_order') ?? 0;
        $payload['sort_order'] = $maxSortOrder + 1;

        $paymentGateway = PaymentGateway::create($payload);

        if ($paymentGateway->is_default) {
            $this->unsetOtherDefaults($paymentGateway->id, $type);
        }

        return $this->respond($paymentGateway, __('Payment gateway created.'));
    }

    public function update(Request $request, PaymentGateway $paymentGateway)
    {
        $type = $this->ensureTypeMatch($request, $paymentGateway);
        $validated = $this->validateRequest($request, $paymentGateway, $type);

        unset($validated['type']);
        $paymentGateway->fill($validated);
        $paymentGateway->save();

        if ($paymentGateway->is_default) {
            $this->unsetOtherDefaults($paymentGateway->id, $type);
        }

        return $this->respond($paymentGateway, __('Payment gateway updated.'));
    }

    public function destroy(Request $request, PaymentGateway $paymentGateway)
    {
        $this->ensureTypeMatch($request, $paymentGateway);
        $paymentGateway->delete();

        return $this->respond(null, __('Payment gateway deleted.'));
    }

    public function moveUp(Request $request, PaymentGateway $paymentGateway)
    {
        $type = $this->ensureTypeMatch($request, $paymentGateway);

        return DB::transaction(function () use ($paymentGateway, $type) {
            $oldPosition = $paymentGateway->sort_order;

            $previousItem = PaymentGateway::where('type', $type)
                ->where('sort_order', '<', $paymentGateway->sort_order)
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

    public function moveDown(Request $request, PaymentGateway $paymentGateway)
    {
        $type = $this->ensureTypeMatch($request, $paymentGateway);

        return DB::transaction(function () use ($paymentGateway, $type) {
            $oldPosition = $paymentGateway->sort_order;

            $nextItem = PaymentGateway::where('type', $type)
                ->where('sort_order', '>', $paymentGateway->sort_order)
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

    protected function validateRequest(Request $request, ?PaymentGateway $paymentGateway = null, string $type = WorkspaceType::ECOMMERCE): array
    {
        $isUpdate = $paymentGateway !== null;

        $rules = [
            'key' => [
                $isUpdate ? 'sometimes' : 'required',
                'string',
                'max:50',
                Rule::unique('payment_gateways', 'key')
                    ->where(fn($q) => $q->where('type', $type))
                    ->ignore($paymentGateway?->id),
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

    protected function unsetOtherDefaults(int $paymentGatewayId, string $type): void
    {
        PaymentGateway::where('type', $type)
            ->where('id', '!=', $paymentGatewayId)
            ->where('is_default', true)
            ->update(['is_default' => false]);
    }

    protected function ensureTypeMatch(Request $request, PaymentGateway $paymentGateway): string
    {
        $type = WorkspaceType::fromRequest($request, $paymentGateway->type ?: WorkspaceType::ECOMMERCE);

        abort_unless($paymentGateway->type === $type, 404);

        return $type;
    }
}
