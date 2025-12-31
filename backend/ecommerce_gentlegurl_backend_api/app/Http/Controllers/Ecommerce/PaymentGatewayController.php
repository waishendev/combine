<?php

namespace App\Http\Controllers\Ecommerce;

use App\Http\Controllers\Controller;
use App\Models\Ecommerce\PaymentGateway;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class PaymentGatewayController extends Controller
{
    public function index(Request $request)
    {
        $perPage = $request->integer('per_page', 15);

        $paymentGateways = PaymentGateway::query()
            ->when($request->filled('is_active'), fn($query) => $query->where('is_active', $request->boolean('is_active')))
            ->orderByDesc('is_default')
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

    protected function validateRequest(Request $request, ?PaymentGateway $paymentGateway = null): array
    {
        $isUpdate = $paymentGateway !== null;

        return $request->validate([
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
        ]);
    }

    protected function unsetOtherDefaults(int $paymentGatewayId): void
    {
        PaymentGateway::where('id', '!=', $paymentGatewayId)
            ->where('is_default', true)
            ->update(['is_default' => false]);
    }
}
