<?php

namespace App\Http\Controllers\Ecommerce;

use App\Http\Controllers\Controller;
use App\Models\BillplzPaymentGatewayOption;
use App\Support\WorkspaceType;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class BillplzPaymentGatewayOptionController extends Controller
{
    public function publicIndex(Request $request)
    {
        $validated = $request->validate([
            'type' => ['nullable', 'string', Rule::in([WorkspaceType::ECOMMERCE, WorkspaceType::BOOKING])],
            'gateway_group' => ['required', 'string', Rule::in(['online_banking', 'credit_card'])],
        ]);

        $type = $validated['type'] ?? WorkspaceType::fromRequest($request, WorkspaceType::ECOMMERCE);
        $gatewayGroup = (string) $validated['gateway_group'];

        $options = BillplzPaymentGatewayOption::query()
            ->where('type', $type)
            ->where('gateway_group', $gatewayGroup)
            ->where('is_active', true)
            ->orderBy('sort_order')
            ->orderBy('id')
            ->get(['id', 'name', 'code', 'logo_url', 'is_default', 'sort_order']);

        return $this->respond($options);
    }

    public function index(Request $request)
    {
        $type = WorkspaceType::fromRequest($request);
        $perPage = $request->integer('per_page', 15);

        $options = BillplzPaymentGatewayOption::query()
            ->where('type', $type)
            ->when($request->filled('gateway_group'), fn ($q) => $q->where('gateway_group', $request->string('gateway_group')))
            ->when($request->filled('is_active'), fn ($q) => $q->where('is_active', $request->boolean('is_active')))
            ->orderBy('gateway_group')
            ->orderBy('sort_order')
            ->orderBy('id')
            ->paginate($perPage);

        return $this->respond($options);
    }

    public function show(Request $request, BillplzPaymentGatewayOption $paymentGatewayOption)
    {
        $this->ensureTypeMatch($request, $paymentGatewayOption);

        return $this->respond($paymentGatewayOption);
    }

    public function store(Request $request)
    {
        $type = WorkspaceType::fromRequest($request);
        $validated = $this->validatePayload($request, null, $type);

        $payload = $validated + [
            'type' => $type,
            'is_active' => $validated['is_active'] ?? true,
            'is_default' => $validated['is_default'] ?? false,
        ];

        $maxSortOrder = BillplzPaymentGatewayOption::query()
            ->where('type', $type)
            ->where('gateway_group', $payload['gateway_group'])
            ->max('sort_order') ?? 0;
        $payload['sort_order'] = $validated['sort_order'] ?? ($maxSortOrder + 1);

        $option = BillplzPaymentGatewayOption::create($payload);

        if ($option->is_default) {
            $this->unsetOtherDefaults($option->id, $type, $option->gateway_group);
        }

        return $this->respond($option, __('Billplz payment option created.'));
    }

    public function update(Request $request, BillplzPaymentGatewayOption $paymentGatewayOption)
    {
        $type = $this->ensureTypeMatch($request, $paymentGatewayOption);
        $validated = $this->validatePayload($request, $paymentGatewayOption, $type);

        $paymentGatewayOption->fill($validated);
        $paymentGatewayOption->save();

        if ($paymentGatewayOption->is_default) {
            $this->unsetOtherDefaults($paymentGatewayOption->id, $type, $paymentGatewayOption->gateway_group);
        }

        return $this->respond($paymentGatewayOption, __('Billplz payment option updated.'));
    }

    public function destroy(Request $request, BillplzPaymentGatewayOption $paymentGatewayOption)
    {
        $this->ensureTypeMatch($request, $paymentGatewayOption);
        $paymentGatewayOption->delete();

        return $this->respond(null, __('Billplz payment option deleted.'));
    }

    protected function validatePayload(Request $request, ?BillplzPaymentGatewayOption $option, string $type): array
    {
        $isUpdate = $option !== null;

        return $request->validate([
            'gateway_group' => [$isUpdate ? 'sometimes' : 'required', 'string', Rule::in(['online_banking', 'credit_card'])],
            'code' => [
                $isUpdate ? 'sometimes' : 'required',
                'string',
                'max:100',
                Rule::unique('billplz_payment_gateway_options', 'code')
                    ->where(fn ($q) => $q
                        ->where('type', $type)
                        ->where('gateway_group', (string) $request->input('gateway_group', $option?->gateway_group)))
                    ->ignore($option?->id),
            ],
            'name' => [$isUpdate ? 'sometimes' : 'required', 'string', 'max:150'],
            'logo_url' => ['nullable', 'string', 'max:255'],
            'description' => ['nullable', 'string'],
            'is_active' => ['sometimes', 'boolean'],
            'is_default' => ['sometimes', 'boolean'],
            'sort_order' => ['sometimes', 'integer'],
            'meta' => ['nullable', 'array'],
        ]);
    }

    protected function unsetOtherDefaults(int $id, string $type, string $group): void
    {
        BillplzPaymentGatewayOption::query()
            ->where('type', $type)
            ->where('gateway_group', $group)
            ->where('id', '!=', $id)
            ->where('is_default', true)
            ->update(['is_default' => false]);
    }

    protected function ensureTypeMatch(Request $request, BillplzPaymentGatewayOption $paymentGatewayOption): string
    {
        $type = WorkspaceType::fromRequest($request, $paymentGatewayOption->type ?: WorkspaceType::ECOMMERCE);
        abort_unless($paymentGatewayOption->type === $type, 404);

        return $type;
    }
}
